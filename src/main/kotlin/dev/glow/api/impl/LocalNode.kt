package dev.glow.api.impl

import dev.glow.api.*
import dev.glow.crypto.Cryptography
import dev.glow.firefly.network.FireflyContext
import dev.glow.firefly.serialization.FireflyException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.logging.Level
import java.util.logging.Logger.getLogger

// the current, in-memory node
class LocalNode(id: Id, val crypto: Cryptography) : Resource(id), Node {
    data class Kex(val ourPub: PubKey, val ourSecret: SecretKey, val source: Id, val theirPub: PubKey)

    val log = getLogger(this::javaClass.name)
    val keyExchanges = ConcurrentHashMap<Nonce, Kex>()

    override fun start(fly: FireflyContext, kx: KeyExchange) {
        // compute new key pair on our sides
        keyExchanges.computeIfAbsent(fly.nonce) { id ->
            val (pub, secret) = crypto.kexKeyPair()
            // TODO:
            //fly.message(...)
            // to send the start message as well (or maybe rely on the link to do it)
            when {
                fly.source.value.contentEquals(kx.id.value.sliceArray(0..fly.source.value.size)) -> {
                    log.info("Received start message (supposedly) from ${fly.source}")
                    Kex(pub, secret, kx.id, kx.pk)
                }
                else ->
                    throw FireflyException("Received broken start message from ${fly.source} with ${kx.id}")
            }
        }
    }

    override fun establish(fly: FireflyContext, kxNonce: Nonce, encryptedKey: AeadKey) {
        when (val kex = keyExchanges[kxNonce]) {
            is Kex -> {
                fly.network.join(kex.source, crypto.sessionKeys(kex.ourSecret, kex.ourPub, kex.theirPub), fly.link)
                log.info("Node ${kex.source} established a new link with our Firefly network")
            }
            else -> {
                val msg = "Failed to establish connection with (wrong nonce, missing or outdated start message): ${fly.source}"
                log.log(Level.WARNING, msg)
            }
        }
    }

    override fun heartbeat(fly: FireflyContext, links: List<LSP>, resources: List<Relation>) {
        try {
            fly.network.heartbeat(fly.network.lookup(this, fly.source).id, links, resources)
        }
        catch (e: FireflyException) {
            log.log(Level.WARNING, "Failed to handle heartbeat message from ${fly.source}", e)
        }
    }

    override fun create(fly: FireflyContext, label: String, type: Id, id: Id): CompletableFuture<Id> =
        CompletableFuture.completedFuture(fly.network.create(fly.network.lookup(this, fly.source), fly.network.typeOf(this, type), id, label).id)

    override fun destroy(fly: FireflyContext, id: Id): CompletableFuture<Unit> =
        CompletableFuture.completedFuture(fly.network.destroy(fly.network.lookup(this, fly.source), id))
}

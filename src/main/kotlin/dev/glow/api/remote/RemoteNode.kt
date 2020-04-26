package dev.glow.api.remote

import dev.glow.api.*
import dev.glow.api.local.Resource
import dev.glow.firefly.network.FireflyContext
import dev.glow.firefly.serialization.Firefly
import kotlinx.serialization.builtins.list
import kotlinx.serialization.builtins.serializer
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap

// represents a known remote node resource somewhere on the Firefly Network we are connected to
class RemoteNode(val firefly: Firefly, id: Id) : Resource(id), Node, Remote {
    private val outstanding = ConcurrentHashMap<Nonce, CompletableFuture<Any>>()
    
    override fun start(fly: FireflyContext, kx: KeyExchange) {
        val bytes = firefly.dump(KeyExchange.serializer(), kx)
        fly.message(Addr(id.value), Bytes(bytes))
    }

    override fun establish(fly: FireflyContext, kxNonce: Nonce, encryptedKey: AeadKey) {
        val bytes = firefly.dump(Nonce.serializer(), kxNonce) + firefly.dump(AeadKey.serializer(), encryptedKey)
        fly.message(Addr(id.value), Bytes(bytes))
    }

    override fun heartbeat(fly: FireflyContext, links: List<LSP>, resources: List<Relation>) {
        val bytes = firefly.dump(LSP.serializer().list, links) + firefly.dump(Relation.serializer().list, resources)
        fly.message(Addr(id.value), Bytes(bytes))
    }

    override fun create(fly: FireflyContext, label: String, type: Id, id: Id): CompletableFuture<Id> {
        val future = CompletableFuture<Id>()
        outstanding.computeIfAbsent(fly.nonce) {
            val bytes = firefly.dump(String.serializer(), label) + firefly.dump(Id.serializer(), type) +
                    firefly.dump(Id.serializer(), id)
            fly.message(Addr(id.value), Bytes(bytes))
            val proxy = CompletableFuture<Any>()
            proxy.handle {  value, ex ->
                when(value) {
                    is Id -> future.complete(value)
                    else -> future.completeExceptionally(ex)
                }
            }
            proxy
        }
        return future
    }

    override fun destroy(fly: FireflyContext, id: Id): CompletableFuture<Unit> {
        val future = CompletableFuture<Unit>()
        // TODO: send the message and handle it
        return future
    }


    override fun handleIncomingMessage(fly: FireflyContext, message: Any) {
        outstanding[fly.nonce]?.apply {
            complete(message)
            outstanding.remove(fly.nonce)
        }
    }

    override fun periodic() {
        // TODO: cleanup outstanding requests cache using configurable TTL
    }
}

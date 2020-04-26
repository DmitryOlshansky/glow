package dev.glow.firefly.network

import dev.glow.api.*
import dev.glow.api.Remote
import dev.glow.api.local.Resource
import io.netty.channel.AbstractChannel
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import java.util.logging.Level
import java.util.logging.Logger.getLogger

class NettyLink(id: Id, val channelProducer: () -> CompletableFuture<AbstractChannel>) : Resource(id), Link, Remote {
    private val log = getLogger(this::class.java.name)
    private val mtu = AtomicLong(defaultMtu)
    private val clazz = AtomicReference(defaultLinkClass)
    private val up = AtomicBoolean(false)
    private val link = AtomicReference<AbstractChannel>()
    private val inFlight = AtomicReference<CompletableFuture<Unit>>()

    override fun outbound(fly: FireflyContext, packet: Packet) {
        link.get()?.apply {
            // TODO: check mtu
            this.write(packet)
        }
    }

    override fun inbound(fly: FireflyContext, packet: Packet) {
        fly.message(packet.dest, packet.payload)
    }

    override fun configure(fly: FireflyContext, up: Long, mtu: Long, clazz: LinkClass) {
        this.clazz.set(clazz)
        if (mtu > minimalMtu) this.mtu.set(mtu)
        this.up.set(up != 0L)
    }

    override fun handleIncomingMessage(fly: FireflyContext, message: Any) {
        when (message) {
            is Packet ->
                inbound(fly, message)
            else ->
                log.log(Level.SEVERE, "Internal error - wrong message type expected Packet but got ${message.javaClass.name}")
        }
    }

    override fun periodic() {
        link.get().apply { 
            if (this == null || !this.isOpen) {
                if (up.get() && inFlight.get() == null) {
                    val future = CompletableFuture<Unit>()
                    if (inFlight.compareAndSet(null, future)) {
                        log.info("Opening a new netty connection on link $id")
                        channelProducer().handle { value, ex ->
                            when(value) {
                                is AbstractChannel -> {
                                    log.info("Established netty connection on link $id")
                                    link.set(value)
                                    future.complete(Unit)
                                }
                                else -> {
                                    log.log(Level.WARNING, "Failed to establish netty connection on link $id", ex)
                                    future.completeExceptionally(ex)
                                }
                            }
                            inFlight.set(null)
                        }
                    }
                }
            }
        }
    }

    companion object {
        val defaultLinkClass = LinkClass(0, 0, 1.or(2).or(4))
        // MTU means link-level MTU i.e. 1500 on ethernet
        // the real MTU is computed by Firefly network subtracting the required portion from that
        const val defaultMtu = 1500L
        const val minimalMtu = 160L
    }
}
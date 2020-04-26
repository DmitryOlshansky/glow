package dev.glow.firefly.network

import dev.glow.firefly.api.*
import dev.glow.firefly.api.FireflyContext
import dev.glow.firefly.api.FireflyNetwork

data class FireflyContext(override val self: Addr,
                          override val from: Addr,
                          override val nonce: Nonce,
                          override val network: FireflyNetwork,
                          override val link: Link) : FireflyContext {
    override fun nextNonce(): Nonce = network.nextNonceFor(self)

    override fun message(dest: Addr, type: PacketType, bytes: Bytes, nonce: Nonce?) {
        network.routeMessage(self, dest, type, bytes, nonce ?: nextNonce())
    }

    override fun error(code: ErrorCode) {
        network.routeError(self, from, code, nonce)
    }
}
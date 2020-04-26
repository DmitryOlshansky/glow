package dev.glow.firefly.network

import dev.glow.api.*

interface FireflyContext {
    // the nonce of the received (handled) message
    val nonce: Nonce

    // the address of the source of the message
    val source: Addr

    // returns the nonce that the network would assign to the next message
    // useful in case we wanted to use it ourselves
    fun nextNonce(): Nonce

    // shoot a network message directly (for the very rare occasion it's needed)
    fun message(dest: Addr, bytes: Bytes, nonce: Nonce? = null)

    // reply to call directly by sending an error without throwing
    // an exception (and catching it later in the upper layer)
    fun error(code: ErrorCode)

    // the network module that routed the message
    val network: FireflyNetwork

    // the link through which the message was delivered
    val link: Link
}

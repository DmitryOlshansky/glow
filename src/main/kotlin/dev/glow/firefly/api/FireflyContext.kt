package dev.glow.firefly.api

interface FireflyContext {
    // the nonce of the received (handled) message
    val nonce: Nonce

    // the address of the resource that handles message
    val self: Addr

    // the address of the source of the message
    val from: Addr

    // returns the nonce that the network would assign to the next message
    // useful in case we wanted to use it ourselves
    fun nextNonce(): Nonce

    // shoot, a network message directly (for the rare occasion when it's needed)
    fun message(dest: Addr, type: PacketType, bytes: Bytes, nonce: Nonce? = null)

    // same but specifically as RPC reply
    fun message(bytes: Bytes, nonce: Nonce? = null) = message(from, PacketType.REPLY, bytes, nonce)

    // reply to call directly by sending an error without throwing
    // an exception (and catching it later in the upper layer)
    fun error(code: ErrorCode)

    // the network module that routed the message
    val network: FireflyNetwork

    // the link through which the message was delivered
    val link: Link
}

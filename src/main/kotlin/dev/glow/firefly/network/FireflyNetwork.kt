package dev.glow.firefly.network

interface FireflyNetwork {
    // extract nonce from the packet by passing reference to the first field of the message
    fun nonceFor(firstFieldOfMessage: Any)
}

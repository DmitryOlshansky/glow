package dev.glow.firefly.api

interface Remote {
    // a hook that is called when there is a message from this remote resource
    fun handleIncomingMessage(fly: FireflyContext, message: Any)

    // a hook to perform periodic cleanup work
    fun periodic() {}
}
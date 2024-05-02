package dev.glow.firefly.remote

import dev.glow.firefly.api.*
import dev.glow.firefly.local.Resource

class GenericRemoteResource(id: Id, val proto: Proto) : Resource(id), Remote {

    override fun handleIncomingMessage(fly: FireflyContext, message: Any) {
        TODO("Not yet implemented")
    }
}
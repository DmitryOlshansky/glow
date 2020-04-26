package dev.glow.api.impl

import dev.glow.api.*
import dev.glow.firefly.network.FireflyContext

class RemoteNode(id: Id) : Resource(id), Node {
    override fun start(fly: FireflyContext, kx: KeyExchange) {
        TODO("Not yet implemented")
    }

    override fun establish(fly: FireflyContext, kxNonce: Nonce, encryptedKey: AeadKey) {
        TODO("Not yet implemented")
    }

    override fun heartbeat(fly: FireflyContext, links: List<LSP>, resources: List<Relation>) {
        TODO("Not yet implemented")
    }

    override fun create(fly: FireflyContext, label: String, type: Id, id: Id): Id {
        TODO("Not yet implemented")
    }

    override fun destroy(fly: FireflyContext, id: Id) {
        TODO("Not yet implemented")
    }
}
package dev.glow.api.impl

import dev.glow.api.*
import dev.glow.api.Node

class Node : Node {
    override fun start(kx: KeyExchange) {
        TODO("Not yet implemented")
    }

    override fun establish(kxNonce: Nonce, encryptedKey: AeadKey) {
        TODO("Not yet implemented")
    }

    override fun heartbeat(links: List<LSP>, resources: List<Relation>) {
        TODO("Not yet implemented")
    }

    override fun create(label: String, type: Id, id: Id, signature: Signature): Id {
        TODO("Not yet implemented")
    }

    override fun destroy(id: Id, signature: Signature) {
        TODO("Not yet implemented")
    }
}
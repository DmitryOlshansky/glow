package dev.glow.firefly.network

import dev.glow.api.*
import dev.glow.crypto.SessionKeys
import dev.glow.firefly.serialization.FireflyException

interface FireflyNetwork {
    // join a (potentially new) node vith sessionKey over link
    fun join(node: Id, sessionKeys: SessionKeys, link: Link): Node
    
    fun heartbeat(neighbour: Id, links: List<LSP>, resources: List<Relation>)

    // resource lookup with access level of the viewer resource
    fun lookup(viewer: Resource, id : Addr): Resource

    // using human-readable labels (which may be mapped 1:1 to things like domain names)
    fun lookup(viewer: Resource, label: String): Resource
    
    fun typeOf(viewer: Resource, id: Id): Proto = when(val type = lookup(viewer, Addr(id.value))) {
        is Proto -> type
        else -> throw FireflyException("Resource is not a proto type - $id")
    }

    // this also registers the resource
    fun create(owner: Resource, type: Proto, id: Id, label: String): Resource

    // this destroys only resources that the owner owns
    fun destroy(owner: Resource, target: Id)

    // transfer ownership
    fun transfer(owner: Resource, beneficar: Resource, property: Id)
}

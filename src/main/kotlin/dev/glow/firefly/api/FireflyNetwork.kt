package dev.glow.firefly.api

import dev.glow.firefly.api.*
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
    fun create(owner: Resource, id: Id, type: Proto): Resource

    // this destroys only resources that the owner owns
    fun destroy(owner: Resource, target: Id)

    // transfer ownership of a resource
    fun transfer(owner: Resource, beneficiary: Resource, property: Id)

    // provide access to a resource
    fun share(owner: Resource, beneficiary: Resource, property: Id)

    fun nextNonceFor(origin: Addr): Nonce

    // sends (and fragments as needed) a fire and forget message
    // but checks if `from` has access to `to` first(!)
    fun routeMessage(from: Addr, to: Addr,  type: PacketType, payload: Bytes, nonce: Nonce)

    // sends error message along the approppriate link
    // but checks if `from` has access to `to` first(!)
    fun routeError(from: Addr, to: Addr, code: ErrorCode, nonce: Nonce)
}

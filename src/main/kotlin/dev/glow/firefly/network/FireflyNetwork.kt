package dev.glow.firefly.network

import dev.glow.firefly.api.*
import dev.glow.firefly.api.FireflyNetwork
import dev.glow.firefly.local.proto.GenericProto
import dev.glow.firefly.remote.GenericRemoteResource
import dev.glow.firefly.remote.RemoteNode
import dev.glow.firefly.serialization.Firefly
import java.util.concurrent.ConcurrentHashMap

class FireflyNetwork(val firefly: Firefly) : FireflyNetwork {
    // global resource map
    private val resources = ConcurrentHashMap<Id, Resource>()

    // key is `from` field of LSP, value is all LSP from that Id
    private val linkState = ConcurrentHashMap<Id, MutableSet<LSP>>()

    // same for Relation values
    private val relations = ConcurrentHashMap<Id, MutableSet<Relation>>()

    private fun context(from: Addr, to: Addr, link: Link) =
        FireflyContext(to, from, nextNonceFor(from), this, link)

    private fun linkFor(dest: Addr): Link = TODO("picking the right link not implemented yet")

    override fun join(node: Id, sessionKeys: SessionKeys, link: Link): Node {
        val remote = RemoteNode(firefly, node)
        resources[node] = remote
        return remote
    }

    override fun heartbeat(neighbour: Id, links: List<LSP>, resources: List<Relation>) {
        links.forEach { lsp ->
            //TODO: there is at least one undesirable race condition
            linkState.compute(lsp.from) { id, state ->
                if (state != null) {
                    synchronized(id) {
                        val outdated = state.find { it.to == lsp.to && it.rev < lsp.rev }
                        if (outdated != null) state.remove(outdated)
                        state.add(lsp)
                        state
                    }
                }
                else
                    mutableSetOf(lsp)
            }
        }
        resources.forEach { relation ->
            relations.compute(relation.master) { _, state ->
                if (state != null) {
                    synchronized(state) {
                        val outdated = state.find { it.slave == relation.slave && it.rev < relation.rev }
                        if (outdated != null) state.remove(outdated)
                        state.add(relation)
                        state
                    }
                }
                else
                    mutableSetOf(relation)
            }
        }
    }

    override fun lookup(viewer: Resource, addr: Addr): Resource {
        return relations[viewer.id]?.let { set ->
            synchronized(set) {
                val matching = set.filter { it.slave.matches(addr) }
                when {
                    matching.isEmpty() -> null
                    matching.size != 1 -> throw FireflyNetworkException(ErrorCode.AMBIGUOUS)
                    else -> matching.firstOrNull()?.let { rel ->
                        resources[rel.slave]
                    }
                }
            }
        } ?: throw FireflyNetworkException(ErrorCode.UNREACHABLE)
    }

    override fun lookup(viewer: Resource, label: String): Resource {
        TODO("Label-based lookup is not implemented yet")
    }

    override fun create(owner: Resource, id: Id, type: Proto): Resource =
        when (type) {
            is GenericProto ->
                GenericRemoteResource(id, type)
            //TODO: NodeProto, LinkProto, TaskProto, etc.
            else -> throw FireflyNetworkException(ErrorCode.INTERNAL)
        }

    override fun destroy(owner: Resource, target: Id) {
        relations[owner.id]?.apply {
            synchronized(this) {
                // consider only ownership links
                val matching = filter { it.kind != 0 && it.slave == target }
                when {
                    matching.isEmpty() -> throw FireflyNetworkException(ErrorCode.UNREACHABLE)
                    matching.size != 1 -> throw FireflyNetworkException(ErrorCode.AMBIGUOUS)
                    else -> matching.firstOrNull()?.let { rel ->
                        resources.remove(rel.slave)
                        remove(rel)
                    }
                }
            }
        }
    }

    override fun transfer(owner: Resource, beneficiary: Resource, property: Id) {
        TODO("Not yet implemented")
    }

    override fun share(owner: Resource, beneficiary: Resource, property: Id) {
        TODO("Not yet implemented")
    }

    override fun nextNonceFor(origin: Addr): Nonce {
        TODO("Not yet implemented")
    }

    override fun routeMessage(from: Addr, to: Addr, type: PacketType, payload: Bytes, nonce: Nonce) {
        TODO("Not yet implemented")
    }

    override fun routeError(from: Addr, to: Addr, code: ErrorCode, nonce: Nonce) {
        TODO("Not yet implemented")
    }
}
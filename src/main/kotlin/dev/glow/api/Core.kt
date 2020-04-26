package dev.glow.api

import dev.glow.firefly.network.FireflyContext
import kotlinx.serialization.*
import java.util.concurrent.CompletableFuture

enum class ErrorCode(val code: Int) {
    // (may be retryable) internal error on some node along the path (or the destination resource provider)
    INTERNAL(0),
    // (fatal) destination address is unreachable or there is no such resource (anymore)
    UNREACHABLE(1),
    // (correctable) the address matches multiple ids
    AMBIGUOUS(2),
    // (correctable) the message was too big for the destination resource provider to handle
    TOO_BIG(3),
    // (retryable) resource provider handles too many requests per second,
    // and wants the client to initiate retry with exponential backoff (with ~50% jitter)
    TOO_FAST(4),
    // (fatal) the message is doesn't match the protocol of the resource or not understood
    PROTO(5),
    // (fatal) the message matches the protocol but fails to adhere to the higher-level contract
    // on the contents of the fields in the message or sequencing of the messages
    VIOLATION(6)
}

annotation class Size(val size: Int)
annotation class Message

@Serializable
data class SessionKeys(val rx: AeadKey, val tx: AeadKey)

@Serializable
data class Bytes(val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Bytes
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int = value.contentHashCode()
}

// public key - ed25519
@Serializable
data class Id(@Size(32) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Id
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int = value.contentHashCode()
}

// secret key for Id
@Serializable
data class SecretKey(@Size(32) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as SecretKey
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int = value.contentHashCode()
}

// signature of Id key
@Serializable
data class Signature(@Size(64) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Signature
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int {
        return value.contentHashCode()
    }

}

// address - any uniquely identifying prefix of Id
@Serializable
data class Addr(val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Addr
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int = value.contentHashCode()
}

// public key in key exchange phase
@Serializable
data class PubKey(@Size(32) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as PubKey
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int = value.contentHashCode()
}

// symmetric key for AEAD constuction used in packet auth
@Serializable
data class AeadKey(@Size(32) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as AeadKey
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int  = value.contentHashCode()
}

// for reference, the size of AEAD tag
@Serializable
data class MAC(@Size(16) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as MAC
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int  = value.contentHashCode()
}

// nonce that identifies each request,
// big endian unix epoch seconds in the upper 64 bits (8 first bytes on the wire)
// big endian number counter in the lower bits
@Serializable
data class Nonce(@Size(24) val value: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Nonce
        if (!value.contentEquals(other.value)) return false
        return true
    }

    override fun hashCode(): Int = value.contentHashCode()
}

@Serializable
data class KeyExchange(
        val id: Id,                         // the id of the node that wants to establish link
        val pk: PubKey,                     // public key used for key exchange
        val signature: Signature            // signed by network secret key i.e. a system or federation key
)

@Serializable
data class LinkClass(
    val speed: Int,                         // Long(1 + log10(transfer speed in kb/s)), e.g. 56kbps modem link gets speed class 1
    val latency: Int,                       // Long(1 - log10(rtt of packets in seconds))
    // links with latency class 0 and below cannot be data-link(s)
    // special value: 127 - immediate (shared memory)
    val flags: Int                          // bits:
    // 0 - data link (vs command links that do not route other packets)
    // 1 - reliable (true for TCP, RDP, etc.)
    // 2 - glow packets are ordered (true in TCP, SCTP)
    // 3 - encrypted link (by itself, Glow always does packet encryption)
)

// Link State Packet
@Serializable
data class LSP(
        val from: Id,                            // Id of link resource on originator node (in connection-oriented links - client)
        val to: Id,                              // Id of link resource on destination node (in connection-oriented links - server)
        val state: Int,                          // 0 - down, 1 - up, other values might be added in the future
        val mtu: Int,                            // dynamic value for conservative estimate, means MTU is no less then this value
        val clazz: LinkClass,                    // originally class but names are not part of type in FireFly anyhow
        val rev: Int
)

// Relation - a part of establishing Ownership or Uses relation
@Serializable
data class Relation(
        val kind: Int,                           // 0 - uses, 1 - owns
        val master: Id,                          // master is a resource who uses or owns slave
        val slave: Id                            // slave is a resource used or owner by master
)

// Firefly Network packet
@Serializable
data class Packet(
        val src: Addr,
        val dest: Addr,
        val nonce: Nonce,
        val type: Int,                           // 0:message, 1:request, 2:response, 3:error, 4:cancellation request
        val offset: Int,                         // offset for this fragment
        val size: Int,                           // total size of the full packet, to allow early reject by destination node
        val payload: Bytes,
        val mac: MAC
)

// All resources implement this proto, with funault implementations for all of methods
// usually provided by the Glow run-time
interface Resource {
    // the id of the resource
    val id: Id
    // human readable label of this resource
    fun label(fly: FireflyContext): String

    // change label of this resource
    fun relabel(fly: FireflyContext, label: String)
    
    // human readable form of the resource contents
    fun describe(fly: FireflyContext): String

    // transfer ownership to a new owner, must have `access` to `newOwner` Id (ownership is not required)
    // any resource has `access` to its owner and any resource in the transitive closure of owned resources
    fun transfer(fly: FireflyContext, newOwner: Id)
}

// Meta self-description of a protocol with proto interface
interface Proto {
    fun extends(): List<Id>
    fun methods(): List<Method>
}

@Serializable
data class Parameter(
    val name: String,
    val type: String
)

@Serializable
data class Method(
        val name: String,
        val params: List<Parameter>,
        val returnType: String
)

// For any message the sender knows its nonce
// every time there is a need for signature in the proto method,
// that nonce of the message is prepended during computation
// signature = Sign(nonce || flatten(args - signature))
interface Node : Resource {
    // These messages should be sent by both parties simultaneously
    @Message
    fun start(fly: FireflyContext, kx: KeyExchange)
    // Establish our side of link with this node by sending our key (encrypted)
    @Message
    fun establish(fly: FireflyContext, kxNonce: Nonce, encryptedKey: AeadKey)

    // HB is sent over established links periodically with cluster addr as destination
    // First case - if there is any change detected in state (by rev field) - flooded to all neighbours except this one
    // Second case - if a new node is discovered - floods to the new node
    // (both could apply)
    @Message
    fun heartbeat(fly: FireflyContext, links: List<LSP>, resources: List<Relation>)

    // label is a human-readable name (must follow a convention and be node-wide unique)
    // must be sent by the owner of this `node` resource
    // owner of `node` may choose to  create on behalf of somebody and transfer the resource in the next step
    // (how such arrangements are done is outside of Firefly network charter)
    fun create(fly: FireflyContext, label: String, type: Id, id: Id): CompletableFuture<Id>

    // same for reverse operation, must be sent by owner of `id` or by `id` itself
    fun destroy(fly: FireflyContext, id: Id): CompletableFuture<Unit>
}


// A runnable task bound, has implicit use relation to all of the resources of the owner (parent) resource
// Sand-boxing is as simple as creating a Task using the private key and Id(entity) of some constrained owner resource
//
interface Task {
    fun configure()
}

// Link has a unique contract
// Owner task gets a separate send/recv raw packet queues
// either via shared memory with the node process or in an platform-specific embedding mode
// Normally each process has exactly one send and one recv packet queue and it's packets are
// processed by the node (signatures etc.)
interface Link {
    // a packet that will hit the routing framework of the link's parent node (msg is sent by link's task)
    @Message
    fun outbound(packet: Packet)
    // packet that is to be sent though this link (msg sent by this node)
    @Message
    fun inbound(packet: Packet)
    // configure link parameters
    fun configure(up: Long, mtu: Long, clazz: LinkClass)
}

// Foreign network interface

interface FNI {
    // protocol argument is one of URI strings for the scheme part
    // For Flows:
    //  udp
    //  rdp
    //  ...
    // For Sequence:
    //  tcp
    //  ws/wss
    //  http/https
    //  file
    //  ...

    // Provides a Sequence that also has FNI Socket configuration capabilities
    fun sequence(protocol: Bytes): SequenceSocket

    // Provides a Flow that also has FNI Socket configuration capabilities
    fun flow(protocol: Bytes): FlowSocket
}

// FNI socket, in reality it's a connection pool for sequential sockets
interface Socket {
    // binds to a specific f(oreign) n(etwork) a(ddress)
    fun bind(fna: String)

    // connects this pool to the given f(oreign) n(etwork) a(ddress)
    fun connect(fna: String)

    // unlike in BSD's sockets - all connections are automatically and implicitly accepted on the very same object
    // right after listen call
    // connections are identified by sess(ion) parameter values of Sequence proto interface
    fun listen(backlog: Long)

    // closes the socket (pool) but keeps associated bind parameters intact
    fun close()
}

// A base proto for resources which can be (un)subscribed to
// in order to receive msg's from them
interface Publisher {
    fun subscribe(id: Id)
    fun unsubscribe(id: Id)
}

// In order sequence of messages, think TCP or (more properly so) SCTP and QUIC
interface Sequence : Publisher {
    // seqNum == 0 -> new stream of data, start of a new sequential stream
    // seqNo wraps around after 2^48 - 1 but to one, not to zero(!)
    // seqNo 2^^48 is written as 1 and sequential process is continued as 2, 3, ...
    fun write(stream: Long, seqNo: Long, data: Bytes)

    // if abrupt != 0 -> terminate forcibly (e.g. cancel transaction)
    fun end(stream: Bytes, abrupt: Boolean)
}

// Out of order flow of messages, think UDP and media streaming protocols
interface Flow : Publisher {
    // dest is usually a foreign (sub-)address, use 0-length if not applicable
    @Message
    fun write(dest: Bytes, datagram: Bytes)
}

interface FlowSocket : Socket, Flow

interface SequenceSocket : Socket, Sequence


package org.glow

import org.glow.proto.Error
import org.glow.proto.FireflyTypeSystem
import org.glow.proto.Got
import org.glow.proto.ProtoCompiler
import org.glow.proto.Type
import org.junit.Test
import java.lang.Exception
import kotlin.test.assertEquals
import kotlin.test.fail

class ProtoCompilerTest {

    @Test
    fun types() {
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        assertEquals(Got(Type.Alias("this_id0123456789", ts)), c.type.parse("this_id0123456789["))
        assertEquals(Got("_"), c.id.parse("_."))
        assertEquals(Error("id", 0), c.id.parse("1."))
        assertEquals(Got(1), c.number.parse("1."))
        assertEquals(Got(20), c.number.parse("20"))
        assertEquals(Got(Type.Literal(20)), c.genericTypeArg.parse("20"))
        assertEquals(Got(Type.Byte), c.genericTypeArg.parse("byte"))
        assertEquals(Got(Type.VarInt), c.builtinType.parse("int"))
        assertEquals(Got(Type.Generic("Array", listOf(Type.Byte, Type.Literal(20)))), c.genericType.parse("Array[byte, 20]"))
        val struct = Type.Struct("a" to Type.Alias("C", ts), "b" to Type.Byte)
        assertEquals(Got("A" to struct), c.typeDef.parse("type A = struct { a:C b:byte }"))
        val proto = Type.Protocol(
                "P",
                listOf(Type.Alias("E", ts), Type.Alias("F", ts)),
                listOf(
                        Type.Method(
                                Type.MethodKind.CALL, "fn",
                                listOf("b" to Type.Alias("B", ts), "c" to Type.Alias("C", ts)),
                                Type.Alias("D", ts)
                        ),
                        Type.Method(
                                Type.MethodKind.MESSAGE, "message123",
                                emptyList(),
                                Type.Unit
                        )
                )
        )
        assertEquals(Got("P" to proto), c.protoDef.parse("proto P : E, F { def fn(b: B, c: C):D \n msg message123() }"))
    }

    @Test
    fun comments() {
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        val id = c.type.parse("//abcdef \n identifier")
        assertEquals(Got(Type.Alias("identifier", ts)), id)
        val type = c.type.parse("// comment\nstruct {// and here\n a: //here\n A next: int // there \n}")
        assertEquals(Got(Type.Struct("a" to Type.Alias("A", ts), "next" to Type.VarInt)), type)

        val parsed = c.protoDef.parse("""
            proto Publisher { 
            /********************************
                Multi-line comment
            *********************************/
                def subscribe(id: Id): void
                def unsubscribe(id: Id): void
            }
        """)
        val proto = Type.Protocol("Publisher", emptyList(),
                listOf(
                        Type.Method(Type.MethodKind.CALL, "subscribe", listOf("id" to Type.Alias("Id", ts)), Type.Unit),
                        Type.Method(Type.MethodKind.CALL, "unsubscribe", listOf("id" to Type.Alias("Id", ts)), Type.Unit)
                )
        )
        assertEquals(Got("Publisher" to proto), parsed)
    }

    @Test
    fun module() {
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        val mod = c.module.parse("type A = Array[byte, 20]\n proto B { def call(a: A, b: A) }")
        assert(mod is Got)
        val mod2 = c.module.parse("""
            // May change in future
            type Id = Array[byte, 32]             // public key - ed25519
            type SecretKey = Array[byte, 32]      // secret key for Id
            type Signature = Array[byte, 64]      // signature of Id key
            type Addr = Array[byte]               // address - any uniquely identifying prefix of Id

            type PubKey = Array[byte, 32]         // public key in key exchange phase
            type AeadKey = Array[byte, 32]        // symmetric key for AEAD constuction used in packet auth

            type MAC = Array[byte, 16]            // for reference, the size of AEAD tag
            type Nonce = Array[byte, 24]          // nonce that identifies each request, big endian number
                                                  // counter in lower bits
                                                  // unix epoch millis in 64 upper bits (8 first bytes on the wire)

            type String = Array[byte]             // UTF-8 human-readable string, often used as labels or tags

            type KeyExchange = struct {
                id: PubKey
                pk: PubKey
                signature: Signature               // signed by network secret key i.e. a system or federation key
            }

            type LinkClass = struct {
                speed: int                         // int(1 + log10(transfer speed in kb/s)), e.g. 56kbps modem link gets speed class 1
                latency: int                       // int(1 - log10(rtt of packets in seconds))
                                                   // links with latency class 0 and below cannot be data-link(s)
                                                   // special value: 127 - immediate (shared memory)
                flags: int                         // bits:
                                                   // 0 - data link (vs command links that do not route other packets)
                                                   // 1 - reliable (true for TCP, RDP, etc.)
                                                   // 2 - glow packets are ordered (true in TCP, SCTP)
                                                   // 3 - encrypted link (by itself, Glow always does packet encryption)
            }

            // Link State Packet
            type LSP = struct {
                from: Id                            // Id of link resource on originator node (in connection-oriented links - client)
                to: Id                              // Id of link resource on destination node (in connection-oriented links - server)
                state: int                          // 0 - down, 1 - up, other values might be added in the future
                mtu: int                            // dynamic value for conservative estimate, means MTU is no less then this value
                class: LinkClass
                rev: int
            }

            // Relation - a part of establishing Ownership or Uses relation
            type Relation = struct {
                kind: int                           // 0 - uses, 1 - owns
                master: Id                          // master is a resource who uses or owns slave
                slave: Id                           // slave is a resource used or owner by master
            }

            // Resource Id with Id of its type (=proto) as tuple
            type Resource = struct {
                type: Id                            // Id of resource type, points to existing Protocol resource
                id: Id                              // Id of the resource itself
            }

            // Firefly Network packet
            type Packet = struct {
                src: Addr
                dest: Addr
                nonce: Nonce
                type: int                           // message, request, response, error, cancel
                offset: int                         // offset for this fragment
                size: vu                            // total size of the full packet, to allow early reject by destination node
                payload: Array[byte]
                mac: MAC
            }

            // All resources implement this proto, with default implementations for all of methods
            // usually provided by the Glow run-time
            proto Resource {
                // Human readable form of the resource contents
                def describe(): String
            }

            // Meta self-description of a protocol with proto interface
            proto Proto {
                def extends(): Array[Id]
                def methods(): Array[Method]
            }

            type Parameter = struct {
                name: String
                type: String
            }

            type Method = struct {
                name: String
                params: Array[Parameter]
                returnType: String
            }

            // For any message the sender knows its nonce
            // every time there is a need for signature in the proto method,
            // that nonce of the message is prepended during computation
            // signature = Sign(nonce || flatten(args - signature))
            proto Node {
                // These messages should be sent by both parties simultaneously
                msg start(kx: KeyExchange)
                // Establish our side of link with this node by sending our key (encrypted)
                msg establish(kxNonce: Nonce, encryptedKey: AeadKey)

                // HB is sent over established links periodically with cluster addr as destination
                // First case - if there is any change detected in state (by rev field) - flooded to all neighbours except this one
                // Second case - if a new node is discovered - floods to the new node
                // (both could apply)
                msg heartbeat(links: array[LSP], resources: Array[Relation])

                // label is a human-readable name (must follow a convention and be node-wide unique)
                // signature is done by key for id
                def create(label: String, type: Id, id: Id, signature: Signature): Id

                // same for reverse operation, needs secret key for that resource Id
                def destroy(id: Id, signature: Signature): void
            }


            // A runnable task bound, has implicit use relation to all of the resources of the owner (parent) resource
            // Sand-boxing is as simple as creating a Task using the private key and Id(entity) of some constrained owner resource
            //
            proto Task {
                def configure(): void
            }

            // Link has a unique contract
            // Owner task gets a separate send/recv raw packet queues
            // either via shared memory with the node process or in an platform-specific embedding mode
            // Normally each process has exactly one send and one recv packet queue and it's packets are
            // processed by the node (signatures etc.)
            proto Link {
                // a packet that will hit the routing framework of the link's parent node (msg is sent by link's task)
                msg outbound(packet: Packet)
                // packet that is to be sent though this link (msg sent by this node)
                msg inbound(packet: Packet)
                // configure link parameters
                def configure(up: int, mtu: int, class: LinkClass): void
            }

            // Foreign network interface

            proto FNI {
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
                def sequence(protocol: Array[byte]): Sequence & Socket

                // Provides a Flow that also has FNI Socket configuration capabilities
                def flow(protocol: Array[byte]): Flow & Socket
            }

            // FNI socket, in reality it's a connection pool for sequential sockets
            proto Socket {
                // binds to a specific f(oreign) n(etwork) a(ddress)
                def bind(fna: String): void

                // connects this pool to the given f(oreign) n(etwork) a(ddress)
                def connect(fna: String): void

                // unlike in BSD's sockets - all connections are automatically and implicitly accepted on the very same object
                // right after listen call
                // connections are identified by sess(ion) parameter values of Sequence proto interface
                def listen(backlog: int): void

                // closes the socket (pool) but keeps associated bind parameters intact
                def close(): void
            }

            // A base proto for resources which can be (un)subscribed to
            // in order to receive msg's from them
            proto Publisher {
                def subscribe(id: Id): void
                def unsubscribe(id: Id): void
            }

            // In order sequence of messages, think TCP or (more properly so) SCTP and QUIC
            proto Sequence : Publisher {
                // seqNum == 0 -> new stream of data, start of a new sequential stream
                // seqNo wraps around after 2^48 - 1 but to one, not to zero(!)
                // seqNo 2^^48 is written as 1 and sequential process is continued as 2, 3, ...
                def write(stream: int, seqNo: int, data: Array[u8]): void

                // if abrupt != 0 -> terminate forcibly (e.g. cancel transaction)
                def end(stream: Array[byte], abrupt: int)
            }

            // Out of order flow of messages, think UDP and media streaming protocols
            proto Flow : Publisher {
                // dest is usually a foreign (sub-)address, use 0-length if not applicable
                msg write(dest: Array[byte], datagram: Array[byte])
            }
        """.trimIndent())
        assert(mod2 is Got)
    }

    @Test
    fun parseCoreProtos() {
        val core = this::class.java.getResourceAsStream("/core.firefly")?.readAllBytes()?.let {
            String(it, Charsets.UTF_8)
        } ?: throw Exception("Failed to load core.firefly")
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        println(core)
        val mod = c.module.parse(core)
        when(mod) {
            is Error ->
                fail("Failed to parse core spec of Firefly\ncore.firefly:${mod.format(core)}")
            else -> {

            }
        }
    }
}
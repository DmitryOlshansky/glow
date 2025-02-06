import { FireFly } from "./type.js"
import { ProtoCompiler } from "./compiler.js"
import * as peg from "./peg.js"
import * as serde from "./serde.js"
import { v4 } from 'uuid'
import * as fs from 'node:fs'

const protocolDefinition = fs.readFileSync("./src/core.firefly").toString()
const system = FireFly()
const compiler = new ProtoCompiler(system)
const s = new peg.State(protocolDefinition, 0)
const module = compiler.module.parse(s).value

class Resource {
    id; // UUID
    owner; // object of Resource type that owns this resource, null if Node
    proto; // protocol of this resource
    constructor(id, owner, proto) {
        this.id = id   
        this.owner = owner
        this.proto = proto
    }

    methods() {
        const extended = [...this.proto.extended.map(x => x.methods)]
        const all = [...extended, ...this.proto.methods]
        return all
    }

    methodToIndex(method) {
        const methods = this.methods()
        let index = -1
        for (let i = 0; i< methods.length; i++) {
            if (methods[i].name == method) {
                index = i
                break
            }
        }
        return index
    }

    indexToMethod(index) {
        const methods = this.methods()
        if (index >= methods.length) {
            throw new Error(`Method index ${index} is unresolvable for ${resource.name}`)
        }
        return methods[index]
    }
}

class RemoteNode extends Resource {
    /*
        resource is a map of resources of this Node
    */
    resources;
    constructor(id, resources) {
        super(id, null, module.members['Node'])
        this.resources = resources
        this.resources[id] = this
    }
}

export class Node extends Resource {
    /*
        resources is a map of resources of this Node
        { resID : Resource} } 
         includes self as nodeId: Node
    */
    resources;
    /* peerId -> Link */
    links;
    /* map of nodes in this cluster { id: Node } */
    nodes;
    // packets awaiting reply, nonce -> { dest: Id, resolve: fn, reject: fn }
    packets;
    // packet serde
    packetSerde;

    constructor(id, timer) {
        super(id, null, module.members['Node'])
        this.timer = timer
        this.resources = {}
        this.resources[id] = this
        this.links = {}
        this.nodes = {}
        this.nodes[this.id] = this
        this.packets = {}
        this.packetSerde = module.members['Packet'].serializer()
    }

    outbound(packet) {
        let unreachable = true
        for (const key in this.nodes) {
            if (packet.dest in this.nodes[key].resources || packet.dest == key) {
                this.links[key].outbound(packet)
                unreachable = false
                break
            }
        }
        if (unreachable) throw Error(`${packet.dest} is unreachable`)
    }

    inbound(packet) {
        console.log(packet)
        if (packet.dest in this.resources) {
            const resource = this.resources[packet.dest]
            const method = resource.indexToMethod(packet.method)
            if (packet.type == 1 || packet.type == 0) {
                const args = method.serializer().deser(serde.stream(packet.payload))
                const ret = resource[method.name](...args)
                const respStream = serde.stream(1<<14)
                method.returnSerializer().ser(ret, respStream)
                // reply
                if (packet.type == 1) {
                    this.outbound({
                        src: resource.id,
                        dest: packet.src,
                        nonce: packet.nonce,
                        method: packet.method,
                        type: 2,
                        offset: 0,
                        size: 0,
                        payload: respStream.toArray()
                    })
                }
            } else if (packet.type == 2) {
                const entry = this.packets[packet.nonce]
                delete this.packets[packet.nonce]
                const ret = method.returnSerializer().deser(serde.stream(packet.payload))
                entry.resolve(ret)
            }
        } else {
            // TODO: here we select the right next hop if possible
            console.error(`Packet needs routing ${packet.dest}`)
        }
    }

    addLink(to, transport) {
        const link = new Link(genId(), this, this.id, to, this.packetSerde, transport)
        this.nodes[to] = new RemoteNode(to, {})
        this.links[to] = link
    }

    call(dest, method, ...args) {
        let resolve = null
        let reject = null
        const promise = new Promise((res, rej) => {
            resolve = res
            reject = rej
        })
        if (dest in this.resources) {
            try {
                const res = this.resources[dest]
                const ret = res[method](...args)
                resolve(ret)
            } catch(e) {
                reject(e)
            }
            return promise
        }
        const resource = this.lookupResource(dest)
        if (resource == null) {
            reject(new Error(`Address ${dest} is unreachable`))
            return promise
        }
        const index = resource.methodToIndex(method)
        if (index == -1) {
            reject(new Error(`Resource at ${dest} doesn't support ${method}`))
            return promise
        }
        const all = resource.methods()
        const stream = serde.stream(1<<14)
        const serializer = all[index].serializer()
        serializer.ser([...args], stream)
        const packet = {
            src: this.id,
            dest: dest,
            nonce: this.genNonce(),
            method: index,
            type: all[index].methodKind == "msg" ? 0 : 1,
            offset: 0, //TODO: handle fragmentation in the link
            size: 0, //TODO: calculate size for fragmentation
            payload: stream.toArray()
        }
        if(packet.type == 1) {
            this.packets[packet.nonce] = { dest: packet.id, resolve, reject }
        }
        this.outbound(packet)
        return promise
    }

    loop() {
        // send Heartbeats
        for (const id in this.nodes) {
            if (id == this.id) continue
            this.call(id, "heartbeat", [

                ], this.resources.map(r => {
                    return { kind: 1, master: this.id, slave: r.id, proto: r.proto.name }
                })
            )
        }
    }

    lookupResource(dest) {
        let resource = null
        for (const nodeId in this.nodes) {
            const node = this.nodes[nodeId]
            if (dest in node.resources) {
                resource = node.resources[dest]
            }
        }
        return resource
    }

    genNonce() {
        const s = serde.stream(24)
        const a = []
        a[23] = 1
        const arr = new Uint8Array(a)
        s.writeBytes(arr)

        return s.toArray()
    }

    // protocol implementation
    ping(data) {
        return data
    }
}


class Link extends Resource {
    from;
    to;
    packetSerde;
    constructor(id, owner, from, to, packetSerde, transport) {
        super(id, owner, module.members['Link'])
        this.from = from
        this.to = to
        this.packetSerde = packetSerde
        this.transport = transport
        this.transport.onReceive(x => this.inbound(x))
    }

    inbound(data) {
        const packet = this.packetSerde.deser(serde.stream(data))
        this.owner.inbound(packet) // hit our Node in future need to dispatch to process
    }

    outbound(packet) {
        const buf = serde.stream(1<<14)
        this.packetSerde.ser(packet, buf)
        this.transport.send(buf.toArray())
    }
}

export function genId() {
    const buf = new Uint8Array(new ArrayBuffer(16))
    v4({}, buf, 0)
    return buf
}

export function transportPair() {
    const first = {
        onReceive: (handler) => {
            first.receive = handler
        }
    }
    const second = {
        onReceive: (handler) => {
            second.receive = handler
        }
    }
    first.send = (data) => second.receive(data)
    second.send = (data) => first.receive(data)
    return [first, second]
}


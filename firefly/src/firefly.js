import { FireFly } from "./type.js"
import { ProtoCompiler } from "./compiler.js"
import * as peg from "./peg.js"
import * as serde from "./serde.js"
import { v4 } from 'uuid'
import * as fs from 'node:fs'
import * as prmoisesFs from 'node:fs/promises'

const protocolDefinition = fs.readFileSync("./src/core.firefly").toString()
const system = FireFly()
const compiler = new ProtoCompiler(system)
const s = new peg.State(protocolDefinition, 0)
const module = compiler.module.parse(s).value

const HEARTBEAT = 1000

const MessageType = {
    MSG: 0,
    REQUEST: 1,
    REPLY: 2,
    ERROR: 3,
    CANCELLATION: 4
}

const LinkFlags = {
    DATA_LINK: 1,
    RELIBLE: 2,
    ORDERED: 4,
    ENCRYPTED: 8
}

class Resource {
    id; // UUID
    owner; // object of Resource type that owns this resource, this if Node
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
        super(id, null, module.proto('Node'))
        this.owner = this
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
    // nonce counter
    nonceCounter;

    constructor(id, timer) {
        super(id, null, module.proto('Node'))
        this.owner = this
        this.timer = timer
        this.resources = {}
        this.resources[id] = this
        this.links = {}
        this.nodes = {}
        this.nodes[this.id] = this
        this.packets = {}
        this.nonceCounter = 0
        this.packetSerde = module.members['Packet'].serializer()
        this.timer.setInterval(HEARTBEAT, () => this.loop())
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
        const onError = (e) => {
            const errorStream = serde.stream(1<<14)
            serde.String.ser(e.toString(), errorStream)
            this.outbound({
                src: packet.dest,
                dest: packet.src,
                nonce: packet.nonce,
                method: packet.method,
                type: MessageType.ERROR,
                offset: 0,
                size: 0,
                payload: errorStream.toArray()
            })
        }
        if (packet.dest in this.resources) {
            if (packet.type == 1 || packet.type == 0) {
                try {
                    const resource = this.resources[packet.dest]
                    const method = resource.indexToMethod(packet.method)
                    const args = method.serializer().deser(serde.stream(packet.payload))
                    const ret = Promise.resolve(resource[method.name](...args))
                    ret.then(value => {
                        const respStream = serde.stream(1<<14)
                        method.returnSerializer().ser(value, respStream)
                        // reply
                        if (packet.type == 1) {
                            this.outbound({
                                src: resource.id,
                                dest: packet.src,
                                nonce: packet.nonce,
                                method: packet.method,
                                type: MessageType.REPLY,
                                offset: 0,
                                size: 0,
                                payload: respStream.toArray()
                            })
                        }
                    }, onError)
                    
                } catch(e) {
                    onError(e)
                }
            } else if (packet.type == MessageType.REPLY) {
                const resource = this.lookupResource(packet.src)
                const method = resource.indexToMethod(packet.method)
                const entry = this.packets[packet.nonce]
                delete this.packets[packet.nonce]
                const ret = method.returnSerializer().deser(serde.stream(packet.payload))
                entry.resolve(ret)
            } else if (packet.type == MessageType.ERROR) {
                const entry = this.packets[packet.nonce]
                delete this.packets[packet.nonce]
                const error = new Error(serde.String.deser(serde.stream(packet.payload)))
                entry.reject(error)
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

    addResource(resource) {
        this.resources[resource.id] = resource
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
                if (typeof ret?.then == 'function') {
                    return ret
                }
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
            type: all[index].methodKind == "msg" ? MessageType.MSG : MessageType.REQUEST,
            offset: 0, //TODO: handle fragmentation in the link
            size: 0, //TODO: calculate size for fragmentation
            payload: stream.toArray()
        }
        if(packet.type == MessageType.REQUEST) {
            this.packets[packet.nonce] = { dest: packet.id, resolve, reject }
        }
        this.outbound(packet)
        return promise
    }

    loop() {
        // send Heartbeats
        for (const id in this.nodes) {
            if (id == this.id) continue
            const relations = []
            for (const resId in this.resources) {
                const r = this.resources[resId]
                relations.push({ kind: 1, master: this.id, slave: r.id, proto: r.proto.name })
            }
            this.call(this.nodes[id].id, "heartbeat", [], relations)
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
        const cnt = this.nonceCounter++
        if (cnt == (1<<30)) {
            this.nonceCounter = 0
        }
        const a = []
        writeNumber64(cnt, a, 0)
        writeNumber64(Date.now(), a, 8)
        
        const arr = new Uint8Array(a)

        return arr
    }

    // protocol implementation
    ping(data) {
        return data
    }

    heartbeat(lsp, relations) {
        const nodes = {}
        nodes[this.id] = this
        for (const rel of relations) {
            if (!(rel.master in nodes)) nodes[rel.master] = new RemoteNode(rel.master, {})
            nodes[rel.master].resources[rel.slave] = new Resource(rel.slave, nodes[rel.master], module.proto(rel.proto))
        }
        this.nodes = nodes
    }
}


class Link extends Resource {
    from;
    to;
    packetSerde;
    constructor(id, owner, from, to, packetSerde, transport) {
        super(id, owner, module.proto('Link'))
        this.from = from
        this.to = to
        this.packetSerde = packetSerde
        this.transport = transport
        this.transport.onReceive(x => this.inbound(x))
    }

    inbound(data) {
        const packet = this.packetSerde.deser(serde.stream(data))
        this.owner.inbound(packet) // hit our Node in the future need to dispatch to process
    }

    outbound(packet) {
        const buf = serde.stream(1<<14)
        this.packetSerde.ser(packet, buf)
        this.transport.send(buf.toArray())
    }
}

export class InMemoryKV extends Resource {
    kv;
    constructor(id, owner) {
        super(id, owner, module.proto('KV'))
        this.kv = {}
    }

    // list keys starting at offset and upto size items
    // def list(offset: int, size: int): Array[String]
    list(offset, size) {
        const items = []
        for (const key in this.kv) {
            items.push(key)
        }
        items.sort((a,b) => a < b)
        const clamp = (x) => x < items.length ? x : items.length
        return items.slice(clamp(offset), clamp(offset+size))
    }
    // get value by key
    // def get(key: String): Array[byte]
    get(key) {
        if (!(key in this.kv)) throw Error(`Key "${key}" not found in this kv`)
        return this.kv[key]
    }
    // put value by key
    // def put(key: String, value: Array[byte]): void
    put(key, value) {
        this.kv[key] = value
    }
}

export class LocalFS extends Resource {
    constructor(id, owner) {
        super(id, owner, module.proto('FileSystem'))
        this.fds = []
    }

    async open(path, mode) {
        const handle = await prmoisesFs.open(path, mode)
        for (let i = 0; i < this.fds.length; i++) {
            if (this.fds[i] === null) {
                this.fds[i] = handle
                return i
            }
        }
        const fd = this.fds.length
        this.fds.push(handle)
        return fd
    }

    async read(fd, size) {
        const handle = this.fds[fd]
        const result = await handle.read({ buffer: Buffer.alloc(size), length: size })
        if (result.bytesRead == 0)
            return new Uint8Array()
        return new Uint8Array(result.buffer.subarray(0, result.bytesRead))
    }

    async write(fd, buf) {
        const handle = this.fds[fd]
        await handle.write(buf)
    }

    async close(fd) {
        const handle = this.fds[fd]
        this.fds[fd] = null
        return await handle.close()
    }
}

export function genId() {
    const buf = new Uint8Array(new ArrayBuffer(16))
    v4({}, buf, 0)
    return buf
}

function writeNumber64(value, arr, offset) {
    for (let i = offset; i < offset + 8; i++) {
        arr[i] = value & 0xFF
        value >>= 8
    }
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


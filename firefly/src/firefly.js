import { FireFly } from "./type.js"
import { ProtoCompiler } from "./compiler.js"
import { Stream } from "./stream.js"
import * as peg from "./peg.js"
import * as serde from "./serde.js"
import { v4 } from 'uuid'
import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'

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
    CANCELLATION: 4,
    REQUEST_STREAM: 5,
    REPLY_STREAM: 6,

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
        this.streams = {}
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
        if (packet.dest in this.resources) {
            if (packet.type == MessageType.REQUEST || packet.type == MessageType.MSG) {
                try {
                    const resource = this.resources[packet.dest]
                    const method = resource.indexToMethod(packet.method)
                    const args = method.serializer().deser(serde.stream(packet.payload))
                    const withStreams = []
                    for (let i = 0; i< method.args; i++) {
                        if (method.args[i].kind == 'stream') {
                            const s = new Stream()
                            if (!(packet.nonce in this.stream)) this.streams[packet.nonce] = {}
                            this.streams[packet.nonce][method.args[i].id] = s
                            withStreams.push(s)
                        } else {
                            withStreams.push(args[i])
                        }
                    }
                    const ret = resource[method.name](...withStreams)
                    const respStream = serde.stream(1<<14)
                    if (ret && ret.kind == 'Stream') {
                        method.returnSerializer().ser([method.ret.id, []], respStream)    
                    } else {
                        method.returnSerializer().ser(ret, respStream)
                    }
                    // reply
                    if (packet.type == MessageType.REQUEST) {
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
                    if (method.ret.kind == 'stream') {
                        ret.onData((data) => {
                            const s = serde.stream(data.length + 8) // TODO: wont work for streams other than bytes 
                            method.returnSerializer().ser([method.ret.id, data], s)
                            this.outbound({
                                src: resource.id,
                                dest: packet.src,
                                nonce: packet.nonce,
                                method: packet.method,
                                type: MessageType.REPLY_STREAM,
                                offset: 0,
                                size: 0,
                                payload: s.toArray()
                            })
                        })
                        ret.onError((err) => {
                            const s = serde.stream(1024)
                            serde.String.ser(err.toString(), s)
                            this.outbound({
                                src: resource.id,
                                dest: packet.src,
                                nonce: packet.nonce,
                                method: packet.method,
                                type: MessageType.ERROR,
                                offset: 0,
                                size: 0,
                                payload: s.toArray()
                            })
                        })
                        ret.onClose(() => {
                            const s = serde.stream(100)
                            method.returnSerializer().ser([method.ret.id, []], s)
                            this.outbound({
                                src: resource.id,
                                dest: packet.src,
                                nonce: packet.nonce,
                                method: packet.method,
                                type: MessageType.REPLY_STREAM,
                                offset: 0,
                                size: 0,
                                payload: s.toArray()
                            })
                        })
                    }
                } catch(e) {
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
            } else if (packet.type == MessageType.REPLY) {
                const resource = this.lookupResource(packet.src)
                const method = resource.indexToMethod(packet.method)
                const entry = this.packets[packet.nonce]
                delete this.packets[packet.nonce]
                const ret = method.returnSerializer().deser(serde.stream(packet.payload))
                if (method.ret.kind == 'stream') {
                    const s = new Stream()
                    this.streams[packet.nonce] = s
                    s.write(ret[1]) // TODO: stream ids
                    return entry.resolve(s)
                } else {
                    return entry.resolve(ret)
                }
            } else if (packet.type == MessageType.REPLY_STREAM) {
                const resource = this.lookupResource(packet.src)
                const method = resource.indexToMethod(packet.method)
                const ret = method.returnSerializer().deser(serde.stream(packet.payload))
                this.streams[packet.nonce].write(ret[1]) // TODO: stream ids
                if (ret[1].length == 0) {
                    this.streams[packet.nonce].close()
                    delete this.streams[packet.nonce]
                }
            } else if (packet.type == MessageType.REQUEST_STREAM) {
                const resource = this.lookupResource(packet.src)
                const method = resource.indexToMethod(packet.method)
                const s = serde.stream(packet.payload)
                const id = serde.Base128.deser(s)
                s.rdx = 0
                for (let i = 0; i < method.args.length; i++) {
                    if (method.args[i].kind == 'stream' && method.args[i].id == id) {
                        const data = method.args[i].serializer().deser(s)
                        this.streams[packet.nonce][id].write(data)
                        if (data.length == 0) {
                            delete this.streams[packet.nonce][id]
                            if (Object.keys(this.streams[packet.nonce]).length === 0) {
                                delete this.streams[packet.nonce]
                            }
                        }
                        break
                    }
                }
            } else if (packet.type == MessageType.ERROR) {
                const error = new Error(serde.String.deser(serde.stream(packet.payload)))
                if (packet.nonce in this.streams) {
                    this.streams[packet.nonce].error(error)
                    delete this.streams[packet.nonce]
                } else if (packet.nonce in this.packets) {
                    const entry = this.packets[packet.nonce]
                    delete this.packets[packet.nonce]
                    entry.reject(error)
                } else {
                    console.error(error)
                }
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
        const output = serde.stream(1<<14)
        const serializer = all[index].serializer()
        const toSerialize = []
        const streams = []
        for (let i = 0; i < args.length; i++) {
            const argType = all[index].args[i]
            if (argType.kind == 'stream') {
                toSerialize.push([typeArg.id, []])
                streams.push({ id: typeArg.id, type: argType, stream: args[i] })
            } else {
                toSerialize.push(args[i])
            }
        }
        serializer.ser([...toSerialize], output)
        const packet = {
            src: this.id,
            dest: dest,
            nonce: this.genNonce(),
            method: index,
            type: all[index].methodKind == "msg" ? MessageType.MSG : MessageType.REQUEST,
            offset: 0, //TODO: handle fragmentation in the link
            size: 0, //TODO: calculate size for fragmentation
            payload: output.toArray()
        }
        if(packet.type == MessageType.REQUEST) {
            this.packets[packet.nonce] = { dest: packet.id, resolve, reject }
        }
        this.outbound(packet)
        for (const s in streams) {
            s.stream.onData((data) => {
                const out = serde.stream(data.length + 8) //TODO: only works for bytes
                s.type.serializer().ser([s.id, data], out)
                this.outbound({
                    src: this.id,
                    dest: dest,
                    nonce: packet.nonce,
                    method: index,
                    type: MessageType.REQUEST_STREAM,
                    offset: 0, //TODO: handle fragmentation in the link
                    size: 0, //TODO: calculate size for fragmentation
                    payload: out.toArray()
                })
            })
            s.stream.onError((e) => {
                const msg = e.toString()
                const out = serde.stream(1024)
                serde.String.ser(msg, out)
                this.outbound({
                    src: this.id,
                    dest: dest,
                    nonce: packet.nonce,
                    method: index,
                    type: MessageType.ERROR,
                    offset: 0, //TODO: handle fragmentation in the link
                    size: 0,  //TODO: calculate size for fragmentation
                    payload: out.toArray()
                })
            })
            s.stream.onClose(() => {
                const out = serde.stream(100)
                s.type.serializer().ser([s.id, []], out)
                this.outbound({
                    src: this.id,
                    dest: dest,
                    nonce: packet.nonce,
                    method: index,
                    type: MessageType.REQUEST_STREAM,
                    offset: 0, //TODO: handle fragmentation in the link
                    size: 0, //TODO: calculate size for fragmentation
                    payload: out.toArray()
                })
            })
        }
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
        super(id, owner, module.proto('FS'))
    }

    readPart(fd, stream) {
        fs.read(fd, (err, bytesRead, buf) => {
            if(err) {
                stream.error(err)
            } else if (bytesRead > 0) {
                stream.write(buf)
                this.readPart(fd, stream)
            } else {
                stream.close()
            }
        })
    }

    get(path) {
        const stream = new Stream()
        const rs = fs.createReadStream(path, { highWaterMark: 1024 })
        rs.on('data', (buf) => {
            stream.write(buf)
        })
        rs.on('error', (err) => {
            stream.error(err)
        })
        rs.on('end', () => {
            stream.close()
        })
        return stream        
    }

    put(path, stream) {
        let handle = null
        let callback = data => {
            stream.onData(null)
            handle.write().finally(() => {
                stream.onData(callback)
            })
        }
        fsPromises.open(path, "w").then(fileHandle => {
            handle = fileHandle
            stream.onData(callback)
            stream.onClose(() => {
                handle.close()
            })
            stream.onError((err) => {
                console.error(err)
                handle.close()
                fsPromises.unlink(path)
            })
        })
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


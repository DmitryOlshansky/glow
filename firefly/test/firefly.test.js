import * as ff from '../src/firefly.js'
import * as fs from 'node:fs'
import { v4 } from 'uuid'
import { assert } from 'chai'

const TestTimer = { 
    setInterval: function(interval, callback) {
        this.callbacks.push(callback)
    },
    tick: function() {
        for (const fn of this.callbacks) {
            fn()
        }
    },
    callbacks: []
}

describe("firefly cluster", () => {
    const node1 = new ff.Node(ff.genId(), TestTimer)
    const node2 = new ff.Node(ff.genId(), TestTimer)
    const kv1 = new ff.InMemoryKV(ff.genId(), node1)
    const kv2 = new ff.InMemoryKV(ff.genId(), node2)
    const fs1 = new ff.LocalFS(ff.genId(), node1)
    node1.addResource(kv1)
    node1.addResource(fs1)
    node2.addResource(kv2)

    const pair = ff.transportPair()
    node1.addLink(node2.id, pair[0])
    node2.addLink(node1.id, pair[1])

    it("should send/recieve self pings", async function() {
        const result = await node1.call(node1.id, "ping", new Uint8Array([1,2,3]))
        assert.deepEqual(result, new Uint8Array([1, 2, 3]))
    })

    it("should send/recieve pings across network", async function () {
        const result = await node1.call(node2.id, "ping", new Uint8Array([2,3,4]))
        assert.deepEqual(result, new Uint8Array([2,3,4]))
    })

    it("should call kv put/get locally", async function () {
        await node1.call(kv1.id, "put", "ABC", new Uint8Array([1, 2, 3]))
        const rt = await node1.call(kv1.id, "get", "ABC")
        assert.deepEqual(rt, new Uint8Array([1, 2, 3]))
    })

    it("should exchange topology after interval elapsed", async () => {
        TestTimer.tick()
        await node1.call(kv2.id, "put", "EDF", new Uint8Array([4,5,6]))
        const rt = await node1.call(kv2.id, "get", "EDF")
        assert.deepEqual(rt, new Uint8Array([4,5,6]))

    })

    it("should transport an error across network", async () => {
        TestTimer.tick()
        try {
            await node1.call(kv2.id, "get", "Not exists")
            assert.fail("should throw")
        } catch (e) {
            assert.match(e.toString(), /.*Key ".*" not found in this kv/)
        }
    })

    it("should read fs locally", async () => {
        TestTimer.tick()
        const fd = await node1.call(fs1.id, "open", "../README.md", "r")
        const dec = new TextDecoder("utf-8")
        let text = ""
        while (true) {
            const bytes = await node1.call(fs1.id, "read", fd, 1024)
            text += dec.decode(bytes, { stream: true })
            if (bytes.length == 0) break
        }
        text += dec.decode()
        await node1.call(fs1.id, "close", fd)
        assert.equal(text, fs.readFileSync("../README.md").toString())
    })

    it("should read fs remotely", async () => {
        TestTimer.tick()
        const fd = await node2.call(fs1.id, "open", "../README.md", "r")
        const dec = new TextDecoder("utf-8")
        let text = ""
        while (true) {
            const bytes = await node2.call(fs1.id, "read", fd, 1024)
            text += dec.decode(bytes, { stream: true })
            if (bytes.length == 0) break
        }
        text += dec.decode()
        await node2.call(fs1.id, "close", fd)
        assert.deepEqual(text, fs.readFileSync("../README.md").toString())
    })

    it("should write fs locally & remotely", async () => {
        TestTimer.tick()
        for (const node of [node1, node2]) {
            const fd = await node.call(fs1.id, "open", "../README.2.md", "w")
            const bytes = fs.readFileSync("../README.md")
            for (let i = 0; i < Math.ceil(bytes.length / 1024); i ++) {
                const slice = bytes.subarray(i * 1024, i * 1024 + 1024)
                const resp = await node.call(fs1.id, "write", fd, slice)
            }
            await node.call(fs1.id, "close", fd)
            const written = fs.readFileSync("../README.2.md")
            assert.equal(written.toString(), bytes.toString())
            await fs.promises.unlink("../README.2.md")
        }
    })
})
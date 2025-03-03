import { cluster } from '../src/firefly.js'
import * as fs from 'node:fs'
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
    const protocolDefinition = fs.readFileSync("./src/core.firefly").toString()
    const ff = cluster(protocolDefinition)
    const node1 = new ff.Node(ff.genId(), TestTimer)
    const node2 = new ff.Node(ff.genId(), TestTimer)
    const kv1 = new ff.InMemoryKV(ff.genId(), node1)
    const kv2 = new ff.InMemoryKV(ff.genId(), node2)
    
    node1.addResource(kv1)
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
    
    it("should support calling method directly on node resource", async() => {
        TestTimer.tick()
        for (const id in node1.nodes) {
            const payload = new Uint8Array([1, 2, 3])
            console.log(node1.nodes[id])
            const reply = await node1.nodes[id].ping(payload)
            assert.deepEqual(reply, payload)
        }
    })

    it("should support calling method directly on resource", async() => {
        TestTimer.tick()
        const payload = new Uint8Array([42])
        await node2.nodes[node1.id].resources[kv1.id].put("node1-test", payload)
        const rtt = await node2.nodes[node1.id].resources[kv1.id].get("node1-test")
        assert.deepEqual(rtt, payload)
    })

    it("should check arguments count to match the protocol", async() => {
        TestTimer.tick()
        for (const node of [node1, node2]) {
            try {
                await node1.call(kv2.id, "get", "first", "extra")
                assert.fail("should throw")
            } catch (e) {
                assert.match(e.toString(), /Resource .* method 'get' expects 1 arguments but 2 were given/)
            }
        }
    })

    it("should fail to send if the link is removed", async() => {
        TestTimer.tick()
        node1.removeLink(node2.id)
        try {
            await node1.call(kv2.id, "get", "first")
            assert.fail("Should fail during routing")
        } catch(e) {
            assert.match(e.toString(), /Address .* is unreachable/)
        }
    })
})
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
    })
})
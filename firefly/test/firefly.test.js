import * as ff from '../src/firefly.js'
import * as fs from 'node:fs'
import { v4 } from 'uuid'
import { assert } from 'chai'

describe("firefly cluster", () => {
    const node1 = new ff.Node(ff.genId(), {})
    const node2 = new ff.Node(ff.genId(), {})

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
})
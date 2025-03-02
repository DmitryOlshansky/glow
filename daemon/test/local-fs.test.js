import { cluster } from "../../firefly/src/firefly.js"
import { setup } from "../src/local-fs.js"
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
    const protocolDefinition = fs.readFileSync("../firefly/src/core.firefly").toString()
    const ff = cluster(protocolDefinition)
    const ext = setup(ff)
    const node1 = new ff.Node(ff.genId(), TestTimer)
    const node2 = new ff.Node(ff.genId(), TestTimer)
    const fs1 = new ext.LocalFS(ff.genId(), node1)
    node1.addResource(fs1)
    
    const pair = ff.transportPair()
    node1.addLink(node2.id, pair[0])
    node2.addLink(node1.id, pair[1])

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
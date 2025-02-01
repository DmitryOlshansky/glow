import * as serde from '../src/serde.js'
import {assert} from 'chai'

describe("byte serializer", () => {
    it("should serialize and deserialize byte", () => {
        const s = serde.stream(10)
        serde.Byte.ser(42, s)
        assert.equal(serde.Byte.deser(s), 42)
    })
    it("should serialize and deserialize bytes", () => {
        const s = serde.stream(8)
        serde.Byte.ser(1, s)
        serde.Byte.ser(2, s)
        const s2 = serde.stream(8)
        serde.ByteArray(2).ser(s.toArray(), s2)
        const arr = serde.ByteArray(2).deser(s2)
        assert.deepEqual(arr, new Uint8Array([1, 2]))
    })
})
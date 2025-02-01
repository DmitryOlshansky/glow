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

describe("base128 serializer", () => {
    it("should serialize small integers", () => {
        const s = serde.stream(10)
        serde.Base128.ser(42, s)
        const v = serde.Base128.deser(s)
        assert.equal(v, 42)
    })
    it("should serialize larger integers", () => {
        const s = serde.stream(10)
        serde.Base128.ser(128, s)
        const v = serde.Base128.deser(s)
        assert.equal(v, 128)
    })
    it("should serialize even larger integers", () => {
        const s = serde.stream(10)
        serde.Base128.ser(128<<7, s)
        serde.Base128.ser((128<<14) + 128 + 3, s)
        const v1 = serde.Base128.deser(s)
        const v2 = serde.Base128.deser(s)
        assert.equal(v1, 128<<7)
        assert.equal(v2, (128<<14) + 128 + 3)
    })
})

describe("dynarray", () => {
    it("should serialize array w/o specifing size", () => {
        const s = serde.stream(100)
        const arr = new Uint8Array([1, 2, 3, 4])
        serde.DynByteArray.ser(arr, s)
        const arr2 = serde.DynByteArray.deser(s)
        assert.deepEqual(arr2, arr)
    })
})

describe("seq of serializers", () => {
    it("should serialize each in turn", () => {
        const s = serde.stream(10)
        const seq = serde.seq(serde.Base128, serde.Byte)
        seq.ser([144, 255], s)
        assert.equal(s.wdx, 3)
        const v = seq.deser(s)
        assert.deepEqual(v, [144, 255])

    })
})

describe("generic array", () => {
    it("should serialize each element", () => {
        const s = serde.stream(100)
        const b128array = serde.arrayOf(serde.Base128)
        b128array.ser([128, 129, 1000], s)
        const v = b128array.deser(s)
        assert.deepEqual(v, [128, 129, 1000])
    })
})
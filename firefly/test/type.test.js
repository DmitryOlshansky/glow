import * as type from '../src/type.js'
import * as serde from '../src/serde.js'
import {assert} from 'chai'

describe("alias resolution", () => {
    it("should resolve chain of aliases", () => {
        const ts = new type.TypeSystem()
        ts.register("byte", type.Byte)
        const alias = new type.Alias("alias")
        ts.register(alias.name, type.Byte)
        const alias2 = new type.Alias("alias2")
        ts.register(alias2.name, alias)
        assert.equal(ts.resolve(alias.name), type.Byte)
        assert.equal(ts.resolve(alias2.name), type.Byte)
        assert.equal(alias.resolve(ts), type.Byte)
        assert.equal(alias2.resolve(ts), type.Byte)
    })
    it("should fail on circular definition", () => {
        const ts = new type.TypeSystem()
        const alias = new type.Alias("alias")
        const alias2 = new type.Alias("alias2")
        ts.register(alias.name, alias2)
        ts.register(alias2.name, alias)
        assert.throws(() => {
            alias.resolve(ts)
        }, /Circular definition .* in the type system/)
    })
    it("should fail on duplicate alias", () => {
        const ts = new type.TypeSystem()
        assert.throws(() => {
            ts.register("Name1", type.Byte)
            ts.register("Name1", type.Byte)
        })
    }, /Duplicate alias .* in the type system/)
    it("should fail on missing type", () => {
        const ts = new type.TypeSystem()
        assert.throws(() => {
            ts.resolve("missing")
        }, /Missing entry for alias .* in the type system/)
    })
})

describe("types deducing serializers", () => {
    const ff = type.FireFly()
    it("should expose serializer directly for primitive", () => {
        const t = new type.Primitive(serde.DynByteArray)
        assert.equal(t.serializer(), serde.DynByteArray)
    })
    it("should compose for arrays", () => {
        const s = serde.stream(20)
        const arr = [2,3,4,5000]
        const intArray = ff.resolve("Array").instantiate([type.Int])
        const iaserde = intArray.serializer()
        iaserde.ser(arr, s)
        assert.deepEqual(iaserde.deser(s), arr)
    })
    it("should special case byte arrays", () => {
        const s = serde.stream(10)
        const arr = [1,2,3]
        const byteArray = ff.resolve("Array").instantiate([type.Byte])
        const baserde = byteArray.serializer()
        baserde.ser(arr, s)
        assert.equal(s.wdx, 4)
        assert.deepEqual(baserde.deser(s), new Uint8Array(arr))
    })
    it("should special case fixed byte arrays", () => {
        const s = serde.stream(10)
        const arr = [1,2,3]
        const fixedByteArray = ff.resolve("Array").instantiate([type.Byte, 3])
        const fbaserde = fixedByteArray.serializer()
        fbaserde.ser(arr, s)
        assert.equal(s.wdx, 3)
        assert.deepEqual(fbaserde.deser(s), new Uint8Array(arr))
    })
})

describe("method provides serializers for args and return", () => {
    it("should serialize args as array", () => {
        const m = new type.Method("def", "method", [
            { name: "arg", type: type.Int },
            { name: "arg2", type: type.Int }
        ], new type.ArrayType(type.Byte, 16))
        const s = serde.stream(10)
        const argsSerde = m.serializer()
        argsSerde.ser([1, 2], s)
        assert.deepEqual(argsSerde.deser(s), [1, 2])
    })
})

describe("struct types deducing serializer", () => {
    it("should compose for structs keeping order", () => {
        const t = new type.Struct([
            { type : type.Byte, name: 'a'},
            { type : type.Int, name: 'b' },
            { type : type.Byte, name: 'c' }
        ])
        const s = serde.stream(10)
        const obj = { a: 0, b: 1000, c: 9 }
        const structSerde = t.serializer()
        structSerde.ser(obj, s)
        assert.equal(s.wdx, 4)
        assert.deepEqual(structSerde.deser(s), obj)
        s.rdx = 0
        assert.equal(s.readByte(), 0)
        assert.equal(serde.Base128.deser(s), 1000)
    })
    it("should compose for nested structs", () => {
        const t = new type.Struct([
            { type: type.Int, name: 'value' },
            { type: new type.Struct([
                { type: type.Int, name: 'b' },
                { type: type.Int, name: 'a' },
                ]), name: "nested" 
            }
        ])
        const s = serde.stream(12)
        const obj = { value: 123, nested: { a: 10, b: 20 } }
        const structSerde = t.serializer()
        structSerde.ser(obj, s)
        assert.equal(s.wdx, 3)
        assert.deepEqual(structSerde.deser(s), obj)
        s.rdx = 0
        assert.equal(s.readByte(), 123)
        assert.equal(s.readByte(), 20)
        assert.equal(s.readByte(), 10)
    })
})
import * as type from '../src/type.js'
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
        })
    })
})
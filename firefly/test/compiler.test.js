import * as type from "../src/type.js"
import * as peg from "../src/peg.js"
import { ProtoCompiler } from "../src/compiler.js"
import { assert } from "chai"

import * as fs from "node:fs"

const ts = type.FireFly()
const compiler = new ProtoCompiler(ts)


function state(str, ofs) {
    return new peg.State(str, ofs)
}

function value(str, ofs, v) {
    return peg.Parsed.Value(state(str, ofs), v)
}

function error(str, ofs, err) {
    return peg.Parsed.Error(state(str, ofs), err)
}

function expectValue(str, parser, ofs, v) {
    const s = state(str, 0)
    if (ofs < 0) ofs = str.length
    const r = parser.parse(s)
    if (r.error != null) {
        console.log(r.errorMessage())
    }
    assert.deepEqual(r, value(str, ofs, v))
}

function expectError(str, parser, ofs, err) {
    const s = state(str, 0)
    if (ofs < 0) ofs = str.length
    assert.deepEqual(parser.parse(s), error(s.input, ofs, err))
}

describe("ignorables", () => {
    it("ws should match whitespace", () => {
        expectValue("  \r\n\t", compiler.ws, 5, "  \r\n\t")
    })

    it("lineComment should match comment", () => {
        expectValue("//abc\r123", compiler.lineComment, 5, "abc")
    })

    it("comment should  match /* ... */", () => {
        expectValue("/*\r\n* */", compiler.comment, -1, "\r\n* ")
    })
})

describe("building blocks", () => {
    it("lit should match text ignoring ignorables", () => {
        expectValue("/* aaa*/ abc ", compiler.lit("abc"), 12, "abc")
    })
    
    it("id should match identifier", () => {
        expectValue(" Id_9", compiler.id, 5, "Id_9")
    })
    it("id shouldn't match number", () => {
        expectError(" 123", compiler.id, 1, "id")
    })

    it("number should match integer", () => {
        expectValue("/* */123", compiler.number, -1, 123)
    })

    it("delimited should match sequence of numbers", () => {
        expectValue(" 1, 2, 3", compiler.delimited(",", compiler.number), -1, [1, 2, 3])
    })
})

describe("types", () => {
    it("builtin type should void|byte|int|bool", () => {
        const s = ["void", "byte", "int", "bool"]
        const t = [type.Unit, type.Byte, type.Int, type.Byte]
        for (let i = 0; i < s.length; i++ ) {
            expectValue(s[i], compiler.builtinType, -1, t[i])
        }
    })
    
    it("struct def should match empty struct", () => {
        const s = `
            struct {
            }`
        expectValue(s, compiler.structDef, -1, new type.Struct([]))
    })
    it("struct def should match simple struct", () => {
        const s = `
            struct {
                a: int
                b: byte
                s: Alias
            }`
        expectValue(s, compiler.structDef, -1, new type.Struct([
            { name: "a", type: type.Int },
            { name: "b", type: type.Byte },
            { name: "s", type: new type.Alias("Alias") }
        ]))
    })
    
    it("generic should match alias[args...]", () => {
        const s = "Array[byte, 20]"
        expectValue(s, compiler.genericType, -1, new type.Instance(
            new type.Alias("Array"), [ type.Byte, 20 ]
        ))
    })

    it("typedef should match simple assignment", () => {
        const s = "type A = byte"
        expectValue(s, compiler.typeDef, -1, { name: "A", type: type.Byte })
    })
})

describe("protocol", () => {
    it("args should match argument list", () => {
        const s = "(arg: int, arg2: alias)"
        expectValue(s, compiler.args, -1, [
            { name: "arg", type: type.Int },
            { name: "arg2", type: new type.Alias("alias") }
        ])
    })

    it("method should match simple method definition", () => {
        const s = "msg ping()"
        expectValue(s, compiler.method, -1, new type.Method("msg", "ping", [], type.Unit))
    })
    it("method should match method with arguments", () => {
        const s = "def method(arg: int): Id"
        expectValue(s, compiler.method, -1, new type.Method("def", "method", [
            { name: "arg", type: type.Int }
        ], new type.Alias("Id")))
    })

    it("protoDef should match empty protocol", () => {
        const s = "proto Resource { }"
        expectValue(s, compiler.protoDef, -1, { name: "Resource", type: new type.Proto("Resource", [], []) })
    })
    it("protoDef should match protocol with extends and methods", () => {
        const s = `
        proto Proper : PA, PB {
            def callme(id: Id)
            msg maybe(): byte
        }`
        expectValue(s, compiler.protoDef, -1, { name: "Proper", type: new type.Proto("Proper", [
            new type.Alias("PA"), new type.Alias("PB")
        ], [
            new type.Method("def", "callme", [{name: "id", type: new type.Alias("Id")}], type.Unit),
            new type.Method("msg", "maybe", [], type.Byte)
        ])})
    })
})

describe("module", () => {
    it("should match empty module", () => {
        expectValue("", compiler.module, -1, new type.Module({}))
    })

    it("should match module with type and proto", () => {
        const s = `
        type t = Array[byte]

        proto P {
            def call(t: t)
        }
        `
        const t = new type.ArrayType(type.Byte)
        const P = new type.Proto("P", [], [
            new type.Method("def", "call", [
                { name: "t", type: t }
            ], type.Unit)
        ])
        expectValue(s, compiler.module, -1, new type.Module({
            "t": t,
            "P": P
        }))
    })
    
    it("should parse core.firefly", () => {
        const s = state(fs.readFileSync("src/core.firefly").toString(), 0)
        const parsed = compiler.module.parse(s)
        assert.equal(parsed.error, null)
    })
})
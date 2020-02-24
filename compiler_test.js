const test = require('ava')
const fs = require('fs')
const compiler = require('./compiler')
const peg = require("./peg")

test('parse types', t => {
    const c = compiler.create()
    t.is_type = (type, kind) => {
        t.is(type.kind, kind)
        t.is(typeof type.resolve, 'function')
    }
    
    t.deepEqual(c.id.parse('this_id0123456789['), 'this_id0123456789')
    t.deepEqual(c.id.parse('_.'), '_')
    t.throws(() => c.id.parse('1.'))
    t.deepEqual(c.number.parse('20'), 20)
    t.deepEqual(c.generic_type_arg.parse('20'), 20)
    t.is_type(c.generic_type_arg.parse('u8'), 'u8')
    t.is_type(c.builtin_type.parse('u8'), 'u8')
    t.is_type(c.generic_type.parse('array[u8, 20]'), 'instance')
    const struct = c.type_def.parse('type A = struct {a:C b:u8}')
    t.is_type(struct, 'struct')
    t.is(struct.fields[0][0], 'a')
    t.is(struct.fields[1][0], 'b')
    t.is_type(struct.fields[0][1], 'alias')
    t.is_type(struct.fields[1][1], 'u8')
    const proto = c.proto_def.parse('proto P : E, F { def fn(b: B, c: C):D }')
    t.is_type(proto, 'protocol')
})

test('comments', t => {
    const c = compiler.create()
    const proto = "#abcdef \n identifier"
    const id = c.id.parse(proto)
    t.deepEqual(id, "identifier")
})

test('parse glow spec', t => {
    const c = compiler.create()
    const content = fs.readFileSync("protocol.glow").toString()
    const r = c.proto_module.parse(content)
    console.log("Result:", r)
    t.not(r, undefined)
})

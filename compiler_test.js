const test = require('ava')
const compiler = require('./compiler')
const peg = require("./peg")

test('parse types', t => {
    t.is_type = (type, kind) => {
        console.log(type)
        t.is(type.kind, kind)
        t.is(typeof type.resolve, 'function')
    }
    
    t.deepEqual(compiler.id.parse('this_id0123456789['), 'this_id0123456789')
    t.deepEqual(compiler.id.parse('_.'), '_')
    t.deepEqual(compiler.id.parse('1.'), undefined)
    t.deepEqual(compiler.number.parse('20'), 20)
    t.deepEqual(compiler.generic_type_arg.parse('20'), 20)
    t.is_type(compiler.generic_type_arg.parse('u8'), 'u8')
    t.is_type(compiler.builtin_type.parse('u8'), 'u8')
    t.is_type(compiler.generic_type.parse('array[u8, 20]'), 'instance')
    const struct = compiler.type_def.parse('type A = struct {a:C b:u8}')
    t.is_type(struct, 'struct')
    t.is(struct.fields[0][0], 'a')
    t.is(struct.fields[1][0], 'b')
    t.is_type(struct.fields[0][1], 'alias')
    t.is_type(struct.fields[1][1], 'u8')
    const proto = compiler.proto_def.parse('proto P : E, F { def fn(b: B, c: C):D }')
    t.is_type(proto, 'protocol')
})

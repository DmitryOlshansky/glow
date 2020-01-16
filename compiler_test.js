const test = require('ava')
const compiler = require('./compiler')

test('parse types', t => {
    t.deepEqual(compiler.number.parse('20'), '20')
    t.deepEqual(compiler.id.parse('u8'), 'u8')
    t.deepEqual(compiler.generic_type.parse('Array[u8, 20]'), ['Array', '[', 'u8', [[',', '20']], ']'])
    //t.deepEqual(compiler.type_expr.parse('struct {}'), undefined)
    //t.deepEqual(compiler.type_def.parse('type A = struct {a:C&D b:u8}'), undefined)
    t.deepEqual(compiler.proto_def.parse('proto A : E, F { def fn(b: B, c: C):D }'), undefined)
})

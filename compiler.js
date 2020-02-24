const types = require('./types')

const peg = require('./peg')

const repeat = peg.repeat
const any = peg.any
const seq = peg.seq

// ignorable stuff
const ws = peg.matchWhile(c => c == ' ' || c == '\t' || c == '\v' || c == '\r' || c == '\n', "whitespace", 1)
const comment = seq(peg.match('#'), peg.matchWhile(c => c != '\n' && c != '\r', "non-newline"))
const ignored = repeat(any(comment, ws))

// building blocks
const opt = parser => repeat(parser, 0, 1).map(v => v.length ? v[0] : null)
const listOf = parser => seq(parser, repeat(seq(lit(','), parser))).map(pair => [pair[0], ...pair[1].map(x => x[1])])
const lit = text => peg.match(text).skipping(ignored)

const id = peg.seq(peg.matchWhile(c => /[A-Za-z_]/.test(c), "alpha", 1), peg.matchWhile(c => /[A-Za-z_0-9]/.test(c), "alphanumeric"))
    .map(args => args[0] + args[1]).skipping(ignored)

const number = peg.matchWhile(c => /\d/.test(c), "digit", 1).skipping(ignored).map(arg => parseInt(arg, 10))

const type_expr = peg.lazy()

const struct_member = peg.seq(id, lit(':'), type_expr).map(args => {
    return [args[0], args[2]]
})

const struct_def = seq(lit('struct'), lit('{'), repeat(struct_member, 0), lit('}')).map(args => {
    return types.struct_type(args[2])
})

const builtin_type = any(['u8', 'u16', 'u32', 'i8', 'i16', 'i32', 'vu'].map(t => lit(t))).map(id => types.alias_type(id))

const generic_type_arg = any(type_expr, number)

const generic_type = seq(id, lit('['), listOf(generic_type_arg), lit(']')).map(args => {
    const alias = types.alias_type(args[0])
    const generic_args = args[2]
    return types.generic_instance(alias, generic_args)
})

const basic_type_expr = any(builtin_type, generic_type, struct_def, id.map(name => types.alias_type(name)))

peg.bind(type_expr, seq(basic_type_expr, repeat(seq(lit('&'), basic_type_expr).map(args => args[1]))).map(args => {
    if (args[1].length > 0) {
        return types.and_type([args[0], ...args[1]])
    }
    else
        return args[0] 
}))

// this is type definition
const type_def = seq(lit('type'), id, lit('='), type_expr).map(args => {
    const name = args[1]
    const type = args[3]
    return types.add_type(name, type)
})

const ids = listOf(id)
const arg = seq(id, lit(':'), type_expr)
const args = listOf(arg)
const method = seq(any(lit('def'), lit('raw')), id, lit('('), opt(args), lit(')'), opt(seq(lit(':'), type_expr))).map(args => {
    const name = args[1]
    const params = args[2] ? args[2][0] : []
    const reply = args[4] ? args[4][0][1] : undefined
    return types.method(name, params, reply)
})

const methods = repeat(method)
// this is protocol definition
const proto_def = seq(lit('proto'), id, opt(seq(lit(':'), ids)), lit('{'), methods, lit('}')).map(args => {
    const name = args[1]
    const parents = args[2] ? args[2][1].map(p => types.alias_type(p)) : []
    const methods = args[4]
    return types.add_type(name, types.protocol_type(parents, methods))
})

const proto_module = peg.terminated(any(type_def, proto_def), peg.eof.skipping(ignored)).map(args => {
    return args[0];
})

exports.number = number
exports.id = id
exports.listOf = listOf
exports.builtin_type = builtin_type
exports.generic_type_arg = generic_type_arg
exports.generic_type = generic_type
exports.type_expr = type_expr
// top-level stuff
exports.type_def = type_def
exports.comment = comment
exports.ignored = ignored
exports.proto_def = proto_def
exports.proto_module = proto_module
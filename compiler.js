const codec = require('./codec')

const peg = require('./peg')

const repeat = peg.repeat
const any = peg.any
const seq = peg.seq

// building blocks
const ws = peg.skipWhile(c => c == ' ' || c == '\t' || c == '\v' || c == '\r' || c == '\n')
const opt = parser => repeat(parser, 0, 1).map(v => v.length ? v[0] : null)
const listOf = parser => seq(parser, repeat(seq(lit(','), parser)))/*.map(pair => [pair[0], ...pair[1].map(x => x[1])])*/
const lit = text => peg.match(text).skipping(ws)

// building up lexical for types
const comment = seq(peg.match('#'), peg.skipWhile(c => c != '\n' && c != '\r')).skipping(ws)

const id = peg.matchWhile(c => /\w[\w\d]*/.test(c), 1).skipping(ws)

const number = peg.matchWhile(c => /\d/.test(c), 1).skipping(ws)

const type_expr = peg.lazy()

const struct_member = peg.seq(id, lit(':'), type_expr)

const struct_def = seq(lit('struct'), lit('{'), repeat(struct_member, 0), lit('}'))

const builtin_type = any(['u8', 'u16', 'u32', 'i8', 'i16', 'i32', 'vu'].map(t => lit(t)))

const generic_type_arg = any(builtin_type, number)

const generic_type = seq(id, lit('['), generic_type_arg, repeat(seq(lit(','), generic_type_arg)), lit(']'))

const basic_type_expr = any(builtin_type, generic_type, struct_def, id)

peg.bind(type_expr, any(
    basic_type_expr, repeat(seq(lit('&'), basic_type_expr))
))

// this is type definition
const type_def = seq(lit('type'), id, lit('='), type_expr)

const ids = listOf(id)
const arg = seq(id, lit(':'), type_expr)
const args = listOf(arg)
const method = seq(lit('def'), id, lit('('), opt(args), lit(')'), opt(seq(lit(':'), type_expr)))
const methods = repeat(method)
// this is protocol definition
const proto_def = seq(lit('proto'), id, opt(seq(lit(':'), ids)), lit('{'), methods, lit('}'))


exports.number = number
exports.id = id
exports.generic_type = generic_type
exports.type_expr = type_expr
// top-level stuff
exports.type_def = type_def
exports.comment = comment
exports.proto_def = proto_def



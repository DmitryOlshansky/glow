const codec = require('./codec')

const peg = require('./peg')

const repeat = peg.repeat
const any = peg.any
const seq = peg.seq

const ws = peg.skipWhile(c => c == ' ' || c == '\t' || c == '\v' || c == '\r' || c == '\n')

const lit = text => peg.match(text).skipping(ws)

const comment = seq(peg.match('#'), peg.skipWhile(c => c != '\n' && c != '\r')).skipping(ws)

const id = peg.matchWhile(c => /\w[\w\d]*/.test(c), 1).skipping(ws)

const number = peg.matchWhile(c => /\d/.test(c), 1).skipping(ws)

const type_expr = peg.lazy()

const struct_member = peg.seq(id, lit(':'), type_expr)

const struct_def = seq(lit('struct'), lit('{'), repeat(struct_member, 0), lit('}'))

const builtin_type = any(['u8', 'u16', 'u32', 'i8', 'i16', 'i32', 'vu'].map(t => lit(t)))

const generic_type_arg = any(builtin_type, number)

const generic_type = seq(id, lit('['), generic_type_arg, repeat(seq(lit(','), generic_type_arg)), lit(']'))

const basic_type_expr = any(builtin_type, generic_type, struct_def)

peg.bind(type_expr_ref, any(
    basic_type_expr, repeat(seq(lit('&'), basic_type_expr))
))

const type_def = seq([type, id, lit('='), type_expr])

exports.input = function (input) {
    return protocol_input(input)
}
exports.number = number
exports.id = id
exports.generic_type = generic_type


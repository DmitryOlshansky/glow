const compiler = require('./compiler')

const inp = compiler.input

console.log(compiler.number(inp('20')))
console.log(compiler.id(inp('u8')))
console.log(compiler.generic_type(inp('Array[u8, 20]')))

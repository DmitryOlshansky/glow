const codec = require('./codec')

symbols = {}
context = {
    stack: [],
    visited: new Set(),
    error: function(msg) {
        const postfix =  this.stack.length > 0 ? " while processing types: " + this.stack.join("->") : ""
        throw Error(msg + postfix)
    }
}

function resolver(fn, name) {
    return () => {
        context.stack.push(name)
        context.visited.add(name)
        if (context.visited.size() != context.stack.size()) context.error("Circular type definition")
        const result = fn()
        context.stack.pop(name)
        return result
    }
}

// just a name for a type
const add_type = (alias, type) => {
    if (symbols[alias]) context.error("Redefinition of type "+alias)
    type.resolve = resolver(type.resolve, alias)
    return symbols[alias] = type
}


// simple known type with codec pair
const basic_type = (kind, enc, dec) => add_type(kind, {
    kind: kind,
    enc: enc,
    dec: dec,
    resolve: x => x // identity
})

// setup all basic types
const u8 = basic_type('u8', codec.enc_u8, codec.dec_u8)
basic_type('u16', codec.enc_u16, codec.dec_u16)
basic_type('u32', codec.enc_u32, codec.dec_u32)
basic_type('i8', codec.enc_i8, codec.dec_i8)
basic_type('i16', codec.enc_i16, codec.dec_i16)
basic_type('i32', codec.enc_i32, codec.dec_i32)
basic_type('vu', codec.enc_vu, codec.dec_vu)


// either we resolve eagerly (but may point to yet another alias) or delay the process
const alias_type = (alias) => {
    return symbols[alias] ? symbols[alias] : {
        kind: 'alias',
        alias: alias,
        target: null,
        resolve: function() {
            if (this.target) return target;
            if(!symbols[this.alias]) context.error("Undefined type "+this.alias)
            this.target = symbols[this.alias].resolve()
            return this.target
        }
    }
}

// with instantiator function that creates a type
const generic_type = (name, template) => add_type(name, {
    alias: name,
    kind: 'generic',
    instantiate: function (args) {
        return template(args)
    },
    resolve: function() {
        context.error("Cannot use generic "+name+" as type name")
    }
})

const generic_instance = (type, args) => {
    if (type.kind != 'alias' && type.kind != 'generic') context.error("Internal error - non-generic type passed to generic_instance")
    const alias = type.alias // name of generic or alias type
    return {
        kind: 'instance',
        alias: alias,
        generic: type,
        args: args,
        target: null,
        resolve: function() {
            if (this.generic.kind == 'alias') this.generic = this.generic.resolve();
            if (this.generic.kind != 'generic') context.error("Non-generic type " + alias + "used as generic")
            this.instantiated = this.generic.instantiate(this.args)
            return this.instantiated
        }
    }
}


// given an array of pairs field-name:type
const struct_type = (fields) => {
    return {
        kind: 'struct',
        fields: fields,
        resolve: function() { 
            // resolve all types
            this.fields = this.fields.map(p => {
                [pair[0], pair[1].resolve()]
            })
            this.enc = codec.enc_struct(this.fields.map(p => [p[0], p[1].enc]))
            this.dec = codec.dec_struct(this.fields.map(p => [p[0], p[1].dec]))
            return this
        }
    }
}

const array_type = generic_type('array', (base, size) => {
    return {
        kind: 'instance',
        base: base,
        size: size,
        resolve: function() {
            this.base = this.base.resolve()
            this.enc = size === undefined ? codec.enc_array_of(this.base.enc) : codec.enc_fixed_array_of(this.base.enc, this.size)
            this.dec = size === undefined ? codec.dec_array_of(this.base.dec) : codec.dec_fixed_array_of(this.base.dec, this.size)
            return this
        }
    }
})

const protocol_type = (parents, methods) => {
    let base = array_type.instantiate([u8, 16])
    base.kind = 'protocol'
    base.parents = parents
    base.methods = methods
    base.resolve_self = base.resolve
    base.resolve = function() {
        this.resolve_self() // resolve protocol as u8 fixed array
        for (p in this.parents) p.resolve()
        // resolve all methods to resolve all involved types
        for (m in this.methods) m.resolve()
        return this
    }
    return base
}

// args is array of name:type pairs, arguments have same codec as 
const method = (name, args, reply) => {
    return {
        name: name,
        kind: 'method',
        args: struct_type(args), 
        reply: reply,
        resolve: function() {
            this.args = this.args.resolve()
            this.reply = this.reply.resolve()
            return this
        }
    }
}

const and_type = (types) => {
    return {
        kind: 'and',
        types: types,
        resolve: function(){
            this.types = this.type.map(t => t.resolve())
            return this
        }
    }
}

exports.add_type = add_type
exports.alias_type = alias_type
exports.generic_type = generic_type
exports.generic_instance = generic_instance
exports.array_type = array_type
exports.struct_type = struct_type
exports.protocol_type = protocol_type
exports.method = method
exports.and_type = and_type

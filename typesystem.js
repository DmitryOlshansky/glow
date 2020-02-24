const codec = require('./codec')

class TypeSystem {
    constructor() {
        this.symbols = {}
        this.stack = []
         // setup all basic types
        this.u8 = this.basic_type('u8', codec.enc_u8, codec.dec_u8)
        this.basic_type('u16', codec.enc_u16, codec.dec_u16)
        this.basic_type('u32', codec.enc_u32, codec.dec_u32)
        this.basic_type('i8', codec.enc_i8, codec.dec_i8)
        this.basic_type('i16', codec.enc_i16, codec.dec_i16)
        this.basic_type('i32', codec.enc_i32, codec.dec_i32)
        this.basic_type('vu', codec.enc_vu, codec.dec_vu)
        
        this.array_type = this.generic_type('array', (base, size) => {
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

        this.u64 = this.add_type("u64", this.array_type.instantiate([this.u8, 8]))
        this.none = this.basic_type('none', () => {}, () => {})
        
    }

    error(msg) {
        const postfix =  this.stack.length > 0 ? " while processing types: " + this.stack.join("->") : ""
        throw Error(msg + postfix)
    }

    check_circular(fn, name) {
        return () => {
            console.log(this.stack)
            if (this.stack.includes(name)) this.error("Circular type definition with "+name)
            this.stack.push(name)
            const result = fn()
            this.stack.pop()
            return result
        }
    }

    // just a name for a type
    add_type(alias, type) {
        if (this.symbols[alias]) context.error("Redefinition of type "+alias)
        return this.symbols[alias] = type
    }


    // simple known type with codec pair
    basic_type(kind, enc, dec) {
        return this.add_type(kind, {
            kind: kind,
            enc: enc,
            dec: dec,
            resolve: function() {
                return this;
            }
        })
    }

    // either we resolve eagerly (but may point to yet another alias) or delay the process
    alias_type(alias) {
        return this.symbols[alias] ? this.symbols[alias] : {
            kind: 'alias',
            alias: alias,
            target: null,
            resolve: this.check_circular(() => {
                if (this.target) return target;
                if(!symbols[this.alias]) context.error("Undefined type "+alias)
                this.target = symbols[this.alias].resolve()
                return this.target
            }, alias)
        }
    }

    // with instantiator function that creates a type
    generic_type(name, template) {
        return this.add_type(name, {
            alias: name,
            kind: 'generic',
            instantiate: function (args) {
                return template(...args)
            },
            resolve: function() {
                context.error("Cannot use generic "+name+" as type name")
            }
        })
    }

    generic_instance(type, args) {
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
                this.target = this.generic.instantiate(this.args)
                return this.target
            }
        }
    }

    // given an array of pairs field-name:type
    struct_type(fields) {
        return {
            kind: 'struct',
            fields: fields,
            resolve: function() { 
                // resolve all types
                this.fields = this.fields.map(pair => [pair[0], pair[1].resolve()])
                this.enc = codec.enc_struct(this.fields.map(p => [p[0], p[1].enc]))
                this.dec = codec.dec_struct(this.fields.map(p => [p[0], p[1].dec]))
                return this
            }
        }
    }

    protocol_type(parents, methods) {
        let base = this.array_type.instantiate([this.u8, 16])
        base.kind = 'protocol'
        base.parents = parents
        base.methods = methods
        base.resolve_self = base.resolve
        base.resolve = function() {
            this.resolve_self() // resolve protocol as u8 fixed array
            for (const p of this.parents) p.resolve()
            // resolve all methods to resolve all involved types
            for (const m of this.methods) {
                m.resolve()
            }
            return this
        }
        return base
    }

    // args is array of name:type pairs, arguments have same codec as struct
    method(name, args, reply) {
        return {
            name: name,
            kind: 'method',
            args: this.struct_type(args), 
            reply: reply,
            resolve: function() {
                this.args = this.args.resolve()
                this.reply = this.reply ? this.reply.resolve() : this.none
                return this
            }
        }
    }

    and_type(types) {
        return {
            kind: 'and',
            types: types,
            resolve: function(){
                this.types = this.type.map(t => t.resolve())
                return this
            }
        }
    }
}

exports.create = () => new TypeSystem();

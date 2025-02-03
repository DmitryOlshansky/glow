import * as serde from "./serde.js"

export class TypeSystem {
    constructor() {
        this.registry = {}
    }

    register(alias, type) {
        if (alias in this.registry) throw Error(`Duplicate alias "${alias}" in the type system`)
        this.registry[alias] = type
    }

    resolve(alias) {
        const chain = [alias]
        let t = this.registry[alias]
        while (t.kind == "alias") {
            if (chain.find(x => x == t.name)) throw Error(`Circular definition for "${alias}" in the type system`)
            chain.push(t.name)
            t = this.registry[t.name]
        }
        return t
    }
}

export class Type {
    kind;

    constructor(kind) {
        this.kind = kind
    }

    resolve(ts) {
        return this
    }
}

export class Alias extends Type {
    constructor(name) {
        super("alias")
        this.name = name
    }

    resolve(ts) {
        const t = ts.resolve(this.name)
        return t.resolve(ts)
    }
}

export class Primitive extends Type {
    constructor(serializer) {
        super("primitive")
        this.serializer = () => serializer
    }
}

export const Byte = new Primitive(serde.Byte)

export const Int = new Primitive(serde.Base128)

class Generic extends Type {
    constructor(instantiate) {
        super("generic")
        this.instantiate = instantiate
    }
}

class ArrayType extends Type {
    constructor(type, length) {
        super("array")
        this.type = type
        this.length = length
    }

    resolve(ts) {
        return new ArrayType(this.type.resolve(ts), this.length)
    }

    serializer() {
        if (this.type == Byte) {
            if (this.length) {
                return serde.ByteArray(this.length)
            } else {
                return serde.DynByteArray
            }
        } else {
            return serde.arrayOf(this.type.serializer()) // TODO: fixed arrays of given type
        }
    }
}

const GenericArray = new Generic((args) => new ArrayType(...args))

export class Struct extends Type {
    constructor(fields) {
        super("struct")
        this.fields = fields
        this.mapping = {}
        this.names = []
        for (let i = 0; i < fields.length; i++) {
            this.mapping[this.fields[i].name] = i
            this.names.push(this.fields[i].name)
        }
    }

    resolve(ts) {
        const resolved = []
        for (const field in this.fields) {
            resolved.push({ type: field.type.resolve(ts), name: field.name })
        }
        return new Struct(resolved)
    }

    serializer() {
        const seqential = serde.seq(this.fields.map((x) => x.type.serializer()))
        return new serde.Serializer((obj, stream) => {
            const values = Array(this.fields.length)
            for (const key in obj)
                values[this.mapping[key]] = obj[key]
            return seqential.ser(values, stream)
        }, (stream) => {
            const values = seqential.deser(stream)
            const obj = {}
            for (let i = 0; i < this.names.length; i++)
                obj[names[i]] = values[i]
            return obj
        })
    }
}

export function FireFly(){
    const ts = new TypeSystem()
    ts.register("byte", Byte)
    ts.register("int", Int)
    ts.register("Array", GenericArray)
    return ts
}

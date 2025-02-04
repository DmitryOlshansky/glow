import * as peg from './peg.js'
import * as type from './type.js'

export class ProtoCompiler {
    constructor(ts) {
        this.ts = ts
        
        this.ws = peg.sliceMatching("whitespace", 0, x => /\s/.exec(x))
        
        this.lineComment = peg.match("//").flatMap(
            peg.sliceMatching("text", 0, it => it != '\r' && it != '\n')
        ).map(x => x[1]).rename("line-comment")
        
        this.comment = peg.seq(
            peg.match("/*"),
            peg.repeat("comment-body", peg.sliceMatching("non-star", 0, it => it != '*').flatMap(
                peg.sliceMatching("non-slash", 1, it => it == '*')
            ), 0).map(parts => parts.map(x => x[0] + x[1]).join('')),
            peg.match("/")
        ).map(s => s[1].slice(0, s[1].length-1))
        
        this.ignorable = peg.repeat("comment|line-comment|whitespace", peg.any("comment|whitespace", this.comment, this.lineComment, this.ws), 0)
        
        // building blocks

        this.lit = (text) => peg.match(text).skipping(this.ignorable)

        this.delimited = (separator, p) => p.flatMap(
            peg.repeat("tail", peg.seq(this.lit(separator), p).map(x => x[1]), 0)
        ).map (x => [x[0], ...x[1]])
        
        this.id = peg.sliceMatching(
            "id", 1, x => /[a-zA-Z_]/.exec(x)
        ).flatMap(peg.sliceMatching(
            "id_cont", 0, x => /[a-zA-Z0-9_]/.exec(x))
        ).map(x => x[0] + x[1]).skipping(this.ignorable).rename("id")
        
        this.number = peg.sliceMatching("digit", 1, x => /\d/.exec(x)).skipping(this.ignorable).map(it => parseInt(it))
        
        // various types
        
        this.type = peg.lazy()
        this.structMember = peg.seq(this.id, this.lit(":"), this.type).map(x => {
            return { type: x[2], name: x[0] }
        })
        this.structDef = peg.seq(
            this.lit("struct"),
            this.lit("{"),
            peg.repeat("struct members", this.structMember, 0),
            this.lit("}")
        ).map(x => new type.Struct(x[2]))

        this.builtinType = peg.any("built-in type", this.lit("void"), this.lit("int"), this.lit("bool"), this.lit("byte")).map(x => {
            switch(x) {
                case "void": return type.Unit
                case "int": return type.Int
                case "bool":
                case "byte":
                    return type.Byte
            }
        })

        this.genericTypeArg = peg.any("generic argument", this.type, this.number)

        this.genericType = peg.seq(this.id, this.lit("["), this.delimited(",", this.genericTypeArg), this.lit("]")).map (x =>
            new type.Instance(new type.Alias(x[0]), ...x[2])
        )

        this.alias = this.id.map(x => new type.Alias(x))

        this.basicTypePeg = peg.any("basic type expression", this.builtinType, this.genericType, this.structDef, this.alias)
        
        this.type.init(
            peg.seq(this.basicTypePeg, peg.repeat("type-level '&' expression", peg.seq(this.lit("&"), this.basicTypePeg).map(x => x[1]), 0)
        ).map(([head, tail])=> {
            if(tail.length == 0) return head
            else return new type.And([head, ...tail])
        }))

        this.typeDef = peg.seq(this.lit("type"), this.id, this.lit("="), this.type).map(x => {
            return { name: x[1], type: x[3] }
        }).skipping(this.ignorable)
        
        this.aliases = this.delimited(",", this.alias)
        
        this.arg = peg.seq(this.id, this.lit(":"), this.type).map(x => {
            return { name: x[0], type: x[2] }
        })

        this.args = peg.seq(this.lit("("), peg.optional("args", this.delimited(",", this.arg)), this.lit(")")).map(x => 
            x[1] ? x[1] : []
        )
        
        this.returnType = peg.optional("return type", peg.seq(this.lit(":"), this.type)).map(x => x ? x[1] : type.Unit)
        
        this.method = peg.seq(peg.any("def|msg", this.lit("def"), this.lit("msg")), this.id, this.args, this.returnType).map(([kind, name, args, ret]) => {
            return new type.Method(kind, name, args, ret ? ret : type.Unit)
        })

        this.methods = peg.repeat("methods", this.method, 0)
        
        // this is protocol definition
        this.extendsProtos = peg.optional("extended protos", peg.seq(this.lit(":"), this.aliases)).map( it =>
            it ? it[1] : []
        )

        this.protoBody = peg.seq(this.lit("{"), this.methods, this.lit("}")).map(x => x[1])
       
        this.protoDef = peg.seq(this.lit("proto"), this.id, this.extendsProtos, this.protoBody).map( ([_, name, extended, methods]) => {
            return { name: name, type : new type.Proto(name, extended, methods) }
        }).skipping(this.ignorable)
       
        this.decl = peg.any("declaration", this.typeDef, this.protoDef)
        this.module = peg.repeat("module", this.decl, 0).flatMap(this.ignorable).flatMap(peg.EOF).rename("module").map(([decls, _]) => {
            const members = {}
            for (const decl of decls[0]) {
                members[decl.name] = decl.type
                ts.register(decl.name, decl.type)
            }
            return new type.Module(members)
        })
    }
}
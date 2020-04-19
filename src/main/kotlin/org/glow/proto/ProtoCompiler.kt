package org.glow.proto

data class Module(val decls: Map<String, Type>)

class ProtoCompiler(val ts: TypeSystem) {
    val typePeg: Peg<Type>
    val declPeg: Peg<Pair<String, Type>>
    val modulePeg: Peg<Module>

    init {
        val ws = sliceMatching("whitespace", 0) { c ->
            c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\u000b' || c == '\u0085' || c == '\u2028'
        }
        val comment = match("#").flatMap(sliceMatching("comment", 0) {
            it != '\n' && it != '\r'
        }).map { it.second }

        val ignorable = repeat("ignorable", any("comment|whitespace", comment, ws))

        // building blocks
        fun<T, U> Peg<T>.skipping(peg: Peg<U>) = peg.flatMap(this).map { it.second }

        fun<T> optional(name: String, peg: Peg<T>) = repeat(name, peg, 0, 1).map { it.firstOrNull() }

        fun lit(text: String) = match(text).skipping(ignorable)

        fun<T> delimited(separator: String, peg: Peg<T>) = peg.flatMap(
            repeat("tail", seq(lit(separator), peg) { _, v -> v}, 0)
        ).map { (head, tail) ->
            listOf(head) + tail
        }

        val id = sliceMatching("id", 1){
            it.isJavaIdentifierStart()
        }.flatMap(sliceMatching("id_cont", 0){
            it.isJavaIdentifierPart()
        }).map {
            it.first.toString() + it.second.toString()
        }.skipping(ignorable)

        val number = sliceMatching("digit", 1) { it in '0'..'9' }.skipping(ignorable)

        typePeg = LazyPeg<Type>()

        // name to type pair
        val structMember = id.flatMap(lit(":")).flatMap(typePeg).map {
            it.first.first to it.second
        }

        val structDef = seq(lit("struct"), lit("{"), repeat("struct members", structMember, 0), lit("}")) { _, _, members, _ ->
            Type.Struct("struct", members) as Type
        }

        val builtinType = any("built-in type", lit("varint"), lit("bool"), lit("byte")).map {
            when(it) {
                "varint" -> Type.VarInt
                "bool" -> Type.Boolean
                "byte" -> Type.Byte
                else -> throw ProtoException("Internal error in proto parser")
            }
        }

        val genericTypeArg = any("generic argument", typePeg, number.map {
            it.toString().toIntOrNull()?.let {
                Type.Literal(it) as Type
            } ?: throw ProtoException("Failed to parse as int $it")
        })

        // generic type, pair of string -> type args
        val genericType = seq(id, lit("["), repeat("generic type arguments", genericTypeArg), lit("]")) { typeId, _, args, _ ->
            Type.Generic(typeId, args) as Type
        }

        val alias = id.map { Type.Alias(it, ts) as Type }

        val basicTypeExpr = any("basic type expression", builtinType, genericType, structDef, alias)

        typePeg.bind(seq(basicTypeExpr, repeat("type and expression", seq(lit("&"), basicTypeExpr) { _, arg -> arg }, 0)) { base, args ->
            when {
                base is Type.Layout && args.all { it is Type.Layout } ->
                    Type.And(listOf(base) + args.map { it as Type.Layout }.toList())
                else -> {
                    val all = listOf(base) + args
                    throw ProtoException("All subexpressions of type-level & must have the same layout, doesn't hold for some of $all")
                }
            }
        })

        // this is type definition
        val typeDef = seq(lit("type"), id, lit("="), typePeg) { _, typeId, _, expr ->
            typeId to expr
        }

        val aliases = delimited(",", alias)
        val arg = seq(id, lit(":"), typePeg) { argId, _, expr ->
            argId to expr
        }
        val args = seq(lit("("), delimited(",", arg), lit(")")) { _, args, _ ->
            args
        }
        val returnType = optional("return type", seq(lit(":"), typePeg) { _, e -> e })
        val method = seq(any("call|message", lit("def"), lit("message")), id, args,  returnType) { kind, name, args, ret ->
            Type.Method(Type.MethodKind.valueOf(kind), name, args, ret ?: Type.Unit)
        }

        val methods = repeat("methods", method, 0)
        // this is protocol definition
        val extendsProtos = optional("extended protos", seq(lit(":"), aliases) { _, v -> v }).map {
            it ?: emptyList()
        }
        val protoBody =  seq(lit("{"), methods, lit("}")) { _, body, _ -> body }
        val protoDef = seq(lit("proto"), id, extendsProtos, protoBody) { _, name, extended, methods ->
            name to (Type.Protocol(name, extended, methods) as Type)
        }
        declPeg = any("declaration", typeDef, protoDef)
        modulePeg = repeat("module", declPeg, 0).flatMap(EOF).map { (decls, _) ->
            Module(decls.toMap())
        }
    }


}

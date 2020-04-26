package dev.glow.firefly

import kotlinx.serialization.*

sealed class Type {
    // perform resolution of aliases recursively for any type constructors
    open fun resolve(): Type = this

    // opaque serializer, deduced from the constituent types after resolution
    abstract fun serializer(): KSerializer<Any>

    // the machinery for any structural type
    abstract class Layout(val name: String, val members: List<Pair<String, Type>>): Type() {

        override fun resolve(): Type = members.forEach { it.second.resolve() }.let { this }

        override fun serializer(): KSerializer<Any>  =  object : KSerializer<Any> {
            override val descriptor: SerialDescriptor = SerialDescriptor(name) {
                members.forEach { (name, type) ->
                    element(name, type.serializer().descriptor)
                }
            }

            override fun serialize(encoder: Encoder, value: Any) {
                require(value is List<*>)
                val structuredEncoder = encoder.beginStructure(descriptor, *members.map {
                    it.second.serializer()
                }.toList().toTypedArray())
                members.mapIndexed { index, pair ->
                    structuredEncoder.encodeSerializableElement(descriptor, index, pair.second.serializer(), value[index] ?: throw outOfRange)
                }
                structuredEncoder.endStructure(descriptor)
            }

            override fun deserialize(decoder: Decoder): Any {
                val composite = decoder.beginStructure(descriptor, *members.map {
                    it.second.serializer()
                }.toList().toTypedArray())
                val result = members.mapIndexed { index, pair ->
                    composite.decodeSerializableElement(descriptor, index, pair.second.serializer())
                }
                composite.endStructure(descriptor)
                return result
            }
        }

        override fun equals(other: Any?) = when(other) {
            is Layout -> name == other.name && members == other.members
            else -> false
        }

        override fun hashCode(): Int = 31 * name.hashCode() + members.hashCode()
    }

    // there might be a way to fold this type into Layout class but no idea for now
    class DynamicArray(val base: Type): Type() {
        override fun serializer(): KSerializer<Any> = object : KSerializer<Any> {
            override val descriptor: SerialDescriptor
                get() = SerialDescriptor("array", StructureKind.LIST) {
                    listDescriptor(base.serializer().descriptor)
                }

            override fun deserialize(decoder: Decoder): Any =
                    decoder.decodeStructure(descriptor) {
                        val count = decoder.decodeInt()
                        if (count < 0) throw ProtoException("Corrupt payload - negative size of array")
                        val items = mutableListOf<Any>()
                        for (i in 0 until count) {
                            items.add(decodeSerializableElement(base.serializer().descriptor, i, base.serializer()))
                        }
                        items
                    }

            override fun serialize(encoder: Encoder, value: Any) {
                when (value) {
                    is List<*> -> {
                        encoder.encodeInt(value.size)
                        encoder.beginStructure(descriptor, base.serializer()).apply {
                            for (i in 0..value.size) {
                                encodeSerializableElement(descriptor, i, base.serializer(), value[i] ?: throw outOfRange)
                            }
                            endStructure(descriptor)
                        }
                    }
                    else -> throw typeError
                }
            }
        }
        override fun equals(other: Any?) = when(other) {
            is DynamicArray -> base == other.base
            else -> false
        }

        override fun hashCode(): Int = base.hashCode()
    }


    // primitives
    object Byte : Type() {
        override fun serializer(): KSerializer<Any>  =  object : KSerializer<Any> {
            override val descriptor: SerialDescriptor get() = SerialDescriptor("byte")

            override fun deserialize(decoder: Decoder): Any = decoder.decodeByte()

            override fun serialize(encoder: Encoder, value: Any) =
                    when(value){
                        is kotlin.Byte -> encoder.encodeByte(value)
                        else -> throw typeError
                    }
        }

        override fun toString(): String = "byte"

        override fun equals(other: Any?): Boolean = other is Byte

        override fun hashCode(): Int = 3
    }

    object VarInt : Type() {
        override fun serializer(): KSerializer<Any> = object : KSerializer<Any> {
            override val descriptor: SerialDescriptor get() = SerialDescriptor("varint")

            override fun deserialize(decoder: Decoder): Any = decoder.decodeBoolean()

            override fun serialize(encoder: Encoder, value: Any) =
                    when(value){
                        is Long -> encoder.encodeLong(value)
                        is Int -> encoder.encodeInt(value)
                        is Short -> encoder.encodeShort(value)
                        is kotlin.Byte -> encoder.encodeShort(value.toShort()) // to keep encoding as varint(!)
                        else -> throw typeError
                    }
        }

        override fun equals(other: Any?): Boolean = other is VarInt

        override fun hashCode(): Int  = 2
    }

    object Unit : Literal<kotlin.Unit>(kotlin.Unit) {
        override fun equals(other: Any?): Boolean = other is Unit
        override fun hashCode(): Int  = 1
        override fun toString(): String = "void"
    }

    // ======= Basic type constructors =======

    open class Literal<T>(val value: T):
            Layout("literal", emptyList()) {
        override fun equals(other: Any?): Boolean = when(other) {
            is Literal<*> -> value == value
            else -> false
        }

        override fun hashCode(): Int = super.hashCode() * 31
    }

    class Array(val base: Type, val size: Literal<Int>):
            Layout("Array", (0 until size.value).map { it.toString() to base }) {
        override fun equals(other: Any?): Boolean = when(other) {
            is Array -> members == other.members
            else -> false
        }

        override fun toString(): String = "$name[$base, $size]"

        override fun hashCode(): Int = super.hashCode() * 31
    }

    class Optional(val type: Type):
            Layout("optional", listOf("present" to Byte, "value" to type)) {
        override fun equals(other: Any?): Boolean = when(other) {
            is Optional -> members == other.members
            else -> false
        }

        override fun toString(): String = "$name[$type]"

        override fun hashCode(): Int = super.hashCode() * 31
    }

    class Struct(fields: List<Pair<String, Type>>):
            Layout("struct", fields) {
        constructor(vararg args: Pair<String, Type>): this(args.toList())

        override fun equals(other: Any?): Boolean = when(other) {
            is Struct -> members == other.members
            else -> false
        }

        override fun hashCode(): Int = super.hashCode() * 31

        override fun toString(): String {
            val fields = members.joinToString("\n") { "${it.first}: ${it.second}" }
            return "$name{ $fields }"
        }
    }

    enum class MethodKind {
        MESSAGE, CALL;

        override fun toString(): String = when(this) {
            MESSAGE -> "msg"
            CALL -> "def"
        }
    }

    class Method(val kind: MethodKind, name: String, val args: List<Pair<String, Type>>, val ret: Type):
            Layout(name, listOf("method id" to VarInt) + args) {
        override fun equals(other: Any?) = when(other) {
            is Method ->  name == other.name && kind == other.kind && args == other.args && ret == other.ret
            else -> false
        }

        override fun hashCode(): Int {
            var result = 127 * ret.hashCode() + 31 * kind.hashCode() + args.hashCode()
            result = 31 * result + name.hashCode()
            return result
        }

        override fun toString(): String {
            val argsString = args.joinToString { "${it.first}: ${it.second}" }
            return "${kind} $name($argsString): $ret"
        }
    }

    // extends list should be protocols, but there is no way to know until types are resolved and semantic is done
    class Protocol(name: String, val extends: List<Type>, val methods: List<Method>):
            Layout(name, listOf("id" to DynamicArray(Byte))) {
        override fun equals(other: Any?) = when(other) {
            is Protocol -> name == other.name && extends == other.extends && methods == other.methods
            else -> false
        }

        override fun hashCode(): Int = 127 * name.hashCode() + 31 * extends.hashCode() + methods.hashCode()

        override fun toString(): String {
            val body = methods.joinToString("\n") { "  $it" }
            val base = extends.joinToString {
                when (it) {
                    is Alias -> it.name
                    is Protocol -> it.name
                    else -> it.toString()
                }
            }
            val extendsSection = if (base.isEmpty()) "" else ": $base"
            return "proto $name${extendsSection} {\n$body\n}"
        }
    }

    // Alias - a temporary type created on demand before full semantic analysis is done
    data class Alias(val name: String, val system: TypeSystem) : Type() {
        override fun resolve(): Type = system.resolve(name)
        override fun serializer(): KSerializer<Any> = throw unresolvedAliasError
        override fun toString(): String = name
        override fun equals(other: Any?): Boolean = when(other) {
            is Alias -> name == other.name && system === other.system
            else -> false
        }
        override fun hashCode(): Int = name.hashCode() + 31 * system.hashCode()
    }

    data class Generic(val name: String, val args: List<Type>) : Type() {
        override fun serializer(): KSerializer<Any> = throw genericTypeSerializer
        fun instantiate(args: List<Type>): Type = TODO("not implemented yet")
    }

    data class And(val types: List<Type>): Type() {
        override fun serializer(): KSerializer<Any> = types.first().serializer()
    }

    companion object {
        private val outOfRange = ProtoException("Dynamic serialization error - out of range")
        private val typeError = ProtoException("Dynamic serialization error - type mismatch")
        private val unresolvedAliasError = ProtoException("Getting serializer for unresolved type alias")
        private val genericTypeSerializer = ProtoException("Getting serializer for not instantiated generic type")
    }
}

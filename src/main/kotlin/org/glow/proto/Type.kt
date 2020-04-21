package org.glow.proto

import kotlinx.serialization.*

sealed class Type {
    // the machinery for any structural type
    abstract class Layout(val name: String, val members: Sequence<Pair<String, Type>>): Type() {

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
    }

    object Boolean: Type() {
        override fun serializer(): KSerializer<Any>  =  object : KSerializer<Any> {
            override val descriptor: SerialDescriptor get() = SerialDescriptor("bool")

            override fun deserialize(decoder: Decoder): Any = decoder.decodeBoolean()

            override fun serialize(encoder: Encoder, value: Any) =
                    when(value){
                        is kotlin.Boolean -> encoder.encodeBoolean(value)
                        else -> throw typeError
                    }
        }
    }

    object VarInt : Type() {
        override fun serializer(): KSerializer<Any> = object : KSerializer<Any> {
            override val descriptor: SerialDescriptor get() = SerialDescriptor("varint")

            override fun deserialize(decoder: Decoder): Any = decoder.decodeBoolean()

            override fun serialize(encoder: Encoder, value: Any) =
                    when(value){
                        is kotlin.Long -> encoder.encodeLong(value)
                        is kotlin.Int -> encoder.encodeInt(value)
                        is kotlin.Short -> encoder.encodeShort(value)
                        is kotlin.Byte -> encoder.encodeShort(value.toShort()) // to keep encoding as varint(!)
                        else -> throw typeError
                    }
        }
    }

    object Unit : Literal<kotlin.Unit>(kotlin.Unit)

    // basic type constructors for everyday use
    open class Literal<T>(val value: T):
            Layout("literal", emptySequence())

    class Array(t: Type, size: Literal<Int>):
            Layout("Array", (0 until size.value).map { it.toString() }.asSequence().zip(generateSequence { t }.take(size.value)))

    class Optional(t: Type):
            Layout("optional", sequenceOf("present" to Boolean, "value" to t))

    class Struct(name: String, fields: List<Pair<String, Type>>):
            Layout(name, fields.asSequence())

    enum class MethodKind {
        MESSAGE, CALL
    }

    class Method(val kind: MethodKind, name: String, val args: List<Pair<String, Type>>, val ret: Type):
            Layout(name, (listOf("method id" to VarInt) + args).asSequence()) {
        override fun equals(other: Any?) = when(other) {
            is Method ->  name == other.name && kind == other.kind && args == other.args && ret == other.ret
            else -> false
        }

        override fun hashCode(): Int {
            var result = 127 * ret.hashCode() + 31 * kind.hashCode() + args.hashCode()
            result = 31 * result + name.hashCode()
            return result
        }
    }

    // extends list should be protocols, but there is no way to know until types are resolved and semantic is done
    class Protocol(name: String, val extends: List<Type>, val methods: List<Method>):
            Layout(name, sequenceOf("id" to DynamicArray(Byte))) {

        override fun equals(other: Any?) = when(other) {
            is Protocol -> name == other.name && extends == other.extends && methods == other.methods
            else -> false
        }

        override fun hashCode(): Int = 127 * name.hashCode() + 31 * extends.hashCode() + methods.hashCode()
    }

    // Alias - a temporary type created on demand before full semantic analysis is done
    data class Alias(val name: String, val system: TypeSystem) : Type() {
        override fun resolve(): Type = system.resolve(name)
        override fun serializer(): KSerializer<Any> = throw unresolvedAliasError
    }

    data class Generic(val name: String, val args: List<Type>) : Type() {
        override fun serializer(): KSerializer<Any> = throw genericTypeSerializer
        fun instantiate(args: List<Type>): Type = TODO("not implemented yet")
    }

    data class And(val types: List<Type>): Type() {
        override fun serializer(): KSerializer<Any> = types.first().serializer()
    }

    // perform resolution of aliases recursively for any type constructors
    open fun resolve(): Type = this

    // opaque serializer, deduced from the constituent types after resolution
    abstract fun serializer(): KSerializer<Any>

    companion object {
        private val outOfRange = ProtoException("Dynamic serialization error - out of range")
        private val typeError = ProtoException("Dynamic serialization error - type mismatch")
        private val unresolvedAliasError = ProtoException("Getting serializer for unresolved type alias")
        private val genericTypeSerializer = ProtoException("Getting serializer for not instantiated generic type")
    }
}

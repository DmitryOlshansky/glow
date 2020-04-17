/*
 *  The code below is based on CBOR and ProtoBuf format from kotlinx.serialization / formats repo version 0.20.0.
 *
 *  The LICENSE of these files is:
 *
 *  Copyright 2017-2020 JetBrains s.r.o. Use of this source code is governed by the Apache 2.0 license.
 */
package org.glow.serialization

import kotlinx.io.*
import kotlinx.serialization.*
import kotlinx.serialization.CompositeDecoder.Companion.READ_DONE
import kotlinx.serialization.builtins.AbstractDecoder
import kotlinx.serialization.builtins.AbstractEncoder
import kotlinx.serialization.modules.*
import java.lang.Exception

// Firefly - Glow binary serialization format
@OptIn(InternalSerializationApi::class)
class Firefly(override val context: SerialModule = EmptyModule) : BinaryFormat {

    override fun <T> dump(serializer: SerializationStrategy<T>, value: T): ByteArray {
        val output = ByteArrayOutputStream()
        val dumper = FireflyWriter(output)
        dumper.encode(serializer, value)
        return output.toByteArray()
    }

    override fun <T> load(deserializer: DeserializationStrategy<T>, bytes: ByteArray): T {
        val stream = ByteArrayInputStream(bytes)
        val reader = FireflyReader(stream)
        return reader.decode(deserializer)
    }

    private open inner class FireflyWriter(val output: OutputStream) : AbstractEncoder() {
        override val context: SerialModule
            get() = this@Firefly.context

        override fun shouldEncodeElementDefault(descriptor: SerialDescriptor, index: Int): Boolean = true

        override fun beginStructure(descriptor: SerialDescriptor, vararg typeSerializers: KSerializer<*>): CompositeEncoder =
            FireflyWriter(output)

        override fun endStructure(descriptor: SerialDescriptor) {}

        override fun beginCollection(descriptor: SerialDescriptor, collectionSize: Int, vararg typeSerializers: KSerializer<*>): CompositeEncoder {
            encodeInt(collectionSize)
            return this
        }

        override fun encodeElement(descriptor: SerialDescriptor, index: Int): Boolean = true

        //TODO: revisit the allocation
        override fun encodeString(value: String) {
            encodeInt(value.length)
            output.write(value.toByteArray(Charsets.UTF_8))
        }

        override fun encodeFloat(value: Float) {
            val x = value.toRawBits()
            // just unroll to avoid loops and allocations
            val u8 = x.and(0xFF)
            val u16 = x.ushr(8).and(0xFF)
            val u24 = x.ushr(16).and(0xFF)
            val u32 = x.ushr(24).and(0xFF)
            out(u32)
            out(u24)
            out(u16)
            out(u8)
        }

        override fun encodeDouble(value: Double) {
            val x = value.toRawBits()
            // just unroll to avoid loops and allocations
            val u8 = x.and(0xFF).toInt()
            val u16 = x.ushr(8).and(0xFF).toInt()
            val u24 = x.ushr(16).and(0xFF).toInt()
            val u32 = x.ushr(24).and(0xFF).toInt()
            val u40 = x.ushr(32).and(0xFF).toInt()
            val u48 = x.ushr(40).and(0xFF).toInt()
            val u56 = x.ushr(48).and(0xFF).toInt()
            val u64 = x.ushr(56).and(0xFF).toInt()
            out(u64)
            out(u56)
            out(u48)
            out(u40)
            out(u32)
            out(u24)
            out(u16)
            out(u8)
        }

        override fun encodeByte(value: Byte) = out(value.toInt())
        override fun encodeChar(value: Char) = encodeLong(value.toLong())
        override fun encodeShort(value: Short) = encodeLong(value.toLong())
        override fun encodeInt(value: Int) = encodeLong(value.toLong())
        override fun encodeLong(value: Long) =
            when {
                // standard set of proto(cols) as defined has no use for negative numbers
                // however user-defined proto's might find use case for them
                value < 0 -> TODO("Check what ProtoBuf zig-zag does, also Matroska's varint encoding")
                // 7-bit number
                value < bits7 -> {
                    out((value and 0x7F).toInt())
                }
                // 14 bit
                value < bits14 -> {
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                // 21-bit
                value < bits21 -> {
                    out(((value ushr 14) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                // 28-bit
                value < bits28 -> {
                    out(((value ushr 21) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 14) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                // 35-bit
                value < bits35 -> {
                    out(((value ushr 28) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 21) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 14) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                // 42-bit
                value < bits42 -> {
                    out(((value ushr 35) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 28) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 21) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 14) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                // 49-bit
                value < bits49 -> {
                    out(((value ushr 42) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 35) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 28) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 21) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 14) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                // 53-bit limit to accomodate varint <-> IEE-754 double lossless mapping (JavaScript nodes!)
                // use roll your own bignums and fixnums via parametric types out of plain arrays of bytes
                value < bits53 -> {
                    out(((value ushr 49) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 42) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 35) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 28) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 21) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 14) and 0x7FL).toInt() or 0x80)
                    out(((value ushr 7) and 0x7FL).toInt() or 0x80)
                    out((value and 0x7F).toInt())
                }
                else -> throw FireflyException("Number $value is out of range for varint - use bigint or custom fixnum")
            }

        override fun encodeBoolean(value: Boolean) = out(if (value) 0xFF else 0)

        override fun encodeNull() = out(0)

        override fun encodeEnum(enumDescriptor: SerialDescriptor, index: Int) = encodeInt(index)

        private fun out(b: Int) = output.write(b)
    }

    private open inner class FireflyReader(val input: InputStream) : AbstractDecoder() {
        private var elementIndex = 0
        private var size: Int = Int.MAX_VALUE

        override val context: SerialModule
            get() = this@Firefly.context

        override fun beginStructure(descriptor: SerialDescriptor, vararg typeParams: KSerializer<*>): CompositeDecoder =
                FireflyReader(input)

        override fun decodeElementIndex(descriptor: SerialDescriptor): Int {
            if(elementIndex == size) return READ_DONE
            return elementIndex++
        }

        override fun decodeSequentially(): Boolean = true

        override fun decodeCollectionSize(descriptor: SerialDescriptor): Int {
            size = decodeInt()
            return size
        }

        override fun decodeString() = nextString()

        override fun decodeNotNullMark(): Boolean = nextBoolean()

        override fun decodeDouble() = nextDouble()
        override fun decodeFloat() = nextFloat()

        override fun decodeBoolean() = nextBoolean()

        override fun decodeByte() = nextByte().toByte()
        override fun decodeShort() = nextNumber().toShort()
        override fun decodeChar() = nextNumber().toChar()
        override fun decodeInt() = nextNumber().toInt()
        override fun decodeLong() = nextNumber()

        override fun decodeNull() = nextByte().let { null }

        override fun decodeEnum(enumDescriptor: SerialDescriptor): Int = nextNumber().toInt()

        private fun nextByte(): Int = input.read().let {
            if (it < 0) throw FireflyException("Unexpected EOF while reading Firefly data")
            it
        }

        // Default Firefly varint encoding
        private fun nextNumber(): Long {
            var v = 0L
            while (true) {
                val s = nextByte()
                val sv = s and 0x7f
                v = (v shl 7) or sv.toLong()
                if (s == sv) break
            }
            return v
        }

        private  fun nextBoolean(): Boolean = nextByte() != 0

        // stored as big endian long of bits repr
        private fun nextDouble(): Double = Double.fromBits(nextArray(8).let {
            it.fold(0L)  { acc, octet ->
                acc.shl(8).or(octet.toLong())
            }
        })

        // ditto
        private fun nextFloat(): Float = Float.fromBits(nextArray(4).let {
            it.fold(0)  { acc, octet ->
                acc.shl(8).or(octet.toInt())
            }
        })

        private fun nextArray(size: Int) = input.readNBytes(size)

        private fun nextDynamicArray(): ByteArray = nextNumber().toInt().let { nextArray(it) }

        fun nextString(): String = nextDynamicArray().let { String(it, Charsets.UTF_8) }
    }

    companion object {
        private const val bits7 = 1.shl(7)
        private const val bits14 = 1.shl(14)
        private const val bits21 = 1.shl(21)
        private const val bits28 = 1.shl(28)
        private const val bits35 = 1L.shl(35)
        private const val bits42 = 1L.shl(42)
        private const val bits49 = 1L.shl(49)
        private const val bits53 = 1L.shl(53)
    }
}

open class FireflyException(msg: String) : Exception(msg)
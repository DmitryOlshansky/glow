package org.glow.serialization

import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.dumps
import kotlinx.serialization.loads
import org.junit.Test
import kotlin.test.assertEquals


class TestFirefly {

    @Serializable
    data class Packet(val from: Long, val to: Long, val data: ByteArray) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (javaClass != other?.javaClass) return false

            other as Packet

            if (from != other.from) return false
            if (to != other.to) return false
            if (!data.contentEquals(other.data)) return false

            return true
        }

        override fun hashCode(): Int {
            var result = from.hashCode()
            result = 31 * result + to.hashCode()
            result = 31 * result + data.contentHashCode()
            return result
        }
    }

    val firefly = Firefly()

    @Test
    fun basic() {
        val encoded = firefly.dumps(String.serializer(), "hello")
        assertEquals(encoded.length, ("hello".length + 1)*2) // *2 b/c of hex encoding
        val roundTrip = firefly.loads(String.serializer(), encoded)
        assertEquals("hello", roundTrip)
    }

    @Test
    fun complex() {
        val packet = Packet(0x1234_5678_90, 0x90_8765_4321, ByteArray(2) {
            it.toByte()
        })
        val encoded = firefly.dump(Packet.serializer(), packet)
        val roundTrip = firefly.load(Packet.serializer(), encoded)
        assertEquals(packet, roundTrip)
    }

}

package org.glow

import org.glow.proto.Error
import org.glow.proto.FireflyTypeSystem
import org.glow.proto.Got
import org.glow.proto.ProtoCompiler
import org.glow.proto.Type
import org.junit.Test
import java.lang.Exception
import kotlin.test.assertEquals

class ProtoCompilerTest {

    @Test
    fun types() {
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        assertEquals(Got(Type.Alias("this_id0123456789", ts)), c.type.parse("this_id0123456789["))
        assertEquals(Got("_"), c.id.parse("_."))
        assertEquals(Error("id", 0), c.id.parse("1."))
        assertEquals(Got(1), c.number.parse("1."))
        assertEquals(Got(20), c.number.parse("20"))
        assertEquals(Got(Type.Literal(20)), c.genericTypeArg.parse("20"))
        assertEquals(Got(Type.Byte), c.genericTypeArg.parse("byte"))
        assertEquals(Got(Type.VarInt), c.builtinType.parse("int"))
        assertEquals(Got(Type.Generic("Array", listOf(Type.Byte, Type.Literal(20)))), c.genericType.parse("Array[byte, 20]"))
        val struct = Type.Struct("a" to Type.Alias("C", ts), "b" to Type.Byte)
        assertEquals(Got("A" to struct), c.typeDef.parse("type A = struct { a:C b:byte }"))
        val proto = Type.Protocol(
                "P",
                listOf(Type.Alias("E", ts), Type.Alias("F", ts)),
                listOf(
                        Type.Method(
                                Type.MethodKind.CALL, "fn",
                                listOf("b" to Type.Alias("B", ts), "c" to Type.Alias("C", ts)),
                                Type.Alias("D", ts)
                        ),
                        Type.Method(
                                Type.MethodKind.MESSAGE, "message123",
                                emptyList(),
                                Type.Unit
                        )
                )
        )
        assertEquals(Got("P" to proto), c.protoDef.parse("proto P : E, F { def fn(b: B, c: C):D \n msg message123() }"))
    }

    @Test
    fun comments() {
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        val id = c.type.parse("//abcdef \n identifier")
        assertEquals(Got(Type.Alias("identifier", ts)), id)
        val type = c.type.parse("// comment\nstruct {// and here\n a: //here\n A next: int // there \n}")
        assertEquals(Got(Type.Struct("a" to Type.Alias("A", ts), "next" to Type.VarInt)), type)

        val proto = c.protoDef.parse("""
            proto Publisher { 
            /********************************
                Multi-line comment
            *********************************/
                def subscribe(id: Id): void
                def unsubscribe(id: Id): void
            }
        """)
        assertEquals(Got("Publisher" to Type.Protocol("Publisher", emptyList(),
            listOf(
               Type.Method(Type.MethodKind.CALL, "subscribe", listOf("id" to Type.Alias("Id", ts)), Type.Unit),
               Type.Method(Type.MethodKind.CALL, "unsubscribe", listOf("id" to Type.Alias("Id", ts)), Type.Unit)
            )
        )), proto)
    }

    @Test
    fun parseCoreProtos() {
        val core = this::class.java.getResourceAsStream("/core.firefly")?.readAllBytes()?.contentToString() ?: throw Exception("Failed to load core.firefly")
        val c = ProtoCompiler(FireflyTypeSystem())
        val mod = c.module.parse(core)
        println(mod)
        assert(mod is Got)
    }
}
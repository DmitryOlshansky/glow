package org.glow

import org.glow.proto.Error
import org.glow.proto.FireflyTypeSystem
import org.glow.proto.Got
import org.glow.proto.ProtoCompiler
import org.glow.proto.Type
import org.junit.Test
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
        /*
            assertEquals(c.number.parse("20"), 20)
            assertEquals(c.generic_type_arg.parse("20"), 20)
            t.is_type(c.generic_type_arg.parse("u8"), "u8")
            t.is_type(c.builtin_type.parse("u8"), "u8")
            t.is_type(c.generic_type.parse("array[u8, 20]"), "instance")
            val struct = c.type_def.parse("type A = struct {a:C b:u8}")
            t.is_type(struct, "struct")
            t.is(struct.fields[0][0], "a")
            t.is(struct.fields[1][0], "b")
            t.is_type(struct.fields[0][1], "alias")
            t.is_type(struct.fields[1][1], "u8")
            val proto = c.proto_def.parse("proto P : E, F { def fn(b: B, c: C):D }")
            t.is_type(proto, "protocol")
         */
    }

    @Test
    fun comments() {
        val ts = FireflyTypeSystem()
        val c = ProtoCompiler(ts)
        val proto = "//abcdef \n identifier"
        val id = c.type.parse(proto)
        assertEquals(Got(Type.Alias("identifier", ts)), id)
    }

    @Test
    fun parseCoreProtos() {
        /* TODO: complete translation from JS
        val c = ProtoCompiler(FireflyTypeSystem())
        val content = fs.readFileSync("protocol.glow").toString()
        val r = c.proto_module.parse(content)
        t.not(r, undefined)
         */
    }
}
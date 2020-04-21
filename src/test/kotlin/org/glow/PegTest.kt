package org.glow

import org.glow.proto.*
import org.junit.Test
import kotlin.test.assertEquals

class PegTest {
    private fun String.pieces() = this.split("").subList(1, this.length+1)
    private fun String.gotList() = Got(this.split("").subList(1, this.length+1))

    @Test
    fun basics() {
        val a = match("a")
        val b = match("b")
        assertEquals(Got("a" to "b"), a.flatMap(b).parse("ab"))
        assertEquals(Got("a" to "b"), a.flatMap(b).parse("abc"))
        assertEquals(Error("flatMap", 1), a.flatMap(b).parse("a"))
        assertEquals(Error("a", 0), a.flatMap(b).parse("ba"))

        assertEquals(Got("a"), any("a or b", a, b).parse("a"))
        assertEquals(Got("b"), any("a or b", a, b).parse("b"))
        assertEquals(Error("a or b", 0), any("a or b", a, b).parse("c"))
        assertEquals(Got(("a" to "b") to "b"), a.flatMap(b).flatMap(b).parse("abb"))
    }
    
    @Test
    fun slicing() {
        val ws = sliceMatching("whitespace", 0) { it.isWhitespace() }
        val atLeastTwoEx = sliceMatching("two", 2) { it == '!' }
        val num = sliceMatching("num", 1) { it in '0'..'9' }

        assertEquals(Got("1234"), num.parse("1234a"))
        assertEquals(Got("123"), num.parse("123"))
        assertEquals(Error("num", 0), num.parse("a123"))

        assertEquals(Got("  "), ws.parse("  a"))
        assertEquals(Got("  "), ws.parse("  "))
        assertEquals(Got(""), ws.parse(""))
        assertEquals(Got("09"), ws.flatMap(num).map { it.second }.parse(" 09"))

        assertEquals(Got("!!!"), atLeastTwoEx.parse("!!!"))
        assertEquals(Got("!!"), atLeastTwoEx.parse("!!"))
        assertEquals(Error("two", 0), atLeastTwoEx.parse("!"))
    }

    @Test
    fun eof() {
        assertEquals(Got(Unit), EOF.parse(""))
        assertEquals(Got(Unit), match("a").flatMap(EOF).map { it.second }.parse("a"))
        val three = repeat("rep", match("a"), 1, 2).flatMap(match("a")).flatMap(EOF).map {
            it.first
        }
        assertEquals(Got("aa".pieces() to "a"), three.parse("aaa"))
        val three2 = match("a").flatMap(repeat("rep", match("a"), 1, 2)).flatMap(EOF).map {
            it.first
        }
        assertEquals(Got("a" to "aa".pieces()), three2.parse("aaa"))
        assertEquals(Got("a" to "a".pieces()), three2.parse("aa"))
    }
    
    @Test
    fun repeat() {
        val bin8 = repeat("bin8", any("binary", match("0"), match("1")), 0, 8)

        assertEquals("01010101".gotList(), bin8.parse("01010101"))
        assertEquals("".gotList(), bin8.parse(""))
        
        assertEquals("01".gotList(), bin8.parse("01"))
        assertEquals("01001".gotList(), bin8.parse("01001"))

        val twoOnes = repeat("ones", match("1"), 2, 2).flatMap(EOF).map { it.first }
        assertEquals("11".gotList(), twoOnes.parse("11"))
        assertEquals(Error("ones", 1), twoOnes.parse("1"))
        assertEquals(Error("flatMap", 2), twoOnes.parse("111"))
        assertEquals(Error("flatMap", 2), twoOnes.parse("1111"))

        val manyOnes = repeat("ones-1", match("1"), 1, 2)
                .flatMap(repeat("ones-2", match("1"), 1, 2))
                .flatMap(EOF).map { it.first }

        assertEquals(Got("11".pieces() to "1".pieces()), manyOnes.parse("111"))
        assertEquals(Got("11".pieces() to "11".pieces()), manyOnes.parse("1111"))
        // greedy
        assertEquals(Error("flatMap", 2), manyOnes.parse("11"))

        val inf = repeat("As", match("A"))
        val s = "A".repeat(1000) + "B"
        assertEquals(s.slice(0 until 1000).gotList(), inf.parse(s))
    }

    @Test
    fun lazyPeg() {
        val ref = LazyPeg<List<String>>()
        ref.bind(any("As", match("A").flatMap(ref).map { (head, tail) ->
            listOf(head) + tail
        }, match("A").map {
            listOf(it)
        }))
        assertEquals(Got(listOf("A", "A", "A")), ref.parse("AAA"))
    }

    @Test
    fun skipping() {
        val peg = match("word").skipping(sliceMatching("whitespace", 0) {
            it.isWhitespace()
        })
        assertEquals(Got("word"), peg.parse(" word"))
    }

    @Test
    fun format() {
        val text = "1\n2\n3\n4\n5\n6\n7"
        val err = Error("msg", 7)
        assertEquals("4:2: msg", err.format(text))
    }
}

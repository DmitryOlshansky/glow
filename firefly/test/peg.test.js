import * as peg from "../src/peg.js"
import {assert} from 'chai'

function state(str, ofs) {
    return new peg.State(str, ofs)
}

function value(str, ofs, v) {
    return peg.Parsed.Value(state(str, ofs), v)
}

function error(str, ofs, err) {
    return peg.Parsed.Error(state(str, ofs), err)
}

describe('match test', () =>  {
    it("should match abc", () => {
        const s = state("abc", 0)
        const p = peg.match("abc")
        assert.deepEqual(p.parse(s), value("abc", 3, "abc"))
    })
    it("should match at offset", () => {
        const s = state("xa", 1)
        const p = peg.match("a")
        assert.deepEqual(p.parse(s), value("xa", 2, "a"))
    })
    it("should not match different string", () => {
        const s = state("abc", 0)
        const p = peg.match("x")
        assert.deepEqual(p.parse(s), error("abc", 0, "x"))
    })
})

describe('match slicing test', () => {
    it("should match words", () => {
        const s = state("abcd e", 0)
        const p = peg.sliceMatching("letters", 1, (x) => /\w/.exec(x))
        assert.deepEqual(p.parse(s), value("abcd e", 4, "abcd"))
    })
    it("should fail if not long enough match", () => {
        const s = state("a b", 0)
        const p = peg.sliceMatching("letters", 2, (x) => /\w/.exec(x))
        assert.deepEqual(p.parse(s), error("a b", 0, "letters"))
    })
    it("should match at offset", () => {
        const s = state("a  b", 1)
        const p = peg.sliceMatching("ws", 2, (x) => /\s/.exec(x))
        assert.deepEqual(p.parse(s), value("a  b", 3, "  "))
    })
})

describe('map test', () => {
    const p = peg.sliceMatching("num", 1, (x) => /\d/.exec(x)).map(x => parseInt(x))
    it("should map the result", () => {
        const s = state("a12345", 1)
        assert.deepEqual(p.parse(s), value("a12345", 6, 12345))
    })
    it("should fail if mapped peg fails", () => {
        const s = state("a12345", 0)
        assert.deepEqual(p.parse(s), error("a12345", 0, "num"))
    })
})

describe("flatMap test", () => {
    const p1 = peg.match(">>")
    const p2 = peg.sliceMatching("num", 1, (x) => /\d/.exec(x))
    const p = p1.flatMap(p2)
    it("should match 2 consecutive pegs", () => {
        const s = state("  >>123", 2)
        assert.deepEqual(p.parse(s), value("  >>123", 7, [">>", "123"]))
    })
    it("should fail on first failure", () => {
        const s = state(" >123", 1)
        assert.deepEqual(p.parse(s), error(" >123", 1, ">>"))
    })
    it("should fail on second failure", () => {
        const s = state("XXX>>W", 3)
        assert.deepEqual(p.parse(s), error("XXX>>W", 5, "num"))
    })
})

describe("skipping test", () => {
    const p = peg.match("A").skipping(peg.sliceMatching("ws", 0, (x) => /\s/.exec(x)))
    it("should match skipping whitespace", () => {
        const s = state(" \tA", 0)
        assert.deepEqual(p.parse(s), value(" \tA", 3, "A"))
    })
    it("should fail if underlying peg fails", () => {
        const s = state(" X", 0)
        assert.deepEqual(p.parse(s), error(" X", 1, "A"))
    })
})

describe("rename test", () => {
    const p = peg.match("ABC").rename("Trio!")
    it("should match as usual", () => {
        const s = state(" ABC", 1)
        assert.deepEqual(p.parse(s), value(" ABC", 4, "ABC"))
    })
    it("should be renamed on fail", () => {
        const s = state("ABB", 0)
        assert.deepEqual(p.parse(s), error("ABB", 0, "Trio!"))
    })
})

describe("any test", () => {
    const p1 = peg.match("ABC")
    const p2 = peg.match("A")
    const p3 = peg.match("B")
    const a = peg.any("any", p1, p2, p3)
    it("should match the first alternative", () => {
        const s = state(" ABCD", 1)
        assert.deepEqual(a.parse(s), value(" ABCD", 4, "ABC"))
    })
    it("should match second alternative", () => {
        const s = state("AB", 0)
        assert.deepEqual(a.parse(s), value("AB", 1, "A"))
    })
    it("should match third alternative", () => {
        const s = state("BBB", 1)
        assert.deepEqual(a.parse(s), value("BBB", 2, "B"))
    })
    it("should fail with its own name", () => {
        const s = state("", 0)
        assert.deepEqual(a.parse(s), error("", 0, "any"))
    })
})

describe("repeat test", () => {
    const p = peg.repeat("rep", peg.match("A"), 1, 5)
    it("should match min occurancies", () => {
        const s = state("A", 0)
        assert.deepEqual(p.parse(s), value("A", 1, ["A"]))
    })
    it("should stop at non-matching char", () => {
        const s = state("AAB", 0)
        assert.deepEqual(p.parse(s), value("AAB", 2, ["A", "A"]))
    })
    it("should stop at max occurancies", () => {
        const s = state("AAAAAA", 0)
        assert.deepEqual(p.parse(s), value("AAAAAA", 5, ["A", "A", "A", "A", "A"]))
    })
    it("should not match empty state", () => {
        const s = state("A", 1)
        assert.deepEqual(p.parse(s), error("A", 1, "rep"))
    })
})

describe("optional test", () => {
    const op = peg.optional("opt", peg.match("X"))
    it("should match X", () => {
        const s = state("AX", 1)
        assert.deepEqual(op.parse(s), value("AX", 2, "X"))
    })
    it("should match empty string", () => {
        const s = state("Z", 0)
        assert.deepEqual(op.parse(s), value("Z", 0, null))
    })
})

describe("seq test", () => {
    const seq = peg.seq((a,b,c) => { return { a, b, c } }, peg.match("A"), peg.match("B"), peg.match("C"))
    it("should match sequence of ABC", () => {
        const s = state(" ABC", 1)
        assert.deepEqual(seq.parse(s), value(" ABC", 4, { a: "A", b: "B", c: "C" }))
    })
    it("should fail on smaller sequences", () => {
        const s = state("ABZ", 0)
        assert.deepEqual(seq.parse(s), error("ABZ", 2, "C"))
    })
})

describe("lazy peg", () => {
    const sum = new peg.LazyPeg()
    const num = peg.sliceMatching("num", 1, (x) => /\d/.exec(x)).map(x => parseInt(x))
    const expr = peg.any("expr",
        peg.seq((a,b,c) => a + c, num, peg.match("+"), sum),
        num
    )
    sum.init(expr)
    it("should match simple expr", () => {
        const s = state("1+2+3", 0)
        assert.deepEqual(sum.parse(s), value("1+2+3", 5, 6))
    })
})
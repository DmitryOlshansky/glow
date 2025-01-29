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


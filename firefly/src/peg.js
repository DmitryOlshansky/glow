
export class State {
    constructor(input, ofs) {
        this.input = input
        this.ofs = ofs
    }
}

export class Parsed {
    state;
    value;
    error;
    
    constructor(state, value, error) {
        this.state = state
        this.value = value
        this.error = error
    }
    
    static Value(state, value) {
        return new Parsed(state, value, null)
    }

    static Error(state, error) {
        return new Parsed(state, null, error)
    }

    errorMessage() {
        if (!this.error) return null
        let line = 1
        let lastLineOffset = 0
        const inp = this.state.input
        const ofs = this.state.ofs
        for (i=0; i < ofs; i++) {
            const c = inp[i]
            const nextNl = i + 1 < ofs && inp[i+1] == '\n'
            if (c == '\n' || (c == '\r' && !nextNl)) {
                line++
                lastLineOffset = i
            }
        }
        const col = offset - lastLineOffset
        return `${line}:${col}: expected ${this.error}`
    }
}

class Peg {
    
    constructor(parse) {
        this.parse = parse
    }

    map(fn) {
        return new Peg((state) => {
            const result = this.parse(state)
            if (result.error) {
                return result
            } else {
                return Parsed.Value(result.state, fn(result.value))
            }
        })
    }

    flatMap(peg) {
        return new Peg((state) => {
            const result = this.parse(state)
            if (result.error) {
                return result
            } else {
                const result2 = peg.parse(result.state)
                if (result2.error) {
                    return result2
                } else {
                    return Parsed.Value(result2.state, [result.value, result2.value])
                }
            }
        })
    }

    rename(name) {
        return new Peg((state) => {
            const result = this.parse(state)
            if (result.error) {
                return Parsed.Error(result.state, name)
            } else {
                return result
            }
        })
    }

    skipping(peg) {
        return peg.flatMap(this).map(x => x[1])
    }
}

export function match(text) {
    return new Peg((state) => {
        if (state.input.slice(state.ofs).startsWith(text)) {
            return Parsed.Value(new State(state.input, state.ofs+text.length), text)
        } else {
            return Parsed.Error(state, text)
        }
    })
}

export function sliceMatching(name, min, cond) {
    return new Peg((state) => {
        let j = state.ofs
        const inp = state.input
        while (j < inp.length && cond(inp[j])) {
            j++
        }
        const result = inp.slice(state.ofs, j)
        if (result.length < min) {
            return Parsed.Error(state, name)
        } else {
            return Parsed.Value(new State(inp, j), result)
        }
    })
}

export function any(name, ...args) {
    return new Peg((state) => {
        for (const peg of args) {
            const r = peg.parse(state)
            if (!r.error) return r;
        }
        return Parsed.Error(state, name)
    })
}

export function repeat(name, peg, min, max = 1_000_000_000) {
    return new Peg((state) => {
        let current = state
        const items = []
        for (let i = 0; i < max; i++) {
            const r = peg.parse(current)
            if (r.error) {
                if (i >= min) {
                    return Parsed.Value(current, items)
                } else {
                    return Parsed.Error(current, name)
                }
            } else {
                items.push(r.value)
            }
            current = r.state
        }
        return Parsed.Value(current, items)
    })
}

export function optional(name, peg) {
    return repeat(name, peg, 0, 1).map(x => x.length ? x[0] : null)
}

export function seq(...pegs) {
    let peg = pegs[0].map(x => [x])
    for (let i=1; i<pegs.length; i++) {
        peg = peg.flatMap(pegs[i]).map(x => [...x[0], x[1]])
    }
    return peg
}

class LazyPeg extends Peg {
    wrapped;
    constructor() {
        super(s => this.wrapped.parse(s))
        this.wrapped = null
    }
    init(peg) {
        this.wrapped = peg;
    }
}

export function lazy() {
    return new LazyPeg();
}

export const EOF = new Peg((state) => {
    if (state.ofs == state.input.length) {
        return Parsed.Value(state, true)
    } else {
        return Parsed.Error(state, "EOF")
    }
})


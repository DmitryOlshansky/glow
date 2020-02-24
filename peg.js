
function start(input) {
    return {
        input: input,
        ofs: 0,
        error: function(message) {
            return { error: message, offset: this.ofs }
        },
        ok: function(item) {
            return { result: item }
        }
    }
}

const formatError = (text, e) => {
    let line = 1
    let lastLineOffset = 0
    for (const a of text.substring(0, e.offset).matchAll(/\r\n|\r|\n/g)) {
        lastLineOffset = a.index + a[0].length
        line++
    }
    const col = e.offset - lastLineOffset + 1
    return `${line}:${col}: ${e.error}`
}

// aka PEG function
function pf(parser) {
    parser.map = fn => pf(p => { const t = parser(p);  return t.result !== undefined ? p.ok(fn(t.result)) : t })
    parser.skipping = fn => pf(p => { if(fn(p).result !== undefined) { return parser(p) } })
    parser.parse = text => {
        const input = start(text)
        const r = parser(input)
        if(r.result !== undefined) return r.result
        else {
            const message = formatError(input.input, r)
            throw new Error(message)
        }
    }
    return parser
}

function match(item) {
    return pf(p => {
        let j = p.ofs
        for (let i = 0; i < item.length; i++) 
            if (j >= p.input.length || p.input[j++] != item[i]) return p.error(`can't match '${item}'`)
        p.ofs = j
        return p.ok(item)
    })
}

function matchWhile(cond, name, min=0) {
    return pf(p => {
        let j = p.ofs
        while (cond(p.input[j]) && j < p.input.length) { j++; }
        let r = p.input.slice(p.ofs, j)
        p.ofs = j
        if (r.length < min) return p.error(`can't match ${name} at least ${min} times`)
        return p.ok(r)
    })
}

function skipWhile(cond) {
    return pf(p => { while(cond(p.input[p.ofs])) p.ofs++; return p.ok(true) })
}

function any() {
    const parsers = arguments.length == 1 ? arguments[0] : arguments
    return pf(p => {
        let save = p.ofs
        let longest = -1
        let err = { error: "have not matched any" }
        for (let parser of parsers) {
            let r = parser(p)
            if (r.result !== undefined) return r
            if (longest < p.ofs) {
                longest = p.ofs
                err = r
            }
            p.ofs = save
        }
        return err
    })
}

function repeat(parser, min = 0, max = 1e9) {
    return pf(p => {
        let save = p.ofs
        let result = new Array()
        let i = 0
        let r = { error: "have not matched repeat" }
        while (i < max) {
            r = parser(p)
            if (r.result === undefined) break;
            i++
            if (i >= min) save = p.ofs
            result.push(r)
        }
        // guard for case of min == max
        if (i != max) p.ofs = save
        if (i >= min) return p.ok(result.map(x => x.result))
        else return r
    })
}

function terminated(parser, end_parser) {
    return pf(p => {
        let result = new Array()
        while (true) {
            let save = p.ofs
            let r = parser(p)
            if (r.result === undefined) {
                p.ofs = save
                let fin = end_parser(p)
                if (fin.result === undefined) {
                    return r;
                }
                else break;
            }
            result.push(r)
        }
        return p.ok(result.map(x => x.result))
    })
}

function seq() {
    const parsers = arguments.length == 1 ? arguments[0] : arguments
    return pf(p => {
        let save = p.ofs
        let result = new Array(parsers.length)
        for (let i = 0; i < parsers.length; i++) {
            result[i] = parsers[i](p)
            if (result[i].result === undefined) {
                p.ofs = save
                return result[i]
            }
        }
        return p.ok(result.map(x => x.result))
    })
}

function lazy() {
    ctx = { parser: p => {} }
    let f = pf(p => { return ctx.parser(p) })
    f.ctx = ctx
    return f
}

function bind(lazy_pf, parser) {
    lazy_pf.ctx.parser = parser
}

const eof = pf(p => p.input.length == p.ofs ? p.ok(true) : p.error("expected eof"))

exports.match = match
exports.matchWhile = matchWhile
exports.skipWhile = skipWhile
exports.any = any
exports.seq = seq
exports.repeat = repeat
exports.lazy = lazy
exports.bind = bind
exports.eof = eof
exports.terminated = terminated
exports.formatError = formatError

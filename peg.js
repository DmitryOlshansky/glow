
function start(input) {
    return {
        input: input,
        ofs: 0
    }
}

// aka PEG function
function pf(parser) {
    parser.map = fn => pf(p => { const t = parser(p);  return t !== undefined ? fn(t) : undefined })
    parser.skipping = fn => pf(p => { if(fn(p) !== undefined) return parser(p) })
    parser.parse = text => parser(start(text))
    return parser
}

function match(item) {
    return pf(p => {
        let j = p.ofs
        for (let i = 0; i < item.length; i++) 
            if (j >= p.input.length || p.input[j++] != item[i]) return
        p.ofs = j
        return item
    })
}

function matchWhile(cond, min=0) {
    return pf(p => {
        let j = p.ofs
        while (cond(p.input[j]) && j < p.input.length) { j++; }
        r = p.input.slice(p.ofs, j)
        p.ofs = j
        if (r.length < min) return
        return r
    })
}

function skipWhile(cond) {
    return pf(p => { while(cond(p.input[p.ofs])) p.ofs++; return true })
}

function any() {
    const parsers = arguments.length == 1 ? arguments[0] : arguments
    return pf(p => {
        let save = p.ofs
        for (let parser of parsers) {
            let r = parser(p)
            if (r !== undefined) return r
            p.ofs = save
        }
    })
}

function repeat(parser, min = 0, max = 1e9) {
    return pf(p => {
        let save = p.ofs
        let result = new Array()
        let i = 0
        while (i < max) {
            let r = parser(p)
            if (r === undefined) break;
            i++
            if (i >= min) save = p.ofs
            result.push(r)
        }
        // guard for case of min == max
        if (i != max) p.ofs = save
        if (i >= min) return result
        else return 
    })
}

function seq() {
    const parsers = arguments.length == 1 ? arguments[0] : arguments
    return pf(p => {
        let save = p.ofs
        let result = new Array(parsers.length)
        for (let i = 0; i < parsers.length; i++) {
            result[i] = parsers[i](p)
            if (result[i] === undefined) {
                p.ofs = save
                return
            }
        }
        return result
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

const eof = pf(p => p.input.length == p.ofs ? true : undefined)

exports.match = match
exports.matchWhile = matchWhile
exports.skipWhile = skipWhile
exports.any = any
exports.seq = seq
exports.repeat = repeat
exports.lazy = lazy
exports.bind = bind
exports.eof = eof

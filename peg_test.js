const test = require('ava')

const peg = require('./peg')

test('peg basics', t => {
    const a = peg.match('a')
    const b = peg.match('b')
    
    t.deepEqual(peg.seq(a, b).parse("ab"), ['a', 'b'])
    t.deepEqual(peg.seq([a, b]).parse("abc"), ['a', 'b'])
    t.throws(() => peg.seq([a, b]).parse("a"), "1:2: can't match 'b'")
    t.throws(() => peg.seq([a, b]).parse("ba"))

    t.deepEqual(peg.any(a, b).parse("a"), "a")
    t.deepEqual(peg.any([a, b]).parse("b"), "b")
    t.throws(() => peg.any([a, b]).parse("c"))
    t.deepEqual(peg.seq(peg.seq(a, b), b).parse('abb'), [['a', 'b'], 'b'])
})


test('peg (match|skip)While', t => {
    const ws = peg.skipWhile(c => c == ' ' || c == '\t')
    const atLeastTwoEx = peg.matchWhile(c => '!', "!", 2)
    const num = peg.matchWhile(c => c >= '0' && c <= '9', "digit", 1)

    t.deepEqual(num.parse('1234a'), '1234')
    t.deepEqual(num.parse('123'), '123')
    t.throws(() => num.parse('a123'))
    t.deepEqual(ws.parse('  a'), true)
    t.deepEqual(ws.parse('  '), true)
    t.deepEqual(ws.parse(''), true)
    t.deepEqual(peg.seq(ws, num).parse(' 09'), [true, '09'])

    t.deepEqual(atLeastTwoEx.parse('!!!'), '!!!')
    t.deepEqual(atLeastTwoEx.parse('!!'), '!!')
    t.throws(() => atLeastTwoEx.parse('!'))
})


test('peg repeat', t => {
    const num2 = peg.repeat(peg.any(peg.match('0'), peg.match('1')), 0, 8)
    
    t.deepEqual(num2.parse('01010101'), ['0', '1', '0', '1', '0', '1', '0', '1'])
    t.deepEqual(num2.parse(''), [])
    t.deepEqual(num2.parse('01'), ['0', '1'])
    t.deepEqual(num2.parse('010010001'), ['0', '1', '0', '0', '1', '0', '0', '0'])

    const twoOnes = peg.seq(peg.repeat(peg.match('1'), 2, 2), peg.eof)
    t.deepEqual(twoOnes.parse('11'), [['1', '1'], true])
    t.throws(() => twoOnes.parse('1'))
    t.throws(() => twoOnes.parse('111'))
    t.throws(() => twoOnes.parse('1111'))

    const ones = peg.seq(peg.repeat(peg.match('1'), 1, 2), peg.repeat(peg.match('1'), 1, 2), peg.eof)
    t.deepEqual(ones.parse('1111'), [['1', '1'], ['1', '1'], true])
    t.deepEqual(ones.parse('111'), [['1', '1'], ['1'], true])
    t.throws(() => ones.parse('11')) // greedy

    const inf = peg.repeat(peg.match('A'))
    let s = ''
    for (let i = 0; i < 1000; i++)s += 'A'
    t.deepEqual(inf.parse(s), s.split(''))
})

test('peg skipping & map', t => {
    const bin = peg.matchWhile(c => c >= '0' && c <= '9', "digit", 1).map(v => parseInt(v))
    t.deepEqual(bin.parse('456['), 456)
    t.throws(() => bin.parse(' 01'))
    // skipping map is valid parser
    t.deepEqual(bin.skipping(peg.match(' ')).parse(' 01'), 1)
    t.throws(() => bin.skipping(peg.match(' ')).parse('01'))
    // map of map is parser
    t.deepEqual(bin.map(v => "*" + v.toString() + "*" ).parse('111'), '*111*')

    const anybin = peg.matchWhile(c => c == '0' || c == '1', "binary")
    t.deepEqual(anybin.parse(''), '')
    t.deepEqual(anybin.parse('1'), '1')
    t.deepEqual(anybin.parse('a'), '')

    t.deepEqual(peg.seq(peg.match('1'), peg.match('2')).map( x => x[0] + x[1]).parse('12'), '12')
})

test('peg lazy', t => {
    const ref = peg.lazy()
    peg.bind(ref, peg.any(peg.seq(peg.match('A'), ref), peg.match('A')))
    t.deepEqual(ref.parse('AAA'), ['A', ['A', 'A']])
})

test('format error', t => {
    const text = "1\n2\n3\n4\n5\n6\n7"
    const err = { error:"msg", offset: 12 }
    t.deepEqual(text.substring(12), "7")
    t.deepEqual(peg.formatError(text, err), "7:1: msg")
})

test('terminated', t => {
    const term = peg.terminated(peg.any(peg.match('0'), peg.match('1')), peg.match('2'))
    t.deepEqual(term.parse('1012'), ['1', '0', '1'])
    t.throws(() => term.parse('1013'), "1:4: can't match '0'")
})
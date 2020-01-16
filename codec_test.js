const codec = require('./codec')

const obj = {
    a : [1, 2, 3, 4],
    b : [3, 7],
    c : 257
}

console.log(codec)
const enc_test_obj = codec.enc_struct([
    ['a', codec.enc_fixed_array_of(codec.enc_u8, 4)],
    ['c', codec.enc_u16],
    ['b', codec.enc_array_of(codec.enc_i8)]
])

const wr1 = codec.writer(10)
enc_test_obj(obj, wr1)
console.log(wr1.buf)

const dec_test_obj = codec.dec_struct([
    ['a', codec.dec_fixed_array_of(codec.dec_u8, 4)],
    ['c', codec.dec_u16],
    ['b', codec.dec_array_of(codec.dec_i8)]
])
const rd1 = codec.reader(wr1.buf, 0)
rt_obj = dec_test_obj(rd1)
console.log(rt_obj)

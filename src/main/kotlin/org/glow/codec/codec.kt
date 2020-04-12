package org.glow.codec


/*TODO: translate from JS
function writer(size) {
    return {
        buf: Buffer.allocUnsafe(size),
        size: size,
        pos: 0,
        ensure: function(to_write) {
        if (this.pos + to_write >= this.size) this.extend(this.pos + to_write)
    },
        extend: function(needed) {
        const inc = this.size/4 + 16
        if (this.size + inc >= needed) this.size += inc
        else {
            this.size = needed
        }
    }
    }
}

function enc_u8(obj, wr) {
    wr.ensure(1)
    wr.pos = wr.buf.writeUInt8(obj, wr.pos)
}

function enc_u16(obj, wr) {
    wr.ensure(2)
    wr.pos = wr.buf.writeUInt16BE(obj, wr.pos)
}

function enc_u32(obj, wr) {
    wr.ensure(4)
    wr.pos = wr.buf.writeUInt32BE(obj, wr.pos)
}

function enc_i8(obj, wr) {
    wr.ensure(1)
    wr.pos = wr.buf.writeInt8(obj, wr.pos)
}

function enc_i16(obj, wr) {
    wr.ensure(2)
    wr.pos = wr.buf.writeInt16BE(obj, wr.pos)
}

function enc_i32(obj, wr) {
    wr.ensure(4)
    wr.pos = wr.buf.writeInt32BE(obj, wr.pos)
}
// encode var-length unsigned
function enc_vu(obj, wr) {
    if (obj < 0x80) {
        enc_u8(obj & 0x7F, wr)
    }
    else if (obj < 0x4000) {
        enc_u8(((obj >> 7) & 0x7F) | 0x80, wr)
        enc_u8(obj & 0x7F, wr)
    }
    else if (obj < 0x200000) {
        enc_u8(((obj >> 14) & 0x7F) | 0x80, wr)
        enc_u8(((obj >> 7) & 0x7F) | 0x80, wr)
        enc_u8(obj & 0x7F, wr)
    }
}

function enc_array_of(enc) {
    return (obj, wr) => {
        enc_vu(obj.length, wr)
        enc_fixed_array_of(enc, obj.length)(obj, wr)
    }
}

function enc_fixed_array_of(enc, size) {
    return (obj, wr) => {
        for(let i = 0; i < size; i++) enc(obj[i], wr)
    }
}

function enc_option(enc) {
    return (obj, wr) => {
        if (obj == null) enc_u8(0, wr)
        else {
            enc_u8(1, wr)
            enc(obj, wr)
        }
    }
}

function enc_if(enc, pred) {
    return (obj, wr) => {
        if (pred(obj)) {
            enc(obj, wr)
            return true
        }
        else
            return false
    }
}

function enc_any_of(encs) {
    return (obj, wr) => {
        let start = wr.pos
                wr.pos += 1 // TODO: more then 255 alternatives?
        for (let i = 0; i<encs.length; i++) {
        if(encs[i](obj, wr)) wr.buf.writeUInt8(i, start)
    }
    }
}
// enc_pairs is : [ [key, enc], [key, enc], ... ]
function enc_struct(enc_pairs) {
    return (obj, wr) => {
        for (let item of enc_pairs) {
        let value = obj[item[0]]
        let enc = item[1]
        enc(value, wr)
    }
    }
}


function reader(buf, offset) {
    return {
        buf: buf,
        size: buf.size,
        pos: offset,
        ensure: function(to_read){
        if (this.pos + to_read >= this.size) this.fail("out of bounds")
    },
        fail: function(msg) {
        throw new Error("failed to decode - " + msg + " at " + this.pos + " / " + this.size)
    }
    }
}

function dec_u8(rd) {
    rd.ensure(1)
    return rd.buf.readUInt8(rd.pos++)
}

function dec_u16(rd) {
    rd.ensure(2)
    let pos = rd.pos
            rd.pos += 2
    return rd.buf.readUInt16BE(pos)
}

function dec_u32(rd) {
    rd.ensure(4)
    let pos = rd.pos
            rd.pos += 4
    return rd.buf.readUInt32BE(pos)
}

function dec_i8(rd) {
    rd.ensure(1)
    return rd.buf.readInt8(rd.pos++)
}

function dec_i16(rd) {
    rd.ensure(2)
    let pos = rd.pos
            rd.pos += 2
    return rd.buf.readInt16BE(pos)
}

function dec_i32(rd) {
    rd.ensure(4)
    let pos = rd.pos
            rd.pos += 4
    return rd.buf.readInt32BE(pos)
}

function dec_vu(rd) {
    let v = 0
    for (;;) {
        let s = dec_u8(rd)
        let sv = s & 0x7F
        v = (v << 7) | sv
        if (s == sv) break
    }
    return v
}

function dec_array_of(dec) {
    return rd => {
        let size = dec_vu(rd)
        return dec_fixed_array_of(dec, size)(rd)
    }
}

function dec_fixed_array_of(dec, size) {
    return rd => {
        if (size < 0 || size > rd.size) rd.fail("corrupted array size")
        let arr = new Array(size)
        for (let i = 0; i <size; i++) arr[i] = dec(rd)
        return arr
    }
}

function dec_option(dec) {
    return rd => {
        let marker = dec_u8(rd)
        if (marker != 0) return dec(rd)
    }
}

function dec_any_of(decs) {
    return rd => {
        let n = dec_u8(rd)
        if (n >= decs.length) rd.fail("corrupted any-of marker")
        return decs[n](rd)
    }
}

function dec_struct(dec_pairs) {
    return rd => {
        let kv = {}
        for (let item of dec_pairs) {
        let key = item[0]
        let dec = item[1]
        kv[key] = dec(rd)
    }
        return kv
    }
}
*/
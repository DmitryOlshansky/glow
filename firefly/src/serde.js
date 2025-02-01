
class Stream {
    buf;
    rdx;
    wdx;
    constructor(size) {
        this.buf = new Uint8Array(new ArrayBuffer(size));
        this.rdx = 0;
        this.wdx = 0;
    }
    writeByte(byte) {
        this.buf[this.wdx++] = byte
    }
    writeBytes(bytes) {
        this.buf.set(bytes, this.wdx)
        this.wdx += bytes.length
    }
    readByte() {
        return this.buf[this.rdx++]
    }
    readBytes(len) {
        const bytes = this.buf.subarray(this.rdx, this.rdx + len) // gets view not a copy!
        this.rdx += len
        return bytes
    }
    toArray() {
        return this.buf.slice(0, this.wdx)
    }
    reset() {
        this.wdx = 0
        this.rdx = 0
    }
}

export function stream(size) {
    return new Stream(size)
}

export class Serializer {
    ser;
    deser;
    constructor(ser, deser) {
        this.ser = ser
        this.deser = deser
    }
}

export const Byte = new Serializer((value, stream) => {
    stream.writeByte(value)
}, (stream) => {
    return stream.readByte()
})

export const Base128 = new Serializer((num, stream) => {
    const parts = []
    while (num >= 128) {
        const low = num & 0x7F;
        num >>= 7
        parts.push(low)
    }
    parts.push(num)
    for (let i=parts.length-1; i>0; i--) {
        stream.writeByte(parts[i] | 0x80)
    }
    stream.writeByte(parts[0])
}, (stream) => {
    let c = 0
    let num = 0
    do {
        c = stream.readByte()
        num = (num << 7) | (c & 0x7F)
    } while (c & 0x80)
    return num
})

export function ByteArray(size) {
    return new Serializer((value, stream) => {
        stream.writeBytes(value)
    }, (stream) => {
        return stream.readBytes(size)
    })
}

export const DynByteArray = new Serializer((arr, stream) => {
    Base128.ser(arr.length, stream)
    stream.writeBytes(arr)
}, (stream) => {
    const len = Base128.deser(stream)
    return stream.readBytes(len)
})

export function seq(...serializers) {
    return new Serializer((value, stream) => {
        let i = 0
        for (const s of serializers) {
            s.ser(value[i++], stream)    
        }
    }, (stream) => {
        const value = Array(serializers.length)
        let i = 0
        for (const s of serializers) {
            value[i++] = s.deser(stream)
        }
        return value
    })
}

export function arrayOf(serde) {
    return new Serializer((array, stream) => {
        Base128.ser(array.length, stream)
        for (const v of array) {
            serde.ser(v, stream)
        }
    }, (stream) => {
        const len = Base128.deser(stream)
        const arr = Array(len)
        for (let i = 0; i < len; i++) {
            arr[i] = serde.deser(stream)
        }
        return arr
    })
}

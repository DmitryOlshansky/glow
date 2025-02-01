
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
        const bytes = this.buf.slice(this.rdx, this.rdx + len)
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

class Serializer {
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

export function ByteArray(size) {
    return new Serializer((value, stream) => {
        stream.writeBytes(value)
    }, (stream) => {
        return stream.readBytes(size)
    })
}

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


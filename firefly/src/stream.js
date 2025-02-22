
export class Stream {
    kind;
    constructor() {
        this.buffer = new Array()
        this.errorBuffer = null
        this.closed = null
        this.dataCallback = null
        this.errorCallback = null
    }

    write(data) {
        if (this.dataCallback) this.dataCallback(data)
        else {
            this.buffer.push(data)
        }
    }

    close() {
        if (this.closeCallback) this.closeCallback()
        else this.closed = true
    }

    error(e) {
        if (this.errorCallback) this.errorCallback(e)
        else this.errorBuffer = e
    }

    onData(callback) {
        this.dataCallback = callback
        for (const data of this.buffer) {
            this.dataCallback(data)
            this.buffer.length = 0
        }
    }

    onError(callback) {
        this.errorCallback = callback
        if (this.errorBuffer) this.errorCallback(this.errorBuffer)
    }

    onClose(callback) {
        this.closeCallback = callback
        if (this.closed) this.closeCallback()
    }
}
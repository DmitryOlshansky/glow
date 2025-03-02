import * as fs from 'node:fs'
import * as prmoisesFs from 'node:fs/promises'

export function setup(cluster) {

    class LocalFS extends cluster.Resource {
        constructor(id, owner) {
            super(id, owner, cluster.module.proto('FileSystem'))
            this.fds = []
        }

        async open(path, mode) {
            const handle = await prmoisesFs.open(path, mode)
            for (let i = 0; i < this.fds.length; i++) {
                if (this.fds[i] === null) {
                    this.fds[i] = handle
                    return i
                }
            }
            const fd = this.fds.length
            this.fds.push(handle)
            return fd
        }

        async read(fd, size) {
            const handle = this.fds[fd]
            const result = await handle.read({ buffer: Buffer.alloc(size), length: size })
            if (result.bytesRead == 0)
                return new Uint8Array()
            return new Uint8Array(result.buffer.subarray(0, result.bytesRead))
        }

        async write(fd, buf) {
            const handle = this.fds[fd]
            await handle.write(buf)
        }

        async close(fd) {
            const handle = this.fds[fd]
            this.fds[fd] = null
            return await handle.close()
        }
    }

    return { LocalFS }
}

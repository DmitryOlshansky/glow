package dev.glow.firefly.network

import dev.glow.api.*

interface FireflyContext {
    fun nextNonce(): Nonce

    fun message(bytes: Bytes, nonce: Nonce?)

    fun call(id: Id, bytes: Bytes, nonce: Nonce?)

    fun reply(bytes: Bytes)

    fun error(code: ErrorCode)
}

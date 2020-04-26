package dev.glow.crypto

import dev.glow.firefly.api.*

// This interface simply provides the required libsodium primitives on the JVM platform
interface Cryptography {
    fun kexKeyPair(): Pair<PubKey, SecretKey>
    
    fun sessionKeys(ourSecret: SecretKey, ourPubKey: PubKey, remotePubKey: PubKey): SessionKeys
    
    fun verify(pbk: PubKey, datum: Bytes, signature: Signature): Boolean

    fun sign(prk: SecretKey, datum: Bytes): Signature

    fun encrypt(key: AeadKey, vararg datum: Bytes)
    
    fun decrypt(key: AeadKey, vararg datum: Bytes): Boolean
}
const sodium = require('sodium').api

let total = 0
for (let i = 0; i < 100000; i ++) {
    const pair = sodium.crypto_sign_keypair()
    total += pair.publicKey.length + pair.secretKey.length
}
console.log(total)

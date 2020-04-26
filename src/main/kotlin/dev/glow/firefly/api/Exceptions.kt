package dev.glow.firefly.api

import dev.glow.firefly.serialization.FireflyException

class FireflyNetworkException(val code: ErrorCode): FireflyException("Firefly network exception - $code")

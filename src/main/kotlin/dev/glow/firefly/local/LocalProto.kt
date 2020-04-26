package dev.glow.firefly.local

import dev.glow.firefly.api.Id
import dev.glow.firefly.api.Method
import dev.glow.firefly.api.Proto

class LocalProto(id: Id, val extends: List<Id>, val methods: List<Method>) : Proto, Resource(id) {
    override fun extends(): List<Id> = extends

    override fun methods(): List<Method> = methods
}

package dev.glow.api.impl

import dev.glow.api.Id
import dev.glow.api.Method
import dev.glow.api.Proto

class LocalProto(id: Id, val extends: List<Id>, val methods: List<Method>) : Proto, Resource(id) {
    override fun extends(): List<Id> = extends

    override fun methods(): List<Method> = methods
}

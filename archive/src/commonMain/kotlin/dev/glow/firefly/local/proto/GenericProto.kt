package dev.glow.firefly.local.proto

import dev.glow.firefly.api.Id
import dev.glow.firefly.api.Method
import dev.glow.firefly.api.Proto
import dev.glow.firefly.local.Resource

class GenericProto(id: Id, val extends: List<Id>, val methods: List<Method>) : Proto, Resource(id) {
    override fun extends(): List<Id> = extends

    override fun methods(): List<Method> = methods
}

package dev.glow.firefly.compiler

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap

// for *.firefly protocol compiler
class FireflyTypeSystem : TypeSystem {
    private val names: ConcurrentMap<String, Type> = ConcurrentHashMap()

    override fun register(name: String, type: Type): Type =
        names.computeIfAbsent(name) { type }

    private fun resolveImpl(name: String, visited: MutableSet<String>): Type {
        if (visited.contains(name)) throw TypeSystemError("Circular type reference: $name, cycled via $visited")
        return names[name]?.let {
            when(it) {
                is Type.Alias -> resolveImpl(it.name, mutableSetOf(name))
                else -> it.resolve()
            }
        } ?: throw TypeSystemError("Undefined type name $name")
    }

    override fun resolve(name: String): Type = resolveImpl(name, mutableSetOf())
}

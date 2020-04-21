package org.glow.proto

interface TypeSystem  {
    // idempotent and must return existing type that was registered with that name
    // if the types conform, or throw TypeSystemException
    fun register(name: String, type: Type): Type

    // lookup type by alias
    fun resolve(name: String): Type
}

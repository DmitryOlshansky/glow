package dev.glow.api.impl

import dev.glow.api.Addr
import dev.glow.api.Id
import dev.glow.api.Resource
import dev.glow.firefly.network.FireflyContext
import java.util.concurrent.atomic.AtomicReference

abstract class Resource(override val id: Id, label: String = "") : Resource {
    private val labelSlot = AtomicReference(label)
    override fun label(fly: FireflyContext): String = labelSlot.get()

    override fun relabel(fly: FireflyContext, label: String) {
        this.labelSlot.set(label)
    }

    override fun describe(fly: FireflyContext): String = label(fly).let {
        if (it.isNotBlank()) "$it($id)" else "$id"
    }

    override fun transfer(fly: FireflyContext, newOwner: Id) {
        val requester = fly.network.lookup(this, fly.source)
        val beneficiary = fly.network.lookup(requester, Addr(newOwner.value))
        fly.network.transfer(requester, beneficiary, this.id)
    }
}
package dev.glow.api.local

import dev.glow.api.*
import dev.glow.firefly.network.FireflyContext
import java.util.concurrent.Callable
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicReference
import java.util.logging.Logger.getLogger

class LocalTask(id: Id, val exec: ExecutorService) : Resource(id), Task {
    private val log = getLogger(this::class.java.name)
    private val program = AtomicReference<Bytes?>()
    private val config = AtomicReference<Map<String, Bytes>?>()
    private val runnable = AtomicReference<Future<Unit>>()

    override fun run(fly: FireflyContext): CompletableFuture<Unit> {
        stop(fly)
        val current = program.get()
        if (current != null) {
            val submitted = exec.submit(Callable<Unit> {
                log.info("Starting task $id with program $current")
                //TODO: load as JAR, validate signature and execute in sandbox using special class loader
            })
            runnable.set(submitted)
        }
        return CompletableFuture.completedFuture(Unit)
    }

    override fun stop(fly: FireflyContext): CompletableFuture<Unit> {
        runnable.get()?.apply {
            cancel(true)
        }
        return CompletableFuture.completedFuture(Unit)
    }
    
    override fun program(fly: FireflyContext, image: Bytes): CompletableFuture<Unit> {
        program.set(image)
        return CompletableFuture.completedFuture(Unit)
    }

    override fun configure(fly: FireflyContext, kv: Map<String, Bytes>): CompletableFuture<Unit> {
        config.set(kv)
        return CompletableFuture.completedFuture(Unit)
    }
}

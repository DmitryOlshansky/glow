package org.glow.proto

import java.util.function.Function

sealed class Parsed<out T>

data class Got<T>(val value: T) : Parsed<T>()
data class Error(val message: String, val offset: Int): Parsed<Nothing>() {
    fun format(input: CharSequence): String {
        var line = 1
        var lastLineOffset = 0
        for (i in 0 until offset) {
            val c = input[i]
            val nextNl = i + 1 < offset && input[i+1] == '\n'
            if (c == '\n' || (c == '\r' && !nextNl)) {
                line++
                lastLineOffset = i
            }
        }
        val col = offset - lastLineOffset
        return "$line:$col: $message"
    }
}

data class State(val input: CharSequence, val ofs: Int)

abstract class Peg<T> : Function<State, Pair<State, Parsed<T>>> {
    fun parse(input: CharSequence): Parsed<T> = apply(State(input, 0)).second
    
    fun<R> map(g: (T) -> R): Peg<R> = object : Peg<R>() {
        override fun apply(state: State): Pair<State, Parsed<R>> {
            val (next, result) = this@Peg.apply(state)
            return when (result){
                is Got -> next to Got(g(result.value))
                is Error -> next to result
            }
        }
    }

    fun<U> flatMap(p: Peg<U>): Peg<Pair<T,U>> = object : Peg<Pair<T, U>>() {
        override fun apply(t: State): Pair<State, Parsed<Pair<T,U>>> {
            val (next, result) = this@Peg.apply(t)
            return when (result) {
                is Error -> next to result
                is Got -> {
                    val (next2, result2) = p.apply(next)
                    when (result2) {
                        is Error -> next2 to Error("flatMap", next2.ofs)
                        is Got -> {
                            next2 to Got(result.value to result2.value)
                        }
                    }
                }
            }
        }
    }
}


fun match(text: String): Peg<String> = object : Peg<String>() {
    override fun apply(t: State): Pair<State, Parsed<String>> =
            if (t.input.regionMatches(t.ofs, text, 0, text.length))
                t.copy(ofs = t.ofs + text.length) to Got(text)
            else
                t to Error(text, t.ofs) // todo: use exact offset of mismatch instead
}

fun sliceMatching(name: String, min: Int, cond: (Char) -> Boolean): Peg<CharSequence> = object : Peg<CharSequence>() {
    override fun apply(t: State): Pair<State, Parsed<CharSequence>> {
        var j = t.ofs
        while (j < t.input.length && cond(t.input[j])) { j++ }
        val r = t.input.subSequence(t.ofs, j)
        return if (r.length < min) t to Error(name, t.ofs)
        else t.copy(ofs = j) to Got(r)

    }
}

fun<T> any(name: String, vararg pegs: Peg<T>): Peg<T> = object : Peg<T>() {
    override fun apply(t: State): Pair<State, Parsed<T>> {
        for (p in pegs) {
            val (next, result) = p.apply(t)
            if (result is Got) return next to result
        }
        return t to Error(name, t.ofs)
    }
}

fun<T> repeat(name: String, peg: Peg<T>, min: Int = 0, max: Int = 1_000_000_000): Peg<List<T>> = object : Peg<List<T>>() {
    override fun apply(t: State): Pair<State, Parsed<List<T>>> {
        var current = t
        var last = t
        val items = mutableListOf<T>()
        for (i in 0 until max) {
            val (next, r) = peg.apply(current)
            when (r) {
                is Error -> return when {
                    i >= min -> last to Got(items)
                    else -> last to Error(name, current.ofs)
                }
                is Got -> items.add(r.value)
            }
            if (i >= min) last = current
            current = next
        }
        return current to Got(items)
    }
}

fun<T, U, R> seq(first: Peg<T>, second: Peg<U>, cons: (T, U) -> R): Peg<R> =
        first.flatMap(second).map { (first, second) ->
            cons(first, second)
        }

fun <T, U, S, R> seq(first: Peg<T>, second: Peg<U>, third: Peg<S>, cons: (T, U, S) -> R): Peg<R> =
        first.flatMap(second).flatMap(third).map { (first, second) ->
            cons(first.first, first.second, second)
        }

class LazyPeg<T>(var wrapped: Peg<T>? = null): Peg<T>() {
    override fun apply(t: State): Pair<State, Parsed<T>> =
            requireNotNull(wrapped).apply(t)
    fun bind(peg: Peg<T>): LazyPeg<T> = apply { wrapped = peg }
}

object EOF : Peg<Unit>() {
    override fun apply(t: State): Pair<State, Parsed<Unit>> =
            if (t.ofs == t.input.length) t to Got(Unit)
            else t to Error("eof", t.ofs)
}

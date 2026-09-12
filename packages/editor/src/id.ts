/**
 * How new element ids are minted.
 *
 * Normally this is `Math.random()`, which is exactly right for one person
 * editing one diagram. It is wrong the moment the same edit has to happen twice
 * — replayed on a server, or on someone else's screen — because two runs would
 * invent two different ids for the same new task.
 *
 * So the minting functions in `modeling.ts` take an optional {@link IdFactory}.
 * An operation carries a seed, both sides build the same factory from it, and
 * the same edit produces byte-identical XML wherever it runs.
 */

/** Mints an id for a new element, given the prefix its type wants. */
export type IdFactory = (prefix: string) => string

/** The default: unique enough for one editor, different on every call. */
export function genId(prefix: string): string {
	return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * A factory that yields the same sequence of ids for the same seed.
 *
 * Deterministic *in call order*, which is the contract an operation replay
 * relies on: the same function, given the same arguments, asks for the same
 * prefixes in the same order, so it gets the same ids back.
 */
export function createIdFactory(seed: string): IdFactory {
	// FNV-1a over the seed, then xorshift32 per id. Small, dependency-free, and
	// the output is shaped like `genId`'s so nothing downstream can tell them apart.
	let state = 2166136261
	for (let i = 0; i < seed.length; i++) {
		state ^= seed.charCodeAt(i)
		state = Math.imul(state, 16777619)
	}
	return (prefix: string): string => {
		state ^= state << 13
		state ^= state >>> 17
		state ^= state << 5
		return `${prefix}_${(state >>> 0).toString(36).padStart(7, "0").slice(0, 7)}`
	}
}

/** A seed with enough entropy that two operations cannot mint the same ids. */
export function newIdSeed(): string {
	return Math.random().toString(36).slice(2, 12)
}

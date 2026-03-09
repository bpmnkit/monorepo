interface CacheEntry<T> {
	value: T
	expiresAt: number
}

/**
 * Simple LRU cache with TTL expiry. No external dependencies.
 */
export class Cache {
	#store = new Map<string, CacheEntry<unknown>>()
	#ttl: number
	#maxSize: number

	constructor(ttl: number, maxSize: number) {
		this.#ttl = ttl
		this.#maxSize = maxSize
	}

	get<T>(key: string): T | undefined {
		const entry = this.#store.get(key)
		if (!entry) return undefined
		if (Date.now() > entry.expiresAt) {
			this.#store.delete(key)
			return undefined
		}
		// LRU: move to end by re-inserting
		this.#store.delete(key)
		this.#store.set(key, entry)
		return entry.value as T
	}

	set(key: string, value: unknown, ttlOverride?: number): void {
		if (this.#store.size >= this.#maxSize) {
			// Evict oldest entry (first in insertion order)
			const oldest = this.#store.keys().next().value
			if (oldest !== undefined) {
				this.#store.delete(oldest)
			}
		}
		this.#store.set(key, {
			value,
			expiresAt: Date.now() + (ttlOverride ?? this.#ttl),
		})
	}

	delete(key: string): void {
		this.#store.delete(key)
	}

	clear(): void {
		this.#store.clear()
	}

	get size(): number {
		return this.#store.size
	}
}

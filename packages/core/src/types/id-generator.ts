const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const ID_SIZE = 8

// Random bytes are drawn in batches: one getRandomValues call per id is
// dominated by the crypto call overhead, not by the bytes it returns.
const POOL_SIZE = 1024
const pool = new Uint8Array(POOL_SIZE)
let poolOffset = POOL_SIZE

function nanoId(): string {
	if (poolOffset + ID_SIZE > POOL_SIZE) {
		crypto.getRandomValues(pool)
		poolOffset = 0
	}
	let id = ""
	for (let i = 0; i < ID_SIZE; i++) {
		id += ALPHABET[(pool[poolOffset + i] as number) % ALPHABET.length]
	}
	poolOffset += ID_SIZE
	return id
}

// Counter used only in deterministic test mode (activated by resetIdCounter())
let _counter = 0
let _deterministic = false

/** Generates a unique ID with the given prefix. */
export function generateId(prefix: string): string {
	if (_deterministic) {
		_counter++
		return `${prefix}_${_counter.toString(36).padStart(7, "0")}`
	}
	return `${prefix}_${nanoId()}`
}

/**
 * Switches to deterministic counter-based IDs and resets the counter.
 * Call this in test `beforeEach` to get stable, predictable IDs.
 */
export function resetIdCounter(): void {
	_counter = 0
	_deterministic = true
}

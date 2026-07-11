/** Share/file id generation and content hashing. Runs on both Workers and Node (Web Crypto). */

// base58 alphabet — omits 0/O/I/l to stay copy-paste safe.
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

/** Random base58 string, uniformly distributed (rejection sampling avoids modulo bias). */
export function randomBase58(length: number): string {
	let out = ""
	while (out.length < length) {
		const bytes = new Uint8Array(length)
		crypto.getRandomValues(bytes)
		for (const b of bytes) {
			if (b >= 232) continue // 232 = 58 * 4; reject the tail to keep it unbiased
			out += BASE58[b % 58]
			if (out.length === length) break
		}
	}
	return out
}

/** 11 base58 chars ≈ 64 bits of entropy — unguessable, unlistable share id. */
export function newShareId(): string {
	return randomBase58(11)
}

/** Internal file id. */
export function newFileId(): string {
	return randomBase58(12)
}

/** Lowercase hex SHA-256 of a string or byte array. */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
	const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
	const digest = await crypto.subtle.digest("SHA-256", bytes)
	let hex = ""
	for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0")
	return hex
}

/** Salted hash of a reporter IP — stored instead of the raw IP (dedup + rate-limit only). */
export async function hashIp(ip: string, salt: string): Promise<string> {
	return sha256Hex(`${salt}:${ip}`)
}

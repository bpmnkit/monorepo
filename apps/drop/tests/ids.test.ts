import { describe, expect, it } from "vitest"
import { hashIp, newFileId, newShareId, randomBase58, sha256Hex } from "../src/lib/ids.js"

const BASE58_RE = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/

describe("randomBase58", () => {
	it("produces the requested length using only the base58 alphabet", () => {
		for (const len of [1, 11, 12, 40]) {
			const s = randomBase58(len)
			expect(s).toHaveLength(len)
			expect(s).toMatch(BASE58_RE)
		}
	})

	it("is effectively unique across many draws", () => {
		const seen = new Set<string>()
		for (let i = 0; i < 5000; i++) seen.add(newShareId())
		expect(seen.size).toBe(5000)
	})
})

describe("newShareId / newFileId", () => {
	it("uses the documented lengths", () => {
		expect(newShareId()).toHaveLength(11)
		expect(newFileId()).toHaveLength(12)
	})
})

describe("sha256Hex", () => {
	it("matches the known digest of an empty input", async () => {
		expect(await sha256Hex("")).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		)
	})

	it("is stable and agrees between string and byte inputs", async () => {
		const a = await sha256Hex("hello")
		const b = await sha256Hex(new TextEncoder().encode("hello"))
		expect(a).toBe(b)
		expect(a).toMatch(/^[0-9a-f]{64}$/)
	})
})

describe("hashIp", () => {
	it("is deterministic and salt-dependent", async () => {
		const a = await hashIp("203.0.113.7", "salt-a")
		const b = await hashIp("203.0.113.7", "salt-a")
		const c = await hashIp("203.0.113.7", "salt-b")
		expect(a).toBe(b)
		expect(a).not.toBe(c)
	})
})

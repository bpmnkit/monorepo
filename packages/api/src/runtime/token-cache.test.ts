import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { FileTokenStore } from "./token-cache.js"

const dirs: string[] = []
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "token-cache-"))
	dirs.push(dir)
	return dir
}

const token = { accessToken: "secret", expiresAt: Date.now() + 3_600_000 }

describe.skipIf(process.platform === "win32")("FileTokenStore permissions", () => {
	it("writes the cache readable by its owner only", async () => {
		const file = join(tempDir(), "nested", "tokens.json")
		await new FileTokenStore(file).set("k", token)
		expect(statSync(file).mode & 0o777).toBe(0o600)
		expect(statSync(join(file, "..")).mode & 0o777).toBe(0o700)
	})

	it("tightens a cache file written with default permissions", async () => {
		const file = join(tempDir(), "tokens.json")
		writeFileSync(file, "{}", { mode: 0o644 })
		await new FileTokenStore(file).set("k", token)
		expect(statSync(file).mode & 0o777).toBe(0o600)
		expect(await new FileTokenStore(file).get("k")).toEqual(token)
	})
})

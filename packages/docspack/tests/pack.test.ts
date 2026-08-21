import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildPack } from "../src/build.js"
import { chunkPath, indexPacks, loadPack } from "../src/load.js"
import { answer, search } from "../src/search.js"

const CHUNK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

let root: string
let packDir: string

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "docspack-"))
	packDir = join(root, "pack")
	const source = join(root, "docs")
	mkdirSync(join(source, "guides"), { recursive: true })
	mkdirSync(join(packDir, ".llms"), { recursive: true })

	writeFileSync(
		join(source, "guides", "webhooks.md"),
		doc("Webhooks", "Verifying a signature", [
			"Compare the header with `timingSafeEqual` and reject the request when the",
			"signature does not match. Authentication of the caller happens before any",
			"handler runs, so a forged event never reaches your process.",
		]),
	)
	writeFileSync(
		join(source, "guides", "gateways.md"),
		doc("Gateways", "Exclusive gateways", [
			"An exclusive gateway takes exactly one outgoing path. Give every flow a FEEL",
			"condition and mark one of them as the default so the process cannot deadlock",
			"when no condition evaluates to true at runtime.",
		]),
	)
	writeFileSync(
		join(packDir, "package.json"),
		JSON.stringify({ name: "@acme/docspack", version: "1.2.3" }),
	)

	buildPack({
		source,
		packDir,
		name: "@acme/docspack",
		version: "1.2.3",
		documents: ["@acme/sdk@1.2.3"],
		siteUrl: "https://example.test",
	})
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe("buildPack", () => {
	it("writes a manifest that satisfies the v1 schema's required shape", () => {
		const manifest = JSON.parse(readFileSync(join(packDir, ".llms", "manifest.json"), "utf8"))
		expect(manifest.$schema).toBe("https://docspack.dev/schema/v1.json")
		expect(manifest.name).toBe("@acme/docspack")
		expect(manifest.version).toBe("1.2.3")
		expect(manifest.documents).toEqual(["@acme/sdk@1.2.3"])
		expect(manifest.chunks.length).toBeGreaterThan(0)
		for (const chunk of manifest.chunks) {
			expect(chunk.id).toMatch(CHUNK_ID)
			expect(chunk.file).toMatch(/^chunks\//)
			expect(Number.isInteger(chunk.tokens) && chunk.tokens >= 1).toBe(true)
		}
	})

	it("writes an llms.txt table of contents at the package root", () => {
		const toc = readFileSync(join(packDir, "llms.txt"), "utf8")
		expect(toc).toContain("# @acme/docspack")
		expect(toc).toContain(".llms/chunks/")
	})

	it("removes chunks that no longer exist in the source", () => {
		const stale = join(packDir, ".llms", "chunks", "stale.md")
		writeFileSync(stale, "gone")
		buildPack({
			source: join(root, "docs"),
			packDir,
			name: "@acme/docspack",
			version: "1.2.3",
			documents: ["@acme/sdk@1.2.3"],
		})
		expect(() => readFileSync(stale, "utf8")).toThrow()
	})

	it("keeps chunk ids unique when two documents want the same one", () => {
		const collide = join(root, "collide")
		mkdirSync(join(collide, "cli"), { recursive: true })
		// Both of these want the id "cli.casen": a page at cli/casen with no sections,
		// and a "## casen" section of a page at cli.
		writeFileSync(join(collide, "cli", "casen.md"), "---\ntitle: Casen\n---\n\nBody text.\n")
		writeFileSync(join(collide, "cli.md"), doc("CLI", "casen", ["Body text."]))

		const out = join(root, "collide-pack")
		mkdirSync(join(out, ".llms"), { recursive: true })
		writeFileSync(join(out, "package.json"), JSON.stringify({ name: "@a/docspack", version: "1" }))
		buildPack({
			source: collide,
			packDir: out,
			name: "@a/docspack",
			version: "1",
			documents: ["a"],
		})

		const ids = loadPack(out).manifest.chunks.map((chunk) => chunk.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toContain("cli.casen")
		expect(ids).toContain("cli.casen-2")
	})

	it("refuses a source directory with no Markdown in it", () => {
		const empty = join(root, "empty")
		mkdirSync(empty, { recursive: true })
		expect(() =>
			buildPack({ source: empty, packDir, name: "x", version: "1", documents: ["x"] }),
		).toThrow(/no Markdown documents/)
	})
})

describe("loadPack", () => {
	it("reads the package it just built", () => {
		const pack = loadPack(packDir)
		expect(pack.name).toBe("@acme/docspack")
		expect(pack.version).toBe("1.2.3")
		expect(pack.trusted).toBe(true)
		expect(pack.versionMismatch).toBeUndefined()
	})

	it("lets the installed package.json version win over the manifest", () => {
		const manifestPath = join(packDir, ".llms", "manifest.json")
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
		writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: "9.9.9" }))
		const pack = loadPack(packDir)
		expect(pack.version).toBe("1.2.3")
		expect(pack.versionMismatch).toBe("9.9.9")
		writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t"))
	})

	it("marks a community package as untrusted", () => {
		const dir = communityPack("@docspack-community/acme")
		expect(loadPack(dir).trusted).toBe(false)
	})

	it("refuses a chunk path that escapes .llms/", () => {
		expect(() => chunkPath(packDir, { id: "x", file: "../../etc/passwd" })).toThrow(/escapes/)
		expect(() => chunkPath(packDir, { id: "x", file: "" })).toThrow(/escapes/)
	})

	it("refuses a duplicate chunk id", () => {
		const dir = communityPack("@docspack-community/dupes", [
			{ id: "a", file: "chunks/a.md" },
			{ id: "a", file: "chunks/a.md" },
		])
		expect(() => loadPack(dir)).toThrow(/duplicate chunk id/)
	})

	it("refuses a chunk id the manifest pattern does not allow", () => {
		const dir = communityPack("@docspack-community/bad-id", [{ id: "../x", file: "chunks/a.md" }])
		expect(() => loadPack(dir)).toThrow(/not a valid id/)
	})

	it("refuses a token count of zero", () => {
		const dir = communityPack("@docspack-community/zero", [
			{ id: "a", file: "chunks/a.md", tokens: 0 },
		])
		expect(() => loadPack(dir)).toThrow(/at least 1/)
	})
})

describe("search", () => {
	it("finds a chunk through a stemmed word it never literally contains", () => {
		const index = indexPacks([loadPack(packDir)])
		const [top] = search(index, "authenticate a caller", { limit: 1 })
		expect(top?.chunkId).toContain("webhooks")
	})

	it("names the pack, version and chunk in the identifier an answer shows", () => {
		const index = indexPacks([loadPack(packDir)])
		const [top] = search(index, "exclusive gateway default flow", { limit: 1 })
		expect(top?.chunkId).toMatch(/^@acme\/docspack@1\.2\.3\/guides\.gateways/)
	})

	it("returns nothing for a query of only stop words", () => {
		const index = indexPacks([loadPack(packDir)])
		expect(search(index, "how do I use the")).toEqual([])
	})

	it("restricts to the requested package", () => {
		const index = indexPacks([loadPack(packDir)])
		expect(search(index, "gateway", { packs: ["@other/docspack"] })).toEqual([])
	})
})

describe("answer", () => {
	it("spends no more than the token budget", () => {
		const index = indexPacks([loadPack(packDir)])
		const result = answer(index, "gateway signature", { maxTokens: 60 })
		expect(result.tokens).toBeLessThanOrEqual(60)
		for (const hit of result.hits) expect(hit.tokens).toBeLessThanOrEqual(60)
	})

	it("returns at most the requested number of chunks", () => {
		const index = indexPacks([loadPack(packDir)])
		expect(answer(index, "gateway signature process", { limit: 1 }).hits).toHaveLength(1)
	})
})

function doc(title: string, heading: string, body: string[]): string {
	return ["---", `title: ${title}`, "---", "", `## ${heading}`, "", ...body, ""].join("\n")
}

function communityPack(name: string, chunks = [{ id: "a", file: "chunks/a.md" }]): string {
	const dir = join(root, name.replace(/[@/]/g, "_"))
	mkdirSync(join(dir, ".llms", "chunks"), { recursive: true })
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "0.1.0" }))
	writeFileSync(join(dir, ".llms", "chunks", "a.md"), "# A\n\nbody\n")
	writeFileSync(
		join(dir, ".llms", "manifest.json"),
		JSON.stringify({ name, version: "0.1.0", chunks }),
	)
	return dir
}

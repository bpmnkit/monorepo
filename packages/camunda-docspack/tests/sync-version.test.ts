import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

/**
 * This pack's payload is committed rather than rebuilt at release time — the
 * rebuild needs a `camunda-docs` checkout that only the weekly workflow has. So
 * `changeset version` moved `package.json` while `.llms/manifest.json` and
 * `llms.txt` kept the version of the last rebuild, and `@bpmnkit/camunda-docspack@0.1.0`
 * published a manifest claiming `0.0.0`. `docspack doctor` fails that, and
 * `docspack list` reports it to every consumer.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, "..", "scripts", "sync-version.mjs")
const PACK = join(HERE, "..")

let work = ""
afterEach(() => {
	if (work !== "") rmSync(work, { recursive: true, force: true })
	work = ""
})

/** A pack whose payload says `payloadVersion` and whose package.json says `version`. */
function pack(version: string, payloadVersion: string): string {
	work = mkdtempSync(join(tmpdir(), "camunda-docspack-"))
	const root = join(work, "pack")
	mkdirSync(join(root, ".llms"), { recursive: true })
	mkdirSync(join(root, "scripts"), { recursive: true })
	cpSync(SCRIPT, join(root, "scripts", "sync-version.mjs"))
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ name: "@bpmnkit/camunda-docspack", version }),
	)
	writeFileSync(
		join(root, ".llms", "manifest.json"),
		JSON.stringify({
			$schema: "https://docspack.dev/schema/v1.json",
			name: "@bpmnkit/camunda-docspack",
			version: payloadVersion,
			documents: ["camunda@8.10"],
			chunks: [{ id: "a", file: "chunks/a.md", tokens: 12 }],
		}),
	)
	writeFileSync(
		join(root, "llms.txt"),
		[
			"# @bpmnkit/camunda-docspack",
			"",
			"> Camunda 8 documentation",
			"",
			`Version ${payloadVersion}. 1054 chunks documenting camunda@8.10.`,
			"",
			"## apis-tools",
			"",
			"- [Versioning](.llms/chunks/a.md) — 12 tokens",
			"",
		].join("\n"),
	)
	return root
}

function run(root: string): string {
	return execFileSync(process.execPath, [join(root, "scripts", "sync-version.mjs")], {
		encoding: "utf8",
	})
}

function versions(root: string): { manifest: string; toc: string | undefined } {
	return {
		manifest: JSON.parse(readFileSync(join(root, ".llms", "manifest.json"), "utf8")).version,
		toc: /^Version (.+?)\. /m.exec(readFileSync(join(root, "llms.txt"), "utf8"))?.[1],
	}
}

describe("sync-version", () => {
	it("brings a stale payload up to the package version", () => {
		const root = pack("0.1.0", "0.0.0")
		expect(run(root)).toContain("0.0.0 → 0.1.0")
		expect(versions(root)).toEqual({ manifest: "0.1.0", toc: "0.1.0" })
	})

	it("leaves an already-matching payload alone", () => {
		const root = pack("0.1.0", "0.1.0")
		const before = readFileSync(join(root, "llms.txt"), "utf8")
		expect(run(root)).toContain("already 0.1.0")
		expect(versions(root)).toEqual({ manifest: "0.1.0", toc: "0.1.0" })
		expect(readFileSync(join(root, "llms.txt"), "utf8")).toBe(before)
	})

	it("touches only the version, not the chunks it documents", () => {
		const root = pack("2.0.0", "0.0.0")
		run(root)
		const manifest = JSON.parse(readFileSync(join(root, ".llms", "manifest.json"), "utf8"))
		expect(manifest.chunks).toEqual([{ id: "a", file: "chunks/a.md", tokens: 12 }])
		expect(manifest.documents).toEqual(["camunda@8.10"])
		// The `Version` line is the header's, not the "Versioning" chunk's entry.
		expect(readFileSync(join(root, "llms.txt"), "utf8")).toContain("- [Versioning]")
	})

	it("keeps the published pack's own payload in step with its package.json", () => {
		const pkg = JSON.parse(readFileSync(join(PACK, "package.json"), "utf8"))
		const manifest = JSON.parse(readFileSync(join(PACK, ".llms", "manifest.json"), "utf8"))
		expect(manifest.version).toBe(pkg.version)
	})
})

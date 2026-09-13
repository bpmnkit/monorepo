import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { ECOSYSTEM } from "../src/data/content.js"
import { PACKAGE_FACTS } from "../src/generated/ecosystem.js"

/**
 * `src/generated/ecosystem.ts` is generated on every `dev` and `build`, so a stale
 * copy can only reach the repository through a commit — which is exactly what
 * these assertions are for. The homepage once advertised @bpmnkit/core v0.1.1
 * against a published v0.4.0 because the version was typed by hand in two
 * places; nothing here lets that happen quietly again.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..")

interface Manifest {
	name?: string
	version?: string
	private?: boolean
}

function manifest(dir: string): Manifest {
	return JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8")) as Manifest
}

const published = (
	(await import("../../../scripts/published-packages.mjs")) as { PUBLISHED: string[] }
).PUBLISHED

describe("generated package facts", () => {
	it("covers every package the repo publishes", () => {
		expect([...PACKAGE_FACTS].map((f) => f.dir).sort()).toEqual([...published].sort())
	})

	it("quotes the version each manifest actually carries", () => {
		for (const fact of PACKAGE_FACTS) {
			const pkg = manifest(fact.dir)
			expect(`${fact.dir} ${fact.version}`).toBe(`${fact.dir} ${pkg.version}`)
			expect(fact.name).toBe(pkg.name)
		}
	})

	it("points every package at its own npm page", () => {
		for (const fact of PACKAGE_FACTS) {
			expect(fact.npm).toBe(`https://www.npmjs.com/package/${fact.name}`)
		}
	})
})

describe("the homepage package list", () => {
	it("shows every published package", () => {
		expect(ECOSYSTEM).toHaveLength(PACKAGE_FACTS.length)
	})

	it("leads with the six a newcomer starts from", () => {
		const featured = ECOSYSTEM.filter((pkg) => pkg.featured).map((pkg) => pkg.name)
		expect(featured).toEqual([
			"@bpmnkit/core",
			"@bpmnkit/engine",
			"@bpmnkit/api",
			"@bpmnkit/canvas",
			"@bpmnkit/editor",
			"@bpmnkit/cli",
		])
		// The featured ones come first, so the disclosure only ever hides a tail.
		expect(ECOSYSTEM.slice(0, featured.length).every((pkg) => pkg.featured)).toBe(true)
	})

	it("never renders a row with no version or no description", () => {
		for (const pkg of ECOSYSTEM) {
			expect(pkg.version, pkg.name).not.toBe("")
			expect(pkg.role.length, pkg.name).toBeGreaterThan(0)
		}
	})
})

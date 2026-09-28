import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { ECOSYSTEM, productForDoc } from "../src/data/content.js"
import { APP_FACTS, PACKAGE_FACTS, TIERS } from "../src/generated/ecosystem.js"

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

describe("product tiers", () => {
	const stability = readFileSync(
		join(ROOT, "apps/landing/src/content/docs/getting-started/stability.md"),
		"utf8",
	)
	const products = [...PACKAGE_FACTS, ...APP_FACTS]

	/** The bullet in "Product tiers" that lists one tier's members. */
	function listed(label: string): string {
		const start = stability.indexOf(`- **${label}:**`)
		expect(start, `no "- **${label}:**" bullet on the stability page`).toBeGreaterThan(-1)
		const next = stability.indexOf("\n- ", start + 1)
		const endOfList = stability.indexOf("\n\n", start)
		return stability.slice(start, next === -1 || next > endOfList ? endOfList : next)
	}

	it("gives every product a tier the site can print", () => {
		for (const product of products) expect(TIERS[product.tier], product.name).toBeDefined()
	})

	it("lists each product under its own tier on the stability page, and nowhere else", () => {
		for (const product of products) {
			for (const [tier, { label }] of Object.entries(TIERS)) {
				const line = listed(label)
				const named = product.name.startsWith("@")
					? line.includes(`\`${product.name}\``)
					: line.includes(product.name)
				expect(named, `${product.name} under ${label}`).toBe(tier === product.tier)
			}
		}
	})

	it("labels the docs page of each product that has one", () => {
		expect(productForDoc("packages/operate")?.tier).toBe("experimental")
		expect(productForDoc("packages/core")?.tier).toBe("core")
		expect(productForDoc("cli/casen")?.name).toBe("@bpmnkit/cli")
		expect(productForDoc("guides/drop")?.tier).toBe("tools")
		expect(productForDoc("guides/gateways")).toBeUndefined()
	})
})

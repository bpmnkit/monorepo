import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Every panel in this package is editor chrome, and chrome carries the
 * bpmnkit.com design system: flat (no shadow, gradient or blur), square, and
 * bounded by 1px hairlines, with one accent and two type roles.
 *
 * These assertions read the sources rather than a rendered panel because most
 * of these panels need live data to appear at all. They are deliberately
 * coarse: they catch the reintroduction of the things the system forbids, not
 * every styling judgement.
 */

// vitest runs from the package root.
const SRC = join(process.cwd(), "src")

/** The renderers, which own their own output the way bpmn-js owns the diagram. */
const RENDERERS = ["form-editor", "form-viewer", "dmn-viewer"]

function sources(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name)
		if (statSync(full).isDirectory()) {
			if (!RENDERERS.includes(name)) sources(full, out)
		} else if (name.endsWith(".ts")) {
			out.push(full)
		}
	}
	return out
}

/** CSS template literals in a module, with their line offset for reporting. */
function stylesheets(file: string): string[] {
	const src = readFileSync(file, "utf8")
	return [...src.matchAll(/`\n([^`]*)`/g)]
		.map((m) => m[1] as string)
		.filter((css) => /^[.#@[][^{}\n]*\{/m.test(css))
}

const FILES = sources(SRC)

describe("plugin chrome — flat and square", () => {
	it("scans a meaningful number of stylesheets", () => {
		const withCss = FILES.filter((f) => stylesheets(f).length > 0)
		expect(withCss.length).toBeGreaterThan(15)
	})

	it("has no box-shadow", () => {
		for (const f of FILES) {
			for (const css of stylesheets(f)) {
				expect(css, `${f} uses box-shadow`).not.toMatch(/box-shadow:/)
			}
		}
	})

	it("has no backdrop-filter", () => {
		for (const f of FILES) {
			for (const css of stylesheets(f)) {
				expect(css, `${f} uses backdrop-filter`).not.toMatch(/backdrop-filter:/)
			}
		}
	})

	it("has no linear-gradient", () => {
		for (const f of FILES) {
			for (const css of stylesheets(f)) {
				expect(css, `${f} uses linear-gradient`).not.toMatch(/linear-gradient\(/)
			}
		}
	})

	it("is square except for circular marks", () => {
		// `50%` and `999px` draw a dot or a ring — a mark, not chrome.
		for (const f of FILES) {
			for (const css of stylesheets(f)) {
				const radii = [...css.matchAll(/border-radius:\s*([^;}]+)/g)].map((m) =>
					(m[1] as string).trim(),
				)
				const square = radii.filter((v) => !/^(50%|999px|9999px)$/.test(v))
				expect(square, `${f} has non-circular radii: ${square.join(", ")}`).toEqual([])
			}
		}
	})
})

describe("plugin chrome — one accent, driven by the shared tokens", () => {
	it("declares no per-theme override blocks", () => {
		// The theme lives in the shared chrome tokens, so a panel sheet is one set
		// of rules; a restated light or neon copy means it drifted back.
		for (const f of FILES) {
			for (const css of stylesheets(f)) {
				const blocks = css.match(/\[data-bpmnkit-hud-theme="[a-z]+"\]/g) ?? []
				expect(blocks, `${f} restates a theme`).toEqual([])
			}
		}
	})

	it("spends no raw hex — only var() fallbacks, which packages need standalone", () => {
		// The DMN decision table and the FEEL syntax classes are document rendering,
		// the way BPMN strokes belong to bpmn-js; CLAUDE.md exempts both palettes.
		const DOCUMENT_PALETTE = ["dmn-editor", "feel-playground", "token-highlight"]
		for (const f of FILES.filter((x) => !DOCUMENT_PALETTE.some((d) => x.includes(`/${d}/`)))) {
			for (const css of stylesheets(f)) {
				// A hex inside `var(--token, #hex)` is the required standalone fallback.
				const bare = css.replace(/var\(\s*--[a-z0-9-]+\s*,[^()]*\)/g, "var()")
				const hex = [...bare.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])
				expect(hex, `${f} hard-codes ${[...new Set(hex)].join(", ")}`).toEqual([])
			}
		}
	})

	it("takes its accent from the chrome tokens, not the product palette", () => {
		// --bpmnkit-accent is the blue product palette; chrome wears the design
		// system's one accent, which resolves per theme in chrome.ts.
		const DOCUMENT_PALETTE = ["dmn-editor", "feel-playground", "token-highlight"]
		for (const f of FILES.filter((x) => !DOCUMENT_PALETTE.some((d) => x.includes(`/${d}/`)))) {
			for (const css of stylesheets(f)) {
				const product = [...css.matchAll(/--bpmnkit-accent(?:-bright|-subtle|-fg)?\s*[,)]/g)].map(
					(m) => m[0],
				)
				expect(product, `${f} reads the product accent`).toEqual([])
			}
		}
	})

	it("puts every uppercase label in the mono role", () => {
		for (const f of FILES) {
			for (const css of stylesheets(f)) {
				for (const m of css.matchAll(/\{([^{}]*text-transform:\s*uppercase[^{}]*)\}/g)) {
					expect(m[1], `${f} has an uppercase label that is not mono`).toMatch(
						/--bpmnkit-chrome-mono|--bpmnkit-ds-font-mono/,
					)
				}
			}
		}
	})
})

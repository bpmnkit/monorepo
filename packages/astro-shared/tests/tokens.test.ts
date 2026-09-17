import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/** Reads a stylesheet with its comments stripped, so the assertions below
 *  test the declarations rather than the prose explaining them. */
function rules(file: string): string {
	return readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8").replace(
		/\/\*[\s\S]*?\*\//g,
		"",
	)
}

const tokens = rules("tokens.css")
const background = rules("background.css")

/**
 * These files are what a sibling Astro site inherits from bpmnkit.com. They
 * used to carry the 2025 aurora — drifting blurred orbs, a dot grid, a grain
 * layer, a 14px radius and a third brand colour — while the landing site had
 * already moved to the design system, so a visitor crossed a hard boundary
 * clicking through. The assertions below are the four things that made it one
 * system again and that a stray edit could quietly undo.
 */
describe("the shared Astro token layer", () => {
	it("derives from the design-system set, not the product palette", () => {
		expect(tokens).toContain("--accent: var(--bpmnkit-ds-accent)")
		expect(tokens).toContain("--ground: var(--bpmnkit-ds-bg)")
		expect(tokens).toContain("--font-sans: var(--bpmnkit-ds-font-sans)")
		// A short name resolving to `--bpmnkit-accent` and friends is the
		// product palette leaking back in.
		expect(tokens).not.toMatch(/var\(--bpmnkit-(?!ds-)(bg|surface|accent|fg|border|font)\b/)
	})

	it("is square, and spends one accent", () => {
		expect(tokens).toContain("--radius: 0")
		// `--pink` was the third brand colour the aurora needed; the system has
		// no second, let alone a third.
		expect(tokens).not.toContain("--pink")
	})

	it("draws a flat ground", () => {
		for (const banned of ["blur(", "radial-gradient", "linear-gradient", "@keyframes"]) {
			expect(background, `background.css still contains ${banned}`).not.toContain(banned)
		}
	})

	it("no longer defines the aurora's elements", () => {
		// A layout that still renders them should render nothing, rather than
		// keep the old brand alive in one corner of the site.
		for (const cls of [".aurora", ".orb", ".dots", ".grain"]) {
			expect(background, `background.css still defines ${cls}`).not.toContain(`${cls} {`)
		}
	})
})

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("../src/styles/design-system.css", import.meta.url), "utf8")
const store = readFileSync(new URL("../src/stores/theme.ts", import.meta.url), "utf8")
const globals = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8")

/**
 * The studio wears the bpmnkit.com design system. These assertions guard the
 * two things that make that true and that a stray edit could quietly undo.
 */
describe("design-system wiring", () => {
	it("defaults to the design system's own theme, not the white-label one", () => {
		// `neon` stays available in the switcher; it just is not what a new
		// visitor sees.
		expect(store).toContain('theme: "light",')
		expect(store).not.toMatch(/\?\s*persisted\s*:\s*"neon"/)
	})

	it("scopes the light bridge so it cannot leak into dark or neon", () => {
		// This file is imported after @bpmnkit/ui's tokens, so a bare `:root`
		// would outrank their [data-theme] blocks on source order.
		expect(css).toContain(':root:not([data-theme="dark"]):not([data-theme="neon"])')
		expect(css).not.toMatch(/^:root \{/m)
	})

	it("collapses the radius and shadow scales rather than editing call sites", () => {
		for (const token of ["--radius-lg: 0", "--shadow-lg: none"]) {
			expect(globals, `globals.css does not set ${token}`).toContain(token)
		}
		const cascivo = readFileSync(new URL("../src/styles/cascivo.css", import.meta.url), "utf8")
		expect(cascivo).toContain("--cascivo-radius-control: 0")
		expect(cascivo).toContain("--cascivo-shadow-md: none")
		// Circular marks — status dots, avatars — are not chrome and keep their shape.
		expect(cascivo).not.toContain("--cascivo-radius-full: 0")
	})

	it("takes its colour and type from the --bpmnkit-ds-* set", () => {
		expect(css).toContain("--bpmnkit-accent: var(--bpmnkit-ds-accent)")
		expect(css).toContain("--bpmnkit-font: var(--bpmnkit-ds-font-sans)")
		expect(css).toContain("--bpmnkit-font-mono: var(--bpmnkit-ds-font-mono)")
	})

	it("redeclares the design-system set for dark and neon", () => {
		// A `.ds-*` rule reads `--bpmnkit-ds-*` directly, so aliasing the brand
		// tokens is not enough: without this, dark renders the light ink.
		for (const theme of ['[data-theme="dark"]', '[data-theme="neon"]']) {
			const block = css.slice(css.indexOf(theme))
			expect(block, `${theme} does not redeclare --bpmnkit-ds-ink-3`).toContain(
				"--bpmnkit-ds-ink-3:",
			)
			expect(block, `${theme} does not redeclare --bpmnkit-ds-line`).toContain("--bpmnkit-ds-line:")
		}
	})
})

/**
 * The component vocabulary the pages compose with. These guard the two shapes
 * that carry the system's form, and the layer that keeps them overridable.
 */
describe("the .ds-* component layer", () => {
	it("lives in Tailwind's components layer, so a utility still wins", () => {
		expect(css).toMatch(/@layer components \{/)
	})

	it("draws a grid as one bordered box subdivided by hairlines", () => {
		const grid = css.slice(css.indexOf(".ds-grid {"), css.indexOf(".ds-cell {"))
		expect(grid).toContain("gap: 1px")
		expect(grid).toContain("background: var(--bpmnkit-ds-line-soft)")
		expect(grid).toContain("border: 1px solid var(--bpmnkit-ds-line)")
	})

	it("keeps the chrome square and flat", () => {
		const layer = css.slice(css.indexOf("@layer components {"))
		expect(layer).not.toMatch(/border-radius:(?! 0)/)
		expect(layer).not.toMatch(/box-shadow|linear-gradient|backdrop-filter/)
	})
})

// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { TABS_CSS } from "../../src/tabs/css.js"

/**
 * The editor's start page and its tab bar carry the bpmnkit.com design system.
 * These lock the parts of it that a later visual tweak could silently undo.
 */
describe("start page design-system invariants", () => {
	it("is flat and square — no radius, shadow, gradient or blur", () => {
		for (const banned of ["border-radius", "box-shadow", "linear-gradient", "backdrop-filter"]) {
			expect(TABS_CSS, `TABS_CSS still uses ${banned}`).not.toContain(banned)
		}
	})

	it("spends one accent — no second brand hue in the file-type marks", () => {
		// The badges and tab chips used to carry a blue/purple/amber/green
		// taxonomy; the system has only the accent to give them.
		expect(TABS_CSS).not.toContain("--tab-type-bpmn")
		expect(TABS_CSS).not.toContain("--tab-type-dmn")
		expect(TABS_CSS).not.toContain("bpmnkit-welcome-example-badge.bpmn")
		expect(TABS_CSS).toMatch(
			/\.bpmnkit-welcome-example-badge\s*\{[^}]*color:\s*var\(--welcome-accent\)/,
		)
	})

	it("puts every label and datum in the mono role", () => {
		for (const sel of [
			"bpmnkit-welcome-examples-label",
			"bpmnkit-welcome-example-badge",
			"bpmnkit-welcome-example-desc",
			"bpmnkit-tab-type",
		]) {
			const rule = new RegExp(`\\.${sel}\\s*\\{[^}]*--bpmnkit-ds-font-mono`)
			expect(TABS_CSS, `.${sel} is not in the mono role`).toMatch(rule)
		}
	})

	it("groups the examples in one bordered box, not gapped cards", () => {
		const list = /\.bpmnkit-welcome-examples\s*\{([^}]*)\}/.exec(TABS_CSS)?.[1] ?? ""
		expect(list).toContain("border: 1px solid var(--welcome-line)")
		expect(list).not.toContain("gap:")
		const item = /\.bpmnkit-welcome-example\s*\{([^}]*)\}/.exec(TABS_CSS)?.[1] ?? ""
		expect(item).toContain("border-bottom: 1px solid var(--welcome-line-soft)")
	})

	it("sits the active tab's underline on the tab row's own rule", () => {
		const rule = /\.bpmnkit-tab\.active\s*\{([^}]*)\}/.exec(TABS_CSS)?.[1] ?? ""
		expect(rule).toContain("border-bottom: 2px solid var(--tab-active-border)")
		expect(rule).toContain("margin-bottom: -1px")
	})

	it("defines every theme's variables so none falls back to another's ink", () => {
		for (const theme of ["light", "dark", "neon"]) {
			const block = new RegExp(`\\.bpmnkit-welcome\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`)
			const vars = block.exec(TABS_CSS)?.[1] ?? ""
			for (const v of ["--welcome-bg", "--welcome-title", "--welcome-accent", "--welcome-line"]) {
				expect(vars, `${theme} does not define ${v}`).toContain(v)
			}
		}
	})
})

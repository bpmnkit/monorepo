import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { UI_TOKENS_CSS } from "../src/css.js"

/** `tokens.css` is published as `@bpmnkit/ui/tokens.css`; `UI_TOKENS_CSS` is what `injectUiTokens()` injects. */
const TOKENS_CSS = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "../src/tokens.css"),
	"utf8",
)

interface Rule {
	selector: string
	declarations: Array<[property: string, value: string]>
}

/**
 * Parses the flat stylesheets both sources hold into rules, ignoring comments,
 * whitespace and quote style — the only ways the two are allowed to differ.
 */
function parse(css: string): Rule[] {
	const rules: Rule[] = []
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
	for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const [, selector = "", body = ""] = match
		const declarations = body
			.split(";")
			.map((d) => d.trim())
			.filter(Boolean)
			.map((d): [string, string] => {
				const colon = d.indexOf(":")
				const value = d
					.slice(colon + 1)
					.trim()
					.replace(/'/g, '"')
					.replace(/\s+/g, " ")
				return [d.slice(0, colon).trim(), value]
			})
		rules.push({ selector: selector.trim().replace(/\s+/g, " "), declarations })
	}
	return rules
}

function tokenMap(css: string, selector: string): Map<string, string> {
	const map = new Map<string, string>()
	for (const rule of parse(css)) {
		if (rule.selector !== selector) continue
		for (const [prop, value] of rule.declarations) map.set(prop, value)
	}
	return map
}

describe("tokens.css and UI_TOKENS_CSS", () => {
	it("declare the same rules, in the same order, with the same values", () => {
		expect(parse(UI_TOKENS_CSS)).toEqual(parse(TOKENS_CSS))
	})

	it("actually hold rules, so the comparison above is not vacuous", () => {
		const rules = parse(TOKENS_CSS)
		expect(rules.map((r) => r.selector)).toEqual([
			":root",
			'[data-theme="dark"]',
			'[data-theme="neon"]',
			":root",
		])
		expect(rules.reduce((n, r) => n + r.declarations.length, 0)).toBeGreaterThan(100)
	})

	it("parses a drift between them as a difference", () => {
		const drifted = UI_TOKENS_CSS.replace("--bpmnkit-accent: #1a56db", "--bpmnkit-accent: #000000")
		expect(drifted).not.toBe(UI_TOKENS_CSS)
		expect(parse(drifted)).not.toEqual(parse(TOKENS_CSS))
	})

	it("uses only the --bpmnkit- namespace", () => {
		for (const rule of parse(TOKENS_CSS)) {
			for (const [prop] of rule.declarations) expect(prop).toMatch(/^--bpmnkit-/)
		}
	})

	it("keeps the documented product palette values", () => {
		const light = tokenMap(TOKENS_CSS, ":root")
		const dark = tokenMap(TOKENS_CSS, '[data-theme="dark"]')
		const documented: Array<[token: string, light: string, dark: string]> = [
			["--bpmnkit-bg", "#f4f4f8", "#0d0d16"],
			["--bpmnkit-surface", "#ffffff", "#161626"],
			["--bpmnkit-surface-2", "#eeeef8", "#1e1e2e"],
			["--bpmnkit-border", "#d0d0e8", "#2a2a42"],
			["--bpmnkit-fg", "#1a1a2e", "#cdd6f4"],
			["--bpmnkit-fg-muted", "#6666a0", "#8888a8"],
			["--bpmnkit-accent", "#1a56db", "#6b9df7"],
			["--bpmnkit-accent-bright", "#3b82f6", "#89b4fa"],
			["--bpmnkit-accent-subtle", "rgba(26, 86, 219, 0.12)", "rgba(107, 157, 247, 0.15)"],
			["--bpmnkit-teal", "#0d9488", "#2dd4bf"],
			["--bpmnkit-panel-bg", "rgba(255, 255, 255, 0.92)", "rgba(13, 13, 22, 0.92)"],
			["--bpmnkit-panel-border", "rgba(0, 0, 0, 0.08)", "rgba(255, 255, 255, 0.08)"],
			["--bpmnkit-success", "#16a34a", "#22c55e"],
			["--bpmnkit-warn", "#d97706", "#f59e0b"],
			["--bpmnkit-danger", "#dc2626", "#f87171"],
		]
		for (const [token, l, d] of documented) {
			expect(light.get(token), token).toBe(l)
			expect(dark.get(token), token).toBe(d)
		}
	})

	it("defines the design-system set, with its one accent", () => {
		const root = tokenMap(TOKENS_CSS, ":root")
		expect(root.get("--bpmnkit-ds-accent")).toBe("#a8503a")
		expect(root.get("--bpmnkit-ds-accent-on-dark")).toBe("#c9755c")
		expect(root.get("--bpmnkit-ds-font-sans")).toMatch(/^"Space Grotesk"/)
		expect(root.get("--bpmnkit-ds-font-mono")).toMatch(/^"Space Mono"/)
	})
})

import type { DiagramTheme } from "./render.js"
import { escapeHtml } from "./util.js"

/**
 * `exportSvg()` draws its light theme with fixed colours. Each one is swapped for a
 * custom property set on the root `<svg>`, so one SVG can follow the page's tokens
 * or the reader's colour scheme.
 *
 * Keys are the exact strings `exportSvg()` emits for its light theme.
 */
const PALETTE: ReadonlyArray<readonly [string, string]> = [
	["#f8f9fa", "var(--bkmd-bg)"],
	["#ffffff", "var(--bkmd-fill)"],
	["#404040", "var(--bkmd-stroke)"],
	["#333333", "var(--bkmd-text)"],
	["rgba(0,0,0,0.04)", "var(--bkmd-pool)"],
	["system-ui,-apple-system,sans-serif", "var(--bkmd-font)"],
]

/** Light and dark values of the `--bpmnkit-*` product tokens the diagram reads. */
const TOKENS = {
	bg: ["--bpmnkit-bg", "#f4f4f8", "#0d0d16"],
	fill: ["--bpmnkit-surface", "#ffffff", "#161626"],
	stroke: ["--bpmnkit-fg", "#1a1a2e", "#cdd6f4"],
	text: ["--bpmnkit-fg", "#1a1a2e", "#cdd6f4"],
} as const

/** Pool/lane header shading — a tint of whatever lies under it, not a brand colour. */
const POOL = ["rgba(0,0,0,0.04)", "rgba(255,255,255,0.06)"] as const
const FONT = "var(--bpmnkit-font, system-ui, -apple-system, sans-serif)"

/**
 * The root's custom properties.
 *
 * `auto` uses `light-dark()` under `color-scheme: light dark` rather than a
 * `@media (prefers-color-scheme)` rule: the result is the same, but it fits in a
 * `style` attribute. A `<style>` element would leak into the whole page when the SVG
 * is inlined, and is dropped outright by Vue templates (VitePress).
 */
function rootVars(theme: DiagramTheme): string {
	const vars: string[] = []
	for (const [name, [token, light, dark]] of Object.entries(TOKENS)) {
		const value =
			theme === "auto"
				? `var(${token}, light-dark(${light}, ${dark}))`
				: theme === "dark"
					? dark
					: light
		vars.push(`--bkmd-${name}:${value}`)
	}
	const pool =
		theme === "auto" ? `light-dark(${POOL[0]}, ${POOL[1]})` : POOL[theme === "dark" ? 1 : 0]
	vars.push(`--bkmd-pool:${pool}`, `--bkmd-font:${FONT}`)
	vars.push(`color-scheme:${theme === "auto" ? "light dark" : theme}`)
	return vars.join(";")
}

export interface ThemeSvgOptions {
	id: string
	title: string
	description: string
	theme: DiagramTheme
	maxWidth: number | undefined
}

/** Rewrites a light-theme `exportSvg()` document into a themed, accessible, self-scoped one. */
export function themeSvg(raw: string, options: ThemeSvgOptions): string {
	const { id } = options

	// Icon groups carry a `<style>` of class rules. Inline them: the rules are the same
	// for every group, and a `<style>` in inline SVG applies to the whole page.
	const classRules = new Map<string, string>()
	let svg = raw.replace(/<style>([^<]*)<\/style>/g, (_, rules: string) => {
		for (const m of rules.matchAll(/\.([\w-]+)\{([^}]*)\}/g)) {
			if (m[1] && m[2] !== undefined) classRules.set(m[1], m[2])
		}
		return ""
	})

	svg = svg.replace(/<([a-zA-Z][\w:-]*)(\s[^>]*?)?(\/?)>/g, (_, tag: string, attrs, end) => {
		let rest: string = attrs ?? ""
		const decls: string[] = []
		// Presentation attributes lose to CSS, so the class rule is appended last to
		// keep winning over `fill`/`stroke` attributes on the same element.
		rest = rest.replace(/\s(fill|stroke)="(#[0-9a-f]{6}|rgba\([^"]*\))"/g, (m, prop, value) => {
			if (!PALETTE.some(([color]) => color === value)) return m
			decls.push(`${prop}:${value}`)
			return ""
		})
		let existing = ""
		rest = rest.replace(/\sstyle="([^"]*)"/, (_m, style: string) => {
			existing = style
			return ""
		})
		if (existing) decls.push(existing)
		rest = rest.replace(/\sclass="([^"]*)"/, (m, cls: string) => {
			const rule = classRules.get(cls)
			if (rule === undefined) return m
			decls.push(rule)
			return ""
		})
		const style = decls.length > 0 ? ` style="${recolor(decls.join(";"))}"` : ""
		return `<${tag}${rest}${style}${end}>`
	})

	svg = svg
		.replace(/id="arr"/g, `id="${id}-arrow"`)
		.replace(/url\(#arr\)/g, `url(#${id}-arrow)`)
		.replace(/>\n\s*</g, "><")

	svg = svg.replace(
		/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="([^"]*)" width="([^"]*)" height="([^"]*)">/,
		(_m, viewBox: string, w: string, h: string) => {
			const width = Number(w)
			const height = Number(h)
			const scale =
				options.maxWidth !== undefined && width > options.maxWidth ? options.maxWidth / width : 1
			const style = `${rootVars(options.theme)};max-width:100%;height:auto`
			return (
				`<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="${viewBox}" width="${round(width * scale)}" height="${round(height * scale)}" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-desc" style="${style}">` +
				`<title id="${id}-title">${escapeHtml(options.title)}</title>` +
				`<desc id="${id}-desc">${escapeHtml(options.description)}</desc>`
			)
		},
	)
	return svg
}

function recolor(style: string): string {
	let out = style
	for (const [color, variable] of PALETTE) out = out.split(color).join(variable)
	return out
}

function round(n: number): number {
	return Math.round(n * 100) / 100
}

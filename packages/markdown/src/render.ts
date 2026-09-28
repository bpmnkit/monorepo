import {
	Bpmn,
	type BpmnDefinitions,
	type CompactDiagram,
	applyAutoLayout,
	checkDiCompleteness,
	expand,
	exportSvg,
} from "@bpmnkit/core"
import { themeSvg } from "./theme.js"
import { escapeHtml } from "./util.js"

/** The fenced-code-block languages this package renders. */
export const BPMN_LANGS = ["bpmn", "bpmn-compact", "bpmn-json"] as const

/**
 * `bpmn` holds BPMN 2.0 XML; `bpmn-compact` and its alias `bpmn-json` hold the
 * compact JSON format from `compactify()` in `@bpmnkit/core`.
 */
export type BpmnLang = (typeof BPMN_LANGS)[number]

export function isBpmnLang(lang: string | null | undefined): lang is BpmnLang {
	return (BPMN_LANGS as readonly string[]).includes(lang ?? "")
}

/**
 * - `auto` follows the page's `--bpmnkit-*` tokens when it defines them, and the
 *   reader's `prefers-color-scheme` when it does not.
 * - `light` / `dark` pin the palette and ignore the page.
 */
export type DiagramTheme = "auto" | "light" | "dark"

export interface RenderOptions {
	/** Default: `"auto"`. */
	theme?: DiagramTheme
	/** Largest width in CSS pixels the diagram is drawn at. It still shrinks to fit its container. */
	maxWidth?: number
	/**
	 * Accessible name of the diagram (`<title>`, and the image alt text in pre-rendered
	 * Markdown). Default: the first process's name, else the first pool's, else its id.
	 */
	title?: string
	/**
	 * Adds an "Open in BPMN Kit" link under the diagram when given. Receives the
	 * diagram as BPMN XML (with the layout it was drawn with) and returns the href.
	 * Off by default.
	 */
	link?: (diagram: { xml: string; title: string }) => string
	/**
	 * What an unparsable block does. `"render"` (default) draws a readable error box in
	 * its place and lets the build go on; `"throw"` fails the build.
	 */
	onError?: "render" | "throw"
}

export type RenderResult =
	| {
			ok: true
			/** The standalone SVG document — valid as an `.svg` file and as inline markup. */
			svg: string
			/** The SVG wrapped in a `<figure>`, with the editor link when `link` is set. */
			html: string
			title: string
	  }
	| {
			ok: false
			error: string
			/** A readable error box to put where the diagram would have been. */
			html: string
	  }

/**
 * Renders one fenced code block to an SVG diagram.
 *
 * Every adapter in this package — remark, markdown-it, the HTML rewriter and the
 * `bpmnkit-md` pre-renderer — is a thin wrapper over this function, so a block
 * renders the same everywhere. The output depends only on `code`, `lang` and
 * `options`: the same input always yields the same bytes.
 */
export function renderBpmnBlock(
	code: string,
	lang: BpmnLang,
	options: RenderOptions = {},
): RenderResult {
	let defs: BpmnDefinitions
	try {
		defs = parseBlock(code, lang)
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err)
		if (options.onError === "throw") {
			throw new Error(`Cannot render \`${lang}\` block: ${error}`, { cause: err })
		}
		return { ok: false, error, html: errorHtml(lang, error) }
	}

	const title = options.title?.trim() || defaultTitle(defs)
	const id = `bpmn-${hash(`${lang}\0${code}\0${title}`)}`
	const svg = themeSvg(exportSvg(defs), {
		id,
		title,
		description: describe(defs),
		theme: options.theme ?? "auto",
		maxWidth: options.maxWidth,
	})

	let html = `<figure class="bpmnkit-diagram" style="margin:1.5em 0">${svg}`
	if (options.link) {
		const href = options.link({ xml: Bpmn.export(defs), title })
		html += `<figcaption style="font-size:0.875em;margin-top:0.5em"><a href="${escapeHtml(href)}">Open in BPMN Kit</a></figcaption>`
	}
	html += "</figure>"
	return { ok: true, svg, html, title }
}

function parseBlock(code: string, lang: BpmnLang): BpmnDefinitions {
	if (code.trim() === "") throw new Error("the block is empty")

	if (lang === "bpmn") {
		const defs = Bpmn.parse(code)
		if (defs.processes.length === 0 && defs.collaborations.length === 0) {
			throw new Error("the XML has no <process> or <collaboration> to draw")
		}
		const di = checkDiCompleteness(defs)
		const hasDi = defs.diagrams.some((d) => d.plane.shapes.length > 0)
		// A diagram with no DI, or with gaps in it, is laid out from scratch: drawing
		// the positioned half and dropping the rest would misrepresent the process.
		if (!hasDi || di.missingShapes.length > 0 || di.missingEdges.length > 0) {
			return applyAutoLayout(defs)
		}
		return defs
	}

	let json: unknown
	try {
		json = JSON.parse(code)
	} catch (err) {
		throw new Error(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
	}
	return expand(toCompactDiagram(json))
}

/**
 * Accepts a full `CompactDiagram` or, for hand-written blocks, a single process
 * (`{ id, elements, flows }`) without the `{ processes: [...] }` wrapper.
 */
function toCompactDiagram(json: unknown): CompactDiagram {
	if (json !== null && typeof json === "object" && !("processes" in json) && "elements" in json) {
		const process = json as { id?: unknown }
		const id = typeof process.id === "string" ? process.id : "Process_1"
		return { id: `Definitions_${id}`, processes: [json as CompactDiagram["processes"][number]] }
	}
	return json as CompactDiagram
}

function defaultTitle(defs: BpmnDefinitions): string {
	const process = defs.processes[0]
	const participant = defs.collaborations[0]?.participants[0]
	return process?.name || participant?.name || process?.id || participant?.id || "BPMN diagram"
}

/** A one-line text alternative: the named steps of the first process, in document order. */
function describe(defs: BpmnDefinitions): string {
	const names = (defs.processes[0]?.flowElements ?? [])
		.map((el) => el.name?.trim())
		.filter((name): name is string => Boolean(name))
	return names.length > 0
		? `BPMN process diagram. Steps: ${names.join(", ")}.`
		: "BPMN process diagram."
}

function errorHtml(lang: BpmnLang, error: string): string {
	return [
		`<div class="bpmnkit-diagram-error" style="margin:1.5em 0;padding:12px 16px;border:1px solid var(--bpmnkit-danger, #dc2626);color:var(--bpmnkit-fg, #1a1a2e);background:var(--bpmnkit-surface, #ffffff)">`,
		`<strong style="color:var(--bpmnkit-danger, #dc2626)">BPMN diagram could not be rendered (${lang})</strong>`,
		`<pre style="margin:8px 0 0;white-space:pre-wrap;font-family:var(--bpmnkit-font-mono, ui-monospace, monospace)">${escapeHtml(error)}</pre>`,
		"</div>",
	].join("")
}

/** FNV-1a, 32-bit, base 36 — a short stable id, not a security property. */
function hash(s: string): string {
	let h = 0x811c9dc5
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 0x01000193)
	}
	return (h >>> 0).toString(36)
}

/**
 * Splits a fence info string (` ```bpmn-compact title="Order flow" `) into its
 * language and `key=value` attributes. Values may be bare or double-quoted.
 */
export function parseFenceInfo(info: string): { lang: string; attrs: Record<string, string> } {
	const trimmed = info.trim()
	const lang = trimmed.split(/\s+/, 1)[0] ?? ""
	return { lang, attrs: parseFenceMeta(trimmed.slice(lang.length)) }
}

export function parseFenceMeta(meta: string | null | undefined): Record<string, string> {
	const attrs: Record<string, string> = {}
	for (const m of (meta ?? "").matchAll(/([\w-]+)=(?:"([^"]*)"|(\S+))/g)) {
		const key = m[1]
		if (key) attrs[key] = m[2] ?? m[3] ?? ""
	}
	return attrs
}

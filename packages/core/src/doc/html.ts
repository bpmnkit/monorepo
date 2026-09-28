import type { BpmnDefinitions } from "../bpmn/bpmn-model.js"
import {
	type DocumentationOptions,
	type DocumentedElement,
	type DocumentedProcess,
	type DocumentedProperty,
	type ProcessDocumentation,
	buildProcessDocumentation,
} from "./model.js"

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

/** Anchor ids are built from model ids, which a hostile file can fill with anything. */
function anchor(kind: string, id: string): string {
	return `${kind}-${id.replace(/[^A-Za-z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)}`
}

function processAnchor(p: DocumentedProcess): string {
	return anchor("process", p.id)
}

// Print-first: the document is read on paper or as a PDF as often as on screen.
// Colours follow the bpmnkit design-system tokens, with fallbacks so the file
// stands alone — nothing is loaded from the network.
const CSS = `
:root {
  --doc-ink: var(--bpmnkit-ds-ink, #14161a);
  --doc-ink-2: var(--bpmnkit-ds-ink-3, #4a5058);
  --doc-line: var(--bpmnkit-ds-line, #d9dbdf);
  --doc-line-soft: var(--bpmnkit-ds-line-soft, #eceef1);
  --doc-ground: var(--bpmnkit-ds-surface, #ffffff);
  --doc-accent: var(--bpmnkit-ds-accent, #a8503a);
  --doc-sans: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, "Segoe UI", sans-serif);
  --doc-mono: var(--bpmnkit-ds-font-mono, ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace);
}
* { box-sizing: border-box; }
html { background: var(--doc-ground); color: var(--doc-ink); }
body { margin: 0 auto; max-width: 980px; padding: 40px 32px 64px; font: 14px/1.55 var(--doc-sans); }
h1, h2, h3, h4 { line-height: 1.25; margin: 0; font-weight: 600; }
h1 { font-size: 30px; margin-bottom: 6px; }
h2 { font-size: 21px; padding-top: 30px; margin-bottom: 12px; border-bottom: 1px solid var(--doc-line); padding-bottom: 6px; }
h3 { font-size: 16px; margin: 22px 0 8px; }
h4 { font-size: 14px; }
p { margin: 0 0 10px; }
a { color: var(--doc-accent); }
code, .mono { font-family: var(--doc-mono); font-size: 12px; }
.eyebrow { font-family: var(--doc-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--doc-ink-2); }
.subtitle { color: var(--doc-ink-2); margin-bottom: 18px; }
.prose { white-space: pre-wrap; }
.print-hint { border: 1px solid var(--doc-line); padding: 8px 12px; margin: 0 0 24px; font-size: 12.5px; color: var(--doc-ink-2); }
nav.toc ol { margin: 0; padding-left: 20px; }
nav.toc li { margin: 2px 0; }
.diagram { border: 1px solid var(--doc-line); padding: 8px; margin: 8px 0 0; overflow: auto; }
.diagram svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 14px; font-size: 13px; }
th, td { border: 1px solid var(--doc-line); padding: 5px 8px; text-align: left; vertical-align: top; }
th { font-family: var(--doc-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; color: var(--doc-ink-2); background: var(--doc-line-soft); }
td.num, th.num { width: 1%; white-space: nowrap; font-family: var(--doc-mono); font-size: 12px; }
td ul { margin: 0; padding-left: 16px; }
.element { border: 1px solid var(--doc-line); margin: 0 0 -1px; padding: 12px 14px; }
.element header { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; margin-bottom: 6px; }
.element .num { font-family: var(--doc-mono); font-size: 12px; color: var(--doc-accent); }
.element .type { font-family: var(--doc-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--doc-ink-2); }
.element dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 16px; margin: 6px 0 0; }
.element dt { color: var(--doc-ink-2); }
.element dd { margin: 0; word-break: break-word; }
.element dd ul { margin: 0; padding-left: 16px; }
.depth-1 { margin-left: 18px; } .depth-2 { margin-left: 36px; } .depth-3 { margin-left: 54px; }
.muted { color: var(--doc-ink-2); }
@page { size: auto; margin: 16mm 14mm; }
@page diagram { size: landscape; margin: 12mm; }
@media print {
  html, body { background: #fff; }
  body { max-width: none; padding: 0; font-size: 10.5pt; }
  .print-hint { display: none; }
  a { color: inherit; text-decoration: none; }
  h2 { break-after: avoid; }
  h3, h4 { break-after: avoid; }
  section.process, section.decisions, section.forms, section.messages { break-before: page; }
  section.diagram-page { page: diagram; break-before: page; }
  .diagram { border: 0; padding: 0; overflow: visible; }
  .diagram svg { max-height: 170mm; width: 100%; }
  .element, tr, .diagram { break-inside: avoid; }
  thead { display: table-header-group; }
}
`

function valueHtml(p: DocumentedProperty): string {
	const render = (v: string) =>
		v.startsWith("=") ? `<code>${escapeHtml(v)}</code>` : escapeHtml(v)
	if (Array.isArray(p.value)) {
		if (p.value.length === 1) return render(p.value[0] ?? "")
		return `<ul>${p.value.map((v) => `<li>${render(v)}</li>`).join("")}</ul>`
	}
	if (p.link) return `<a href="#${anchor(p.link.kind, p.link.id)}">${escapeHtml(p.value)}</a>`
	return render(p.value)
}

function elementHtml(el: DocumentedElement): string {
	const title = el.name ?? el.id
	const lines = [
		`<article class="element depth-${Math.min(el.depth, 3)}" id="${anchor("el", el.id)}">`,
		`<header><span class="num">${escapeHtml(el.number)}</span><h4>${escapeHtml(title)}</h4><span class="type">${escapeHtml(el.typeLabel)}</span></header>`,
	]
	if (el.documentation) lines.push(`<p class="prose">${escapeHtml(el.documentation)}</p>`)
	const rows: string[] = []
	if (el.lane) rows.push(`<dt>Lane</dt><dd>${escapeHtml(el.lane)}</dd>`)
	for (const p of el.properties)
		rows.push(`<dt>${escapeHtml(p.label)}</dt><dd>${valueHtml(p)}</dd>`)
	rows.push(`<dt>ID</dt><dd class="mono">${escapeHtml(el.id)}</dd>`)
	lines.push(`<dl>${rows.join("")}</dl>`, "</article>")
	return lines.join("\n")
}

function processHtml(p: DocumentedProcess): string {
	const out = [`<section class="process" id="${processAnchor(p)}">`]
	out.push(`<h2>${escapeHtml(p.title)}</h2>`)
	const meta = [`Process ID <code>${escapeHtml(p.id)}</code>`]
	if (p.participant) meta.push("drawn as a pool")
	meta.push(p.executable ? "executable" : "not executable")
	out.push(`<p class="muted">${meta.join(" · ")}</p>`)
	if (p.documentation) out.push(`<p class="prose">${escapeHtml(p.documentation)}</p>`)

	if (p.lanes.length > 0) {
		out.push(`<h3 id="${processAnchor(p)}-lanes">Lanes and performers</h3>`)
		out.push("<table><thead><tr><th>Lane</th><th>Responsible for</th></tr></thead><tbody>")
		for (const lane of p.lanes) {
			const name = [...lane.path, lane.name].map(escapeHtml).join(" / ")
			const doc = lane.documentation
				? `<div class="prose muted">${escapeHtml(lane.documentation)}</div>`
				: ""
			const els = lane.elements.length > 0 ? lane.elements.map(escapeHtml).join(", ") : "—"
			out.push(`<tr><td>${name}${doc}</td><td>${els}</td></tr>`)
		}
		out.push("</tbody></table>")
	}

	if (p.elements.length > 0) {
		out.push(`<h3 id="${processAnchor(p)}-summary">Steps at a glance</h3>`)
		const laneCol = p.lanes.length > 0
		out.push(
			`<table><thead><tr><th class="num">#</th><th>Name</th><th>Type</th>${laneCol ? "<th>Lane</th>" : ""}</tr></thead><tbody>`,
		)
		for (const el of p.elements) {
			const lane = laneCol ? `<td>${escapeHtml(el.lane ?? "")}</td>` : ""
			out.push(
				`<tr><td class="num">${escapeHtml(el.number)}</td><td><a href="#${anchor("el", el.id)}">${escapeHtml(el.name ?? el.id)}</a></td><td>${escapeHtml(el.typeLabel)}</td>${lane}</tr>`,
			)
		}
		out.push("</tbody></table>")
		out.push(`<h3 id="${processAnchor(p)}-steps">Step details</h3>`)
		for (const el of p.elements) out.push(elementHtml(el))
	} else {
		out.push(`<p class="muted">This process has no elements.</p>`)
	}
	out.push("</section>")
	return out.join("\n")
}

function tocHtml(doc: ProcessDocumentation): string {
	const items: string[] = []
	if (doc.diagramSvg) items.push(`<li><a href="#diagram">Diagram</a></li>`)
	for (const p of doc.processes) {
		const sub: string[] = []
		if (p.lanes.length > 0)
			sub.push(`<li><a href="#${processAnchor(p)}-lanes">Lanes and performers</a></li>`)
		if (p.elements.length > 0) {
			sub.push(`<li><a href="#${processAnchor(p)}-summary">Steps at a glance</a></li>`)
			sub.push(`<li><a href="#${processAnchor(p)}-steps">Step details</a></li>`)
		}
		items.push(
			`<li><a href="#${processAnchor(p)}">${escapeHtml(p.title)}</a>${sub.length > 0 ? `<ol>${sub.join("")}</ol>` : ""}</li>`,
		)
	}
	if (doc.messageFlows.length > 0) items.push(`<li><a href="#messages">Message flows</a></li>`)
	if (doc.decisions.length > 0) {
		const sub = doc.decisions
			.map((d) => `<li><a href="#${anchor("decision", d.id)}">${escapeHtml(d.name)}</a></li>`)
			.join("")
		items.push(`<li><a href="#decisions">Decisions</a><ol>${sub}</ol></li>`)
	}
	if (doc.forms.length > 0) {
		const sub = doc.forms
			.map((f) => `<li><a href="#${anchor("form", f.id)}">${escapeHtml(f.id)}</a></li>`)
			.join("")
		items.push(`<li><a href="#forms">Forms</a><ol>${sub}</ol></li>`)
	}
	return `<nav class="toc"><h2 id="contents">Contents</h2><ol>${items.join("")}</ol></nav>`
}

function messagesHtml(doc: ProcessDocumentation): string {
	if (doc.messageFlows.length === 0) return ""
	const rows = doc.messageFlows.map((m) => {
		const name = m.name ?? m.message ?? ""
		const doc = m.documentation
			? `<div class="prose muted">${escapeHtml(m.documentation)}</div>`
			: ""
		return `<tr><td>${escapeHtml(m.from)}</td><td>${escapeHtml(m.to)}</td><td>${escapeHtml(name)}${doc}</td></tr>`
	})
	return [
		`<section class="messages" id="messages"><h2>Message flows</h2>`,
		"<table><thead><tr><th>From</th><th>To</th><th>Message</th></tr></thead><tbody>",
		...rows,
		"</tbody></table></section>",
	].join("\n")
}

function decisionsHtml(doc: ProcessDocumentation): string {
	if (doc.decisions.length === 0) return ""
	const out = [`<section class="decisions" id="decisions"><h2>Decisions</h2>`]
	for (const d of doc.decisions) {
		out.push(`<h3 id="${anchor("decision", d.id)}">${escapeHtml(d.name)}</h3>`)
		const meta = [
			`Decision ID <code>${escapeHtml(d.id)}</code>`,
			`hit policy ${escapeHtml(d.hitPolicy)}`,
		]
		if (d.calledBy.length > 0) meta.push(`called by ${d.calledBy.map(escapeHtml).join(", ")}`)
		out.push(`<p class="muted">${meta.join(" · ")}</p>`)
		const head = [
			`<th class="num">#</th>`,
			...d.inputs.map((i) => `<th>When: ${escapeHtml(i)}</th>`),
			...d.outputs.map((o) => `<th>Then: ${escapeHtml(o)}</th>`),
			"<th>Note</th>",
		].join("")
		out.push(`<table><thead><tr>${head}</tr></thead><tbody>`)
		d.rules.forEach((r, i) => {
			const cells = r
				.map((c, j) =>
					j < r.length - 1 ? `<td><code>${escapeHtml(c)}</code></td>` : `<td>${escapeHtml(c)}</td>`,
				)
				.join("")
			out.push(`<tr><td class="num">${i + 1}</td>${cells}</tr>`)
		})
		out.push("</tbody></table>")
	}
	out.push("</section>")
	return out.join("\n")
}

function formsHtml(doc: ProcessDocumentation): string {
	if (doc.forms.length === 0) return ""
	const out = [`<section class="forms" id="forms"><h2>Forms</h2>`]
	for (const f of doc.forms) {
		out.push(`<h3 id="${anchor("form", f.id)}">${escapeHtml(f.id)}</h3>`)
		if (f.usedBy.length > 0)
			out.push(`<p class="muted">Shown by ${f.usedBy.map(escapeHtml).join(", ")}</p>`)
		if (f.fields.length === 0) {
			out.push(`<p class="muted">This form has no input fields.</p>`)
			continue
		}
		out.push(
			"<table><thead><tr><th>Field</th><th>Variable</th><th>Type</th><th>Required</th><th>Options</th></tr></thead><tbody>",
		)
		for (const field of f.fields) {
			out.push(
				`<tr><td>${escapeHtml(field.label)}</td><td><code>${escapeHtml(field.key)}</code></td><td>${escapeHtml(field.type)}</td><td>${field.required ? "Yes" : "No"}</td><td>${escapeHtml(field.options)}</td></tr>`,
			)
		}
		out.push("</tbody></table>")
	}
	out.push("</section>")
	return out.join("\n")
}

/** Renders already-built documentation as a standalone HTML document. */
export function documentationToHtml(doc: ProcessDocumentation): string {
	const body: string[] = [
		`<header><div class="eyebrow">Process documentation</div><h1>${escapeHtml(doc.title)}</h1>`,
	]
	if (doc.subtitle) body.push(`<p class="subtitle">${escapeHtml(doc.subtitle)}</p>`)
	body.push("</header>")
	body.push(
		`<p class="print-hint">To save this document as a PDF, use your browser's Print command and choose “Save as PDF”. A4 and Letter both work.</p>`,
	)
	if (doc.documentation) body.push(`<p class="prose">${escapeHtml(doc.documentation)}</p>`)
	body.push(tocHtml(doc))
	if (doc.diagramSvg) {
		body.push(
			`<section class="diagram-page"><h2 id="diagram">Diagram</h2><figure class="diagram">${doc.diagramSvg}</figure></section>`,
		)
	}
	for (const p of doc.processes) body.push(processHtml(p))
	body.push(messagesHtml(doc), decisionsHtml(doc), formsHtml(doc))

	return [
		"<!DOCTYPE html>",
		`<html lang="en">`,
		"<head>",
		`<meta charset="utf-8">`,
		`<meta name="viewport" content="width=device-width, initial-scale=1">`,
		`<meta name="generator" content="bpmnkit">`,
		`<title>${escapeHtml(doc.title)} — process documentation</title>`,
		`<style>${CSS}</style>`,
		"</head>",
		"<body>",
		...body.filter((s) => s !== ""),
		"</body>",
		"</html>",
		"",
	].join("\n")
}

/**
 * Renders a BPMN model as a self-contained, print-ready HTML document: the
 * diagram as inline SVG, a table of contents, one section per process or pool
 * with its lanes and every element in flow order, then any message flows,
 * decision tables and forms. No scripts, no network requests. The browser's
 * Print → Save as PDF gives a paginated PDF on A4 or Letter.
 *
 * @example
 * ```typescript
 * import { Bpmn, renderDocumentationHtml } from "@bpmnkit/core"
 *
 * const html = renderDocumentationHtml(Bpmn.parse(xml), { title: "Order to Cash" })
 * ```
 */
export function renderDocumentationHtml(
	defs: BpmnDefinitions,
	options?: DocumentationOptions,
): string {
	return documentationToHtml(buildProcessDocumentation(defs, options))
}

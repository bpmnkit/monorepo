import type { CanvasPlugin } from "@bpmn-sdk/canvas"
import type { BpmnFlowElement } from "@bpmn-sdk/core"
import { CATEGORIES, ENTRIES } from "./content.js"

// ── Styles ──────────────────────────────────────────────────────────────────

const STYLE_ID = "bpmn-element-docs-styles"

const CSS = `
.bpmn-edocs {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  color: rgba(255,255,255,0.85);
  font-size: 13px;
}
.bpmn-edocs__search {
  padding: 10px 12px 8px;
  flex-shrink: 0;
}
.bpmn-edocs__search input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; padding: 6px 10px;
  color: rgba(255,255,255,0.85); font-size: 12px; outline: none;
  font-family: inherit;
}
.bpmn-edocs__search input::placeholder { color: rgba(255,255,255,0.3); }
.bpmn-edocs__search input:focus { border-color: #4c8ef7; background: rgba(76,142,247,0.08); }
.bpmn-edocs__body { flex: 1; overflow-y: auto; padding: 0 0 16px; }
/* ── Category ── */
.bpmn-edocs__cat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3); padding: 12px 12px 4px; position: sticky; top: 0;
  background: rgba(18,18,26,0.98); z-index: 1;
}
/* ── Index items ── */
.bpmn-edocs__item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 7px 12px; cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}
.bpmn-edocs__item:hover { background: rgba(255,255,255,0.05); border-left-color: #4c8ef7; }
.bpmn-edocs__item.active { background: rgba(76,142,247,0.1); border-left-color: #4c8ef7; }
.bpmn-edocs__item-title { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); }
.bpmn-edocs__item-brief { font-size: 11px; color: rgba(255,255,255,0.35); }
/* ── Detail view ── */
.bpmn-edocs__detail { display: flex; flex-direction: column; height: 100%; }
.bpmn-edocs__detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px 10px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.bpmn-edocs__back {
  background: none; border: none; cursor: pointer;
  color: #4c8ef7; font-size: 18px; line-height: 1;
  padding: 0 4px 0 0; display: flex; align-items: center;
  flex-shrink: 0;
}
.bpmn-edocs__back:hover { color: #7db0ff; }
.bpmn-edocs__detail-title {
  font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); flex: 1; min-width: 0;
}
.bpmn-edocs__detail-subtitle { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
.bpmn-edocs__shape-icon {
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; color: rgba(255,255,255,0.6);
}
.bpmn-edocs__detail-body {
  flex: 1; overflow-y: auto;
  padding: 14px 14px 24px;
  line-height: 1.6;
}
/* ── Markdown rendered content ── */
.bpmn-edocs__md h2 {
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4); margin: 18px 0 6px; padding: 0;
}
.bpmn-edocs__md h3 {
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7);
  margin: 14px 0 4px;
}
.bpmn-edocs__md p { margin: 0 0 8px; color: rgba(255,255,255,0.75); font-size: 12.5px; }
.bpmn-edocs__md ul, .bpmn-edocs__md ol {
  margin: 0 0 8px; padding-left: 18px; color: rgba(255,255,255,0.75); font-size: 12.5px;
}
.bpmn-edocs__md li { margin-bottom: 3px; }
.bpmn-edocs__md code {
  font-family: ui-monospace, "Cascadia Code", "SF Mono", monospace;
  font-size: 11px; background: rgba(255,255,255,0.08);
  border-radius: 3px; padding: 1px 5px; color: #a5d6ff;
}
.bpmn-edocs__md pre {
  background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; padding: 10px 12px; overflow-x: auto; margin: 0 0 10px;
}
.bpmn-edocs__md pre code {
  background: none; padding: 0; font-size: 11px; color: #c9d1d9;
}
.bpmn-edocs__md blockquote {
  border-left: 3px solid #4c8ef7; margin: 0 0 10px; padding: 6px 10px;
  background: rgba(76,142,247,0.08); border-radius: 0 4px 4px 0;
  color: rgba(255,255,255,0.65); font-size: 12px;
}
.bpmn-edocs__md blockquote p { margin: 0; color: inherit; font-size: inherit; }
.bpmn-edocs__md table {
  width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 0 0 10px;
}
.bpmn-edocs__md th {
  text-align: left; padding: 5px 8px;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.bpmn-edocs__md td {
  padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.75);
}
.bpmn-edocs__md strong { color: rgba(255,255,255,0.92); font-weight: 600; }
.bpmn-edocs__md em { color: rgba(255,255,255,0.75); font-style: italic; }
.bpmn-edocs__md hr {
  border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 14px 0;
}
/* Light theme */
[data-bpmn-hud-theme="light"] .bpmn-edocs {
  color: rgba(0,0,0,0.8);
}
[data-bpmn-hud-theme="light"] .bpmn-edocs__search input {
  background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.8);
}
[data-bpmn-hud-theme="light"] .bpmn-edocs__search input::placeholder { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__search input:focus { border-color: #1a56db; background: rgba(26,86,219,0.05); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__cat-label { color: rgba(0,0,0,0.3); background: rgba(248,248,252,0.99); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__item:hover { background: rgba(0,0,0,0.04); border-left-color: #1a56db; }
[data-bpmn-hud-theme="light"] .bpmn-edocs__item.active { background: rgba(26,86,219,0.07); border-left-color: #1a56db; }
[data-bpmn-hud-theme="light"] .bpmn-edocs__item-title { color: rgba(0,0,0,0.8); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__item-brief { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__back { color: #1a56db; }
[data-bpmn-hud-theme="light"] .bpmn-edocs__back:hover { color: #1247b8; }
[data-bpmn-hud-theme="light"] .bpmn-edocs__detail-title { color: rgba(0,0,0,0.85); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__detail-subtitle { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md h2 { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md h3 { color: rgba(0,0,0,0.65); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md p,
[data-bpmn-hud-theme="light"] .bpmn-edocs__md ul,
[data-bpmn-hud-theme="light"] .bpmn-edocs__md ol,
[data-bpmn-hud-theme="light"] .bpmn-edocs__md li { color: rgba(0,0,0,0.75); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md code { background: rgba(0,0,0,0.07); color: #0055aa; }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md pre { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md pre code { color: #24292e; }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md blockquote {
  border-left-color: #1a56db; background: rgba(26,86,219,0.06); color: rgba(0,0,0,0.65);
}
[data-bpmn-hud-theme="light"] .bpmn-edocs__md th { background: rgba(0,0,0,0.04); color: rgba(0,0,0,0.5); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md td { color: rgba(0,0,0,0.75); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md strong { color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md em { color: rgba(0,0,0,0.65); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__md hr { border-top-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__detail-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-edocs__shape-icon { color: rgba(0,0,0,0.55); }
`

function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return
	const s = document.createElement("style")
	s.id = STYLE_ID
	s.textContent = CSS
	document.head.appendChild(s)
}

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(md: string): string {
	const lines = md.split("\n")
	const out: string[] = []
	let i = 0

	function esc(t: string): string {
		return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
	}

	function inline(raw: string): string {
		// code (before bold/italic to avoid double-processing)
		let t = raw.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`)
		// bold
		t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		// italic (underscore)
		t = t.replace(/_([^_]+)_/g, "<em>$1</em>")
		return t
	}

	while (i < lines.length) {
		const line = lines[i] ?? ""

		// Fenced code block
		if (line.startsWith("```")) {
			const lang = line.slice(3).trim()
			const codeLines: string[] = []
			i++
			while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
				codeLines.push(esc(lines[i] ?? ""))
				i++
			}
			const langAttr = lang ? ` class="language-${esc(lang)}"` : ""
			out.push(`<pre><code${langAttr}>${codeLines.join("\n")}</code></pre>`)
			i++
			continue
		}

		// Table (lines containing |)
		if (line.includes("|") && (lines[i + 1] ?? "").includes("---")) {
			const headers = line
				.split("|")
				.filter((c) => c.trim() !== "")
				.map((c) => `<th>${inline(c.trim())}</th>`)
				.join("")
			i += 2 // skip header + separator
			const rows: string[] = []
			while (i < lines.length && (lines[i] ?? "").includes("|")) {
				const cells = (lines[i] ?? "")
					.split("|")
					.filter((c) => c.trim() !== "")
					.map((c) => `<td>${inline(c.trim())}</td>`)
					.join("")
				rows.push(`<tr>${cells}</tr>`)
				i++
			}
			out.push(`<table><thead><tr>${headers}</tr></thead><tbody>${rows.join("")}</tbody></table>`)
			continue
		}

		// Heading
		if (line.startsWith("## ")) {
			out.push(`<h2>${inline(esc(line.slice(3)))}</h2>`)
			i++
			continue
		}
		if (line.startsWith("### ")) {
			out.push(`<h3>${inline(esc(line.slice(4)))}</h3>`)
			i++
			continue
		}

		// Blockquote
		if (line.startsWith("> ")) {
			const bqLines: string[] = []
			while (i < lines.length && (lines[i] ?? "").startsWith("> ")) {
				bqLines.push(inline(esc((lines[i] ?? "").slice(2))))
				i++
			}
			out.push(`<blockquote><p>${bqLines.join("<br>")}</p></blockquote>`)
			continue
		}

		// Unordered list
		if (line.startsWith("- ")) {
			const items: string[] = []
			while (i < lines.length && (lines[i] ?? "").startsWith("- ")) {
				items.push(`<li>${inline(esc((lines[i] ?? "").slice(2)))}</li>`)
				i++
			}
			out.push(`<ul>${items.join("")}</ul>`)
			continue
		}

		// Numbered list
		if (/^\d+\. /.test(line)) {
			const items: string[] = []
			while (i < lines.length && /^\d+\. /.test(lines[i] ?? "")) {
				items.push(`<li>${inline(esc((lines[i] ?? "").replace(/^\d+\. /, "")))}</li>`)
				i++
			}
			out.push(`<ol>${items.join("")}</ol>`)
			continue
		}

		// Horizontal rule
		if (line.startsWith("---")) {
			out.push("<hr>")
			i++
			continue
		}

		// Empty line — paragraph break
		if (line.trim() === "") {
			i++
			continue
		}

		// Paragraph — collect until empty line or block element
		const paraLines: string[] = []
		while (
			i < lines.length &&
			(lines[i] ?? "").trim() !== "" &&
			!(lines[i] ?? "").startsWith("#") &&
			!(lines[i] ?? "").startsWith("> ") &&
			!(lines[i] ?? "").startsWith("- ") &&
			!(lines[i] ?? "").startsWith("```") &&
			!/^\d+\. /.test(lines[i] ?? "")
		) {
			paraLines.push(inline(esc(lines[i] ?? "")))
			i++
		}
		if (paraLines.length > 0) {
			out.push(`<p>${paraLines.join(" ")}</p>`)
		}
	}

	return out.join("\n")
}

// ── SVG shape icons ──────────────────────────────────────────────────────────

function getShapeIcon(docKey: string): string {
	const [base, sub] = docKey.split(":")
	const W = 36
	const H = 36
	const cx = W / 2
	const cy = H / 2
	const r = 14

	// Event fill/stroke helper
	function event(inner: string, dashed = false, thick = false): string {
		const sw = thick ? 3 : 1.5
		const dash = dashed ? ' stroke-dasharray="4 2"' : ""
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"${dash}/>
  ${inner}
</svg>`
	}

	function doubleRing(inner: string): string {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="none" stroke="currentColor" stroke-width="1.5"/>
  ${inner}
</svg>`
	}

	function doubleRingDashed(inner: string): string {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/>
  ${inner}
</svg>`
	}

	const msgIcon = `<rect x="10" y="13" width="16" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <polyline points="10,13 18,20 26,13" fill="none" stroke="currentColor" stroke-width="1.2"/>`
	const timerIcon = `<circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 5}" stroke="currentColor" stroke-width="1.2"/>
  <line x1="${cx}" y1="${cy}" x2="${cx + 3}" y2="${cy + 3}" stroke="currentColor" stroke-width="1.2"/>`
	const signalIcon = `<polygon points="18,10 26,26 10,26" fill="none" stroke="currentColor" stroke-width="1.2"/>`
	const errorIcon = `<polyline points="12,24 16,14 20,20 24,12" fill="none" stroke="currentColor" stroke-width="1.5"/>`
	const escalationIcon = `<polygon points="18,11 24,25 18,21 12,25" fill="none" stroke="currentColor" stroke-width="1.2"/>`
	const compensateIcon = `<polygon points="10,18 17,12 17,24" fill="currentColor" opacity="0.6"/>
  <polygon points="17,18 24,12 24,24" fill="currentColor" opacity="0.6"/>`
	const terminateIcon = `<circle cx="${cx}" cy="${cy}" r="8" fill="currentColor" opacity="0.8"/>`
	const linkIcon = `<polyline points="11,18 22,18" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <polyline points="18,13 24,18 18,23" fill="none" stroke="currentColor" stroke-width="1.5"/>`
	const cancelIcon = `<line x1="11" y1="11" x2="25" y2="25" stroke="currentColor" stroke-width="1.5"/>
  <line x1="25" y1="11" x2="11" y2="25" stroke="currentColor" stroke-width="1.5"/>`

	// Gateway
	function gateway(icon: string): string {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <polygon points="18,4 32,18 18,32 4,18" fill="none" stroke="currentColor" stroke-width="1.5"/>
  ${icon}
</svg>`
	}

	// Task rectangle
	function task(icon: string): string {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="3" y="6" width="30" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  ${icon}
</svg>`
	}

	if (base === "startEvent") {
		const icons: Record<string, string> = {
			message: event(msgIcon),
			timer: event(timerIcon),
			signal: event(signalIcon),
			error: event(errorIcon),
			escalation: event(escalationIcon),
		}
		return sub ? (icons[sub] ?? event("")) : event("")
	}

	if (base === "endEvent") {
		const icons: Record<string, string> = {
			message: event(msgIcon, false, true),
			terminate: event(terminateIcon, false, true),
			error: event(errorIcon, false, true),
			signal: event(signalIcon, false, true),
			escalation: event(escalationIcon, false, true),
			compensation: event(compensateIcon, false, true),
		}
		return sub ? (icons[sub] ?? event("", false, true)) : event("", false, true)
	}

	if (base === "intermediateCatchEvent") {
		const icons: Record<string, string> = {
			message: doubleRing(msgIcon),
			timer: doubleRing(timerIcon),
			signal: doubleRing(signalIcon),
			link: doubleRing(linkIcon),
		}
		return sub ? (icons[sub] ?? doubleRing("")) : doubleRing("")
	}

	if (base === "intermediateThrowEvent") {
		const icons: Record<string, string> = {
			message: doubleRing(
				`<rect x="10" y="13" width="16" height="10" rx="1" fill="currentColor" opacity="0.4" stroke="currentColor" stroke-width="1.2"/>`,
			),
			signal: doubleRing(
				`<polygon points="18,10 26,26 10,26" fill="currentColor" opacity="0.4" stroke="currentColor" stroke-width="1.2"/>`,
			),
			escalation: doubleRing(escalationIcon),
			compensation: doubleRing(compensateIcon),
			link: doubleRing(linkIcon),
		}
		return sub ? (icons[sub] ?? doubleRing("")) : doubleRing("")
	}

	if (base === "boundaryEvent") {
		const icons: Record<string, string> = {
			message: doubleRing(msgIcon),
			timer: doubleRing(timerIcon),
			error: doubleRing(errorIcon),
			signal: doubleRing(signalIcon),
			timer_escalation: doubleRingDashed(escalationIcon),
			compensation: doubleRing(compensateIcon),
			cancel: doubleRing(cancelIcon),
		}
		return sub ? (icons[sub] ?? doubleRing("")) : doubleRing("")
	}

	if (base === "exclusiveGateway") {
		return gateway(
			`<line x1="12" y1="12" x2="24" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="12" x2="12" y2="24" stroke="currentColor" stroke-width="2"/>`,
		)
	}
	if (base === "parallelGateway") {
		return gateway(
			`<line x1="18" y1="10" x2="18" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="18" x2="26" y2="18" stroke="currentColor" stroke-width="2"/>`,
		)
	}
	if (base === "inclusiveGateway") {
		return gateway(
			`<circle cx="18" cy="18" r="5" fill="none" stroke="currentColor" stroke-width="2"/>`,
		)
	}
	if (base === "eventBasedGateway") {
		return gateway(`<circle cx="18" cy="18" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <polygon points="18,12 21,17 27,17 22,21 24,27 18,23 12,27 14,21 9,17 15,17" fill="none" stroke="currentColor" stroke-width="1"/>`)
	}

	if (base === "serviceTask")
		return task(
			`<text x="18" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">⚙</text>`,
		)
	if (base === "userTask")
		return task(
			`<text x="18" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">👤</text>`,
		)
	if (base === "businessRuleTask")
		return task(
			`<text x="18" y="22" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">≡</text>`,
		)
	if (base === "scriptTask")
		return task(
			`<text x="18" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">{}</text>`,
		)
	if (base === "sendTask")
		return task(
			`<rect x="10" y="13" width="16" height="10" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="1.2"/>`,
		)
	if (base === "receiveTask")
		return task(
			`<rect x="10" y="13" width="16" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
		)
	if (base === "manualTask")
		return task(
			`<text x="18" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">✋</text>`,
		)

	if (base === "callActivity") {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="3" y="6" width="30" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
  <rect x="12" y="22" width="12" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
</svg>`
	}

	if (base === "subProcess") {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="3" y="6" width="30" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="15" y="24" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <line x1="18" y1="24" x2="18" y2="26" stroke="currentColor" stroke-width="1.2"/>
  <line x1="15" y1="26" x2="21" y2="26" stroke="currentColor" stroke-width="1.2"/>
</svg>`
	}

	if (base === "adHocSubProcess") {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="3" y="6" width="30" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 2"/>
  <text x="18" y="23" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">~</text>
</svg>`
	}

	if (base === "sequenceFlow") {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <line x1="6" y1="18" x2="28" y2="18" stroke="currentColor" stroke-width="1.5"/>
  <polygon points="28,14 36,18 28,22" fill="currentColor"/>
</svg>`
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="3" y="6" width="30" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`
}

// ── Doc key from BpmnFlowElement ─────────────────────────────────────────────

function docKeyFromElement(el: BpmnFlowElement): string {
	if (
		el.type === "startEvent" ||
		el.type === "endEvent" ||
		el.type === "intermediateCatchEvent" ||
		el.type === "intermediateThrowEvent" ||
		el.type === "boundaryEvent"
	) {
		const evDef = el.eventDefinitions[0]
		if (evDef) return `${el.type}:${evDef.type}`
	}
	return el.type
}

// ── Plugin ───────────────────────────────────────────────────────────────────

export interface ElementDocsOptions {
	/** The container element (e.g. dock.docsPane) to mount the docs panel into. */
	container: HTMLElement
}

export function createElementDocsPlugin(options: ElementDocsOptions): CanvasPlugin {
	injectStyles()

	const { container } = options

	// ── Root UI ──────────────────────────────────────────────────────────────
	const root = document.createElement("div")
	root.className = "bpmn-edocs"

	// Search bar (only shown in index view)
	const searchWrap = document.createElement("div")
	searchWrap.className = "bpmn-edocs__search"
	const searchInput = document.createElement("input")
	searchInput.type = "search"
	searchInput.placeholder = "Search elements…"
	searchInput.setAttribute("aria-label", "Search BPMN elements")
	searchWrap.appendChild(searchInput)

	// Scrollable body
	const body = document.createElement("div")
	body.className = "bpmn-edocs__body"

	root.appendChild(searchWrap)
	root.appendChild(body)
	container.appendChild(root)

	// ── State ────────────────────────────────────────────────────────────────
	let _currentKey: string | null = null
	let _query = ""

	// ── Index rendering ──────────────────────────────────────────────────────
	function renderIndex(query: string): void {
		searchWrap.style.display = ""
		body.innerHTML = ""

		const q = query.toLowerCase().trim()

		for (const cat of CATEGORIES) {
			const filtered = q
				? cat.items.filter(
						(item) => item.title.toLowerCase().includes(q) || item.brief.toLowerCase().includes(q),
					)
				: cat.items
			if (filtered.length === 0) continue

			const catLabel = document.createElement("div")
			catLabel.className = "bpmn-edocs__cat-label"
			catLabel.textContent = cat.label
			body.appendChild(catLabel)

			for (const item of filtered) {
				const row = document.createElement("div")
				row.className = `bpmn-edocs__item${_currentKey === item.key ? " active" : ""}`
				row.setAttribute("role", "button")
				row.setAttribute("tabindex", "0")

				const titleEl = document.createElement("div")
				titleEl.className = "bpmn-edocs__item-title"
				titleEl.textContent = item.title

				const briefEl = document.createElement("div")
				briefEl.className = "bpmn-edocs__item-brief"
				briefEl.textContent = item.brief

				row.appendChild(titleEl)
				row.appendChild(briefEl)
				row.addEventListener("click", () => showDetail(item.key))
				row.addEventListener("keydown", (e) => {
					if (e.key === "Enter" || e.key === " ") showDetail(item.key)
				})
				body.appendChild(row)
			}
		}

		if (body.children.length === 0) {
			const empty = document.createElement("div")
			empty.style.cssText =
				"padding: 24px 12px; color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;"
			empty.textContent = "No elements match your search."
			body.appendChild(empty)
		}
	}

	// ── Detail rendering ─────────────────────────────────────────────────────
	function showDetail(key: string): void {
		_currentKey = key
		const entry = ENTRIES[key]
		if (!entry) {
			renderIndex(_query)
			return
		}

		searchWrap.style.display = "none"
		body.innerHTML = ""

		const detail = document.createElement("div")
		detail.className = "bpmn-edocs__detail"

		// Header: back button + icon + title
		const header = document.createElement("div")
		header.className = "bpmn-edocs__detail-header"

		const backBtn = document.createElement("button")
		backBtn.className = "bpmn-edocs__back"
		backBtn.title = "Back to index"
		backBtn.setAttribute("aria-label", "Back to element list")
		backBtn.innerHTML = "‹"
		backBtn.addEventListener("click", () => {
			_currentKey = null
			renderIndex(_query)
		})

		const iconEl = document.createElement("div")
		iconEl.className = "bpmn-edocs__shape-icon"
		iconEl.innerHTML = getShapeIcon(key)

		const titles = document.createElement("div")
		titles.style.flex = "1"
		titles.style.minWidth = "0"
		const titleEl = document.createElement("div")
		titleEl.className = "bpmn-edocs__detail-title"
		titleEl.textContent = entry.title
		const subEl = document.createElement("div")
		subEl.className = "bpmn-edocs__detail-subtitle"
		subEl.textContent = entry.subtitle
		titles.appendChild(titleEl)
		titles.appendChild(subEl)

		header.appendChild(backBtn)
		header.appendChild(iconEl)
		header.appendChild(titles)

		// Body: rendered markdown
		const mdBody = document.createElement("div")
		mdBody.className = "bpmn-edocs__detail-body"
		const mdContent = document.createElement("div")
		mdContent.className = "bpmn-edocs__md"
		mdContent.innerHTML = renderMarkdown(entry.body)
		mdBody.appendChild(mdContent)

		detail.appendChild(header)
		detail.appendChild(mdBody)
		body.appendChild(detail)
	}

	// ── Search ───────────────────────────────────────────────────────────────
	searchInput.addEventListener("input", () => {
		_query = searchInput.value
		renderIndex(_query)
	})

	// ── Public API ───────────────────────────────────────────────────────────

	/** Navigate to the doc for a given element. */
	function showDocForElement(el: BpmnFlowElement): void {
		const key = docKeyFromElement(el)
		if (ENTRIES[key]) {
			showDetail(key)
		} else if (ENTRIES[el.type]) {
			showDetail(el.type)
		}
	}

	// Render index initially
	renderIndex("")

	// ── Canvas plugin ────────────────────────────────────────────────────────
	const unsubs: Array<() => void> = []

	return {
		name: "element-docs",

		install(api) {
			type EvtFn = (event: string, handler: (...args: unknown[]) => void) => () => void
			const anyOn = api.on.bind(api) as unknown as EvtFn

			unsubs.push(
				anyOn("editor:select", (rawIds) => {
					const ids = rawIds as string[]
					if (ids.length !== 1) return
					const id = ids[0]
					if (!id) return
					// Find the selected element via rendered shapes
					const shape = api.getShapes().find((s) => s.id === id)
					if (shape?.flowElement) {
						showDocForElement(shape.flowElement)
						return
					}
					// Sequence flows are edges, not shapes
					const edge = api.getEdges().find((e) => e.id === id)
					if (edge) showDetail("sequenceFlow")
				}),
			)
		},

		uninstall() {
			for (const off of unsubs) off()
			unsubs.length = 0
			container.removeChild(root)
		},
	}
}

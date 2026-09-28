import { describe, expect, it } from "vitest"
import { renderBpmnBlock, renderBpmnInHtml } from "../src/index.js"
import { COMPACT, XML_WITHOUT_DI } from "./fixtures.js"

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

describe("renderBpmnInHtml", () => {
	it("replaces escaped BPMN code blocks with the diagram", () => {
		const html = `<h1>Flow</h1>\n<pre><code class="language-bpmn">${escapeHtml(XML_WITHOUT_DI)}</code></pre>\n<p>after</p>`
		const out = renderBpmnInHtml(html, { theme: "light" })
		expect(out).toBe(
			`<h1>Flow</h1>\n${renderBpmnBlock(XML_WITHOUT_DI, "bpmn", { theme: "light" }).html}\n<p>after</p>`,
		)
	})

	it("decodes numeric entities and tolerates extra classes and attributes", () => {
		const code = COMPACT.replace(/"/g, "&#34;")
		const html = `<pre class="x"><code data-x="1" class="hl language-bpmn-compact">${code}</code></pre>`
		expect(renderBpmnInHtml(html)).toContain("Order fulfilment</title>")
	})

	it("leaves other code blocks untouched", () => {
		const html = '<pre><code class="language-bpmnish">x</code></pre><pre><code>y</code></pre>'
		expect(renderBpmnInHtml(html)).toBe(html)
	})
})

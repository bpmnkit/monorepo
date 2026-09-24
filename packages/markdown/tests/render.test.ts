import { Bpmn, exportSvg } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { type BpmnLang, type RenderOptions, renderBpmnBlock } from "../src/index.js"
import { COMPACT, COMPACT_FULL, XML_WITHOUT_DI, XML_WITH_DI } from "./fixtures.js"

function svgOf(code: string, lang: BpmnLang, options: RenderOptions = {}) {
	const result = renderBpmnBlock(code, lang, options)
	if (!result.ok) throw new Error(`expected a diagram, got: ${result.error}`)
	return result
}

describe("renderBpmnBlock — inputs", () => {
	it("keeps the layout of XML that carries DI", () => {
		const { svg } = svgOf(XML_WITH_DI, "bpmn")
		const original = exportSvg(Bpmn.parse(XML_WITH_DI))
		const viewBox = /viewBox="([^"]*)"/.exec(original)?.[1]
		expect(svg).toContain(`viewBox="${viewBox}"`)
	})

	it("lays out XML with no DI instead of drawing nothing", () => {
		const { svg, title } = svgOf(XML_WITHOUT_DI, "bpmn")
		expect(title).toBe("Leave request")
		expect(svg).toContain(">Review</text>")
		expect(svg).toContain("<rect") // the task body, not the 1×1 empty-diagram fallback
		expect(svg).not.toContain('viewBox="0 0 1 1"')
	})

	it("renders compact JSON, both the full form and the single-process shorthand", () => {
		const short = svgOf(COMPACT, "bpmn-compact")
		const full = svgOf(COMPACT_FULL, "bpmn-compact")
		expect(short.svg).toContain(">Check stock</text>")
		expect(short.title).toBe("Order fulfilment")
		expect(full.svg).toBe(short.svg.replaceAll(idOf(short.svg), idOf(full.svg)))
	})

	it("treats bpmn-json as an alias of bpmn-compact", () => {
		expect(svgOf(COMPACT, "bpmn-json").svg).toContain(">Check stock</text>")
	})
})

describe("renderBpmnBlock — errors", () => {
	it.each([
		["bpmn", "<bpmn:definitions", /Expected|parse/i],
		["bpmn", "<foo/>", /Expected <definitions> root element/],
		["bpmn-compact", "{", /invalid JSON/],
		["bpmn-compact", '{"id":"x"}', /processes/],
		["bpmn", "   ", /empty/],
	] as const)("%s %j renders a readable error box", (lang, code, message) => {
		const result = renderBpmnBlock(code, lang)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toMatch(message)
		expect(result.html).toContain("BPMN diagram could not be rendered")
		expect(result.html).toContain("var(--bpmnkit-danger, #dc2626)")
	})

	it("escapes the error message", () => {
		const result = renderBpmnBlock("<foo/>", "bpmn")
		expect(result.html).toContain("&lt;definitions&gt;")
		expect(result.html).not.toContain("<definitions>")
	})

	it("throws instead when onError is throw", () => {
		expect(() => renderBpmnBlock("{", "bpmn-compact", { onError: "throw" })).toThrow(
			/Cannot render `bpmn-compact` block: invalid JSON/,
		)
	})
})

describe("renderBpmnBlock — accessibility", () => {
	it("names the diagram from the process and labels the SVG with it", () => {
		const { svg } = svgOf(COMPACT, "bpmn-compact")
		const id = idOf(svg)
		expect(svg).toMatch(/^<svg [^>]*role="img"/)
		expect(svg).toContain(`aria-labelledby="${id}-title"`)
		expect(svg).toContain(`<title id="${id}-title">Order fulfilment</title>`)
		expect(svg).toContain(`aria-describedby="${id}-desc"`)
		expect(svg).toContain("Steps: Order received, Check stock, In stock?, Ship order")
	})

	it("takes an explicit title and escapes it", () => {
		const { svg } = svgOf(COMPACT, "bpmn-compact", { title: 'Orders <"v2"> & returns' })
		expect(svg).toContain(">Orders &lt;&quot;v2&quot;&gt; &amp; returns</title>")
	})

	it("escapes element names from the model", () => {
		const { svg } = svgOf(XML_WITH_DI, "bpmn")
		expect(svg).toContain("Approve &lt;invoice&gt; &amp; pay")
	})
})

describe("renderBpmnBlock — theming and output", () => {
	it("is deterministic", () => {
		for (const [code, lang] of [
			[COMPACT, "bpmn-compact"],
			[XML_WITHOUT_DI, "bpmn"],
			[XML_WITH_DI, "bpmn"],
		] as const) {
			expect(renderBpmnBlock(code, lang).html).toBe(renderBpmnBlock(code, lang).html)
		}
	})

	it("auto follows the page tokens, falling back to the reader's colour scheme", () => {
		const { svg } = svgOf(COMPACT, "bpmn-compact")
		expect(svg).toContain("--bkmd-fill:var(--bpmnkit-surface, light-dark(#ffffff, #161626))")
		expect(svg).toContain("--bkmd-stroke:var(--bpmnkit-fg, light-dark(#1a1a2e, #cdd6f4))")
		expect(svg).toContain("color-scheme:light dark")
	})

	it("light and dark pin the palette", () => {
		const dark = svgOf(COMPACT, "bpmn-compact", { theme: "dark" }).svg
		const light = svgOf(COMPACT, "bpmn-compact", { theme: "light" }).svg
		expect(dark).toContain("--bkmd-bg:#0d0d16")
		expect(dark).toContain("color-scheme:dark")
		expect(light).toContain("--bkmd-bg:#f4f4f8")
		for (const svg of [dark, light]) expect(svg).not.toContain("light-dark(")
	})

	it("replaces every fixed colour and ships no <style> element", () => {
		for (const theme of ["auto", "light", "dark"] as const) {
			const { svg } = svgOf(XML_WITH_DI, "bpmn", { theme })
			// Below the root, which defines the variables, exportSvg's stock light palette
			// must be gone: every colour goes through a variable.
			const body = svg.slice(svg.indexOf(">") + 1)
			for (const color of ["#f8f9fa", "#ffffff", "#404040", "#333333", "rgba(0,0,0,0.04)"]) {
				expect(body).not.toContain(color)
			}
			expect(svg).not.toMatch(/(fill|stroke)="#/)
			expect(svg).not.toContain("<style")
			expect(svg).not.toContain('class="')
		}
	})

	it("gives its marker an id of its own, so two diagrams can share a page", () => {
		const a = svgOf(COMPACT, "bpmn-compact").svg
		const b = svgOf(XML_WITH_DI, "bpmn").svg
		expect(idOf(a)).not.toBe(idOf(b))
		expect(a).toContain(`url(#${idOf(a)}-arrow)`)
		expect(a).not.toContain('id="arr"')
	})

	it("caps the drawn width at maxWidth, keeping the aspect ratio", () => {
		const natural = svgOf(COMPACT, "bpmn-compact").svg
		const capped = svgOf(COMPACT, "bpmn-compact", { maxWidth: 300 }).svg
		const [w, h] = size(natural)
		expect(size(capped)).toEqual([300, Math.round((h * 300 * 100) / w) / 100])
		expect(capped).toContain("max-width:100%;height:auto")
	})

	it("adds an editor link only when asked", () => {
		expect(svgOf(COMPACT, "bpmn-compact").html).not.toContain("<a ")
		const { html } = svgOf(COMPACT, "bpmn-compact", {
			link: ({ xml, title }) => `https://example.com/open?t=${title}&len=${xml.length > 0}`,
		})
		expect(html).toContain('<a href="https://example.com/open?t=Order fulfilment&amp;len=true">')
		expect(html).toMatch(/^<figure class="bpmnkit-diagram"[^>]*><svg /)
	})
})

function idOf(svg: string): string {
	return /^<svg [^>]*\bid="([^"]+)"/.exec(svg)?.[1] ?? ""
}

function size(svg: string): [number, number] {
	const m = /^<svg [^>]*width="([\d.]+)" height="([\d.]+)"/.exec(svg)
	return [Number(m?.[1]), Number(m?.[2])]
}

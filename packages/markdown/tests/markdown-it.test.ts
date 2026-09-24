import MarkdownIt from "markdown-it"
import { describe, expect, it } from "vitest"
import { markdownItBpmn, renderBpmnBlock } from "../src/index.js"
import { COMPACT, XML_WITHOUT_DI } from "./fixtures.js"

describe("markdownItBpmn", () => {
	it("renders BPMN fences to the same HTML as the core function", () => {
		const md = new MarkdownIt().use(markdownItBpmn)
		const html = md.render(`\`\`\`bpmn-compact\n${COMPACT}\n\`\`\`\n`)
		expect(html).toBe(renderBpmnBlock(`${COMPACT}\n`, "bpmn-compact").html)
	})

	it("passes options through and reads a title from the fence info", () => {
		const md = new MarkdownIt().use(markdownItBpmn, { theme: "dark" })
		const html = md.render(`~~~bpmn title="Leave flow"\n${XML_WITHOUT_DI}\n~~~\n`)
		expect(html).toContain(">Leave flow</title>")
		expect(html).toContain("color-scheme:dark")
	})

	it("hands every other fence to the rule it replaced", () => {
		const md = new MarkdownIt({ highlight: (code) => `<b>${code.trim()}</b>` }).use(markdownItBpmn)
		expect(md.render("```js\nlet a\n```\n")).toContain("<b>let a</b>")
	})

	it("renders an error box for invalid input", () => {
		const md = new MarkdownIt().use(markdownItBpmn)
		expect(md.render("```bpmn-json\n[1,\n```\n")).toContain(
			"BPMN diagram could not be rendered (bpmn-json)",
		)
	})
})

import { describe, expect, it } from "vitest"
import { UnknownConstructError, stripMdx } from "../src/mdx.js"

const file = "docs/example.md"

describe("stripMdx", () => {
	it("fails on an unrecognised component rather than dropping it", () => {
		expect(() => stripMdx("<SomeNewThing />", { file })).toThrow(UnknownConstructError)
	})

	it("names the file and line a human has to open", () => {
		const source = "one\ntwo\n<SomeNewThing />"
		expect(() => stripMdx(source, { file, lineOffset: 5 })).toThrow("docs/example.md:8")
	})

	it("keeps a marker that changes the meaning of the sentence", () => {
		const out = stripMdx("`now()` <MarkerCamundaExtension />", { file })
		expect(out).toBe("`now()` (Camunda extension)")
	})

	it("leaves a lowercase placeholder in prose alone", () => {
		const source = "Run `view <key>`, where <key> is the process key."
		expect(stripMdx(source, { file })).toBe(source)
	})

	it("turns an admonition into prose", () => {
		const out = stripMdx(":::note\nAvoid broad verbs.\n:::", { file })
		expect(out).toBe("**Note**\nAvoid broad verbs.")
	})

	it("keeps a tab label, which is a term someone would search for", () => {
		const source = '<Tabs>\n<TabItem value="vscode">\nUse the palette.\n</TabItem>\n</Tabs>'
		expect(stripMdx(source, { file })).toContain("### vscode")
	})

	it("renders an embedded diagram into the prose", () => {
		const out = stripMdx('<div bpmn="best-practices/gateway.bpmn" />', {
			file,
			renderBpmn: () => 'Diagram (BPMN):\n  start "Invoice to be checked"',
		})
		expect(out).toContain('start "Invoice to be checked"')
	})

	it("drops an embed whose diagram is missing, rather than failing the build", () => {
		const out = stripMdx('before\n<div bpmn="gone.bpmn" />\nafter', {
			file,
			renderBpmn: () => undefined,
		})
		expect(out).toBe("before\nafter")
	})

	it("inlines an imported partial instead of discarding its prose", () => {
		const source = 'import SaasPrereqs from "./_prereqs.md"\n\n<SaasPrereqs/>'
		const out = stripMdx(source, {
			file,
			readPartial: (path) => (path === "./_prereqs.md" ? "You need a cluster." : undefined),
		})
		expect(out).toBe("You need a cluster.")
	})

	it("unescapes the underscore Docusaurus escapes in a partial import", () => {
		const seen: string[] = []
		stripMdx('import P from "../react-components/\\_card.md"\n\n<P/>', {
			file,
			readPartial: (path) => {
				seen.push(path)
				return ""
			},
		})
		expect(seen).toEqual(["../react-components/_card.md"])
	})

	it("leaves fenced code untouched", () => {
		const source = "```tsx\n<SomeNewThing />\n```"
		expect(stripMdx(source, { file })).toBe(source)
	})
})

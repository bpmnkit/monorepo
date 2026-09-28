import { compile, run } from "@mdx-js/mdx"
import type { Root } from "mdast"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { describe, expect, it } from "vitest"
import { type MdastNode, remarkBpmn } from "../src/index.js"
import type { RenderOptions } from "../src/index.js"
import { COMPACT, XML_WITHOUT_DI } from "./fixtures.js"

// Compile-time: an mdast Root is accepted where the plugin's structural type is expected.
const _rootIsMdastNode = (root: Root): MdastNode => root

async function toHtml(markdown: string, options?: RenderOptions) {
	const file = await unified()
		.use(remarkParse)
		.use(remarkBpmn, options)
		.use(remarkRehype)
		.use(rehypeStringify)
		.process(markdown)
	return { html: String(file), messages: file.messages }
}

describe("remarkBpmn", () => {
	it("replaces bpmn-compact and bpmn blocks with inline SVG", async () => {
		const { html } = await toHtml(
			`# Flow\n\n\`\`\`bpmn-compact\n${COMPACT}\n\`\`\`\n\n\`\`\`bpmn\n${XML_WITHOUT_DI}\n\`\`\`\n`,
		)
		expect(html).toContain('<figure class="bpmnkit-diagram"')
		expect(html.match(/<svg /g)).toHaveLength(2)
		expect(html).toContain('role="img"')
		expect(html).toContain("Order fulfilment</title>")
		expect(html).toContain("Leave request</title>")
		expect(html).not.toContain("language-bpmn")
	})

	it("serialises the same SVG the core renderer produces", async () => {
		const { html } = await toHtml(`\`\`\`bpmn-compact\n${COMPACT}\n\`\`\``)
		expect(html).toContain('stroke-width="1.5"')
		expect(html).toContain("<text ")
		expect(html).toContain("Check stock</text>")
	})

	it("leaves other code blocks alone", async () => {
		const { html } = await toHtml("```js\nconst a = 1 < 2\n```")
		expect(html).toContain('<code class="language-js">const a = 1 &#x3C; 2')
	})

	it("reads a title from the fence meta", async () => {
		const { html } = await toHtml(`\`\`\`bpmn-compact title="Happy path"\n${COMPACT}\n\`\`\``)
		expect(html).toContain(">Happy path</title>")
	})

	it("renders an error box and reports a message for an invalid block", async () => {
		const { html, messages } = await toHtml("```bpmn\n<nope/>\n```")
		expect(html).toContain("BPMN diagram could not be rendered (bpmn)")
		expect(messages.map(String)).toEqual([
			expect.stringContaining("BPMN block not rendered: Expected <definitions> root element"),
		])
	})

	it("fails the build when onError is throw", async () => {
		await expect(toHtml("```bpmn\n<nope/>\n```", { onError: "throw" })).rejects.toThrow(
			/Cannot render `bpmn` block/,
		)
	})

	it("works in MDX, which drops raw HTML nodes", async () => {
		const code = await compile(`# Flow\n\n\`\`\`bpmn-compact\n${COMPACT}\n\`\`\`\n`, {
			outputFormat: "function-body",
			remarkPlugins: [remarkBpmn],
		})
		const { default: Content } = await run(code, { ...jsxRuntime, baseUrl: import.meta.url })
		const tree = Content({}) as JsxNode
		const svg = find(tree, "svg")
		expect(svg?.props.role).toBe("img")
		expect(svg?.props.viewBox).toMatch(/^-?\d/)
		expect(find(tree, "title")?.props.children).toBe("Order fulfilment")
	})
})

interface JsxNode {
	type: unknown
	props: Record<string, unknown> & { children?: unknown }
}

/** A JSX runtime that builds a plain tree, so the test needs no React. */
const jsxRuntime = {
	Fragment: "fragment",
	jsx: (type: unknown, props: JsxNode["props"]): JsxNode => ({ type, props }),
	jsxs: (type: unknown, props: JsxNode["props"]): JsxNode => ({ type, props }),
}

function find(node: unknown, type: string): JsxNode | undefined {
	if (Array.isArray(node)) {
		for (const child of node) {
			const hit = find(child, type)
			if (hit) return hit
		}
		return undefined
	}
	if (node === null || typeof node !== "object" || !("props" in node)) return undefined
	const el = node as JsxNode
	if (typeof el.type === "function")
		return find((el.type as (p: unknown) => unknown)(el.props), type)
	if (el.type === type) return el
	return find(el.props.children, type)
}

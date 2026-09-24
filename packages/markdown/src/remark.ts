import { type HastElement, toHast } from "./hast.js"
import { type RenderOptions, isBpmnLang, parseFenceMeta, renderBpmnBlock } from "./render.js"

/**
 * The slice of mdast (https://github.com/syntax-tree/mdast) the plugin reads.
 * Structural, so the package imports neither `@types/mdast` nor unified; an mdast
 * `Root` is assignable to it.
 */
export interface MdastNode {
	type: string
	children?: MdastNode[]
	lang?: string | null
	meta?: string | null
	value?: string
	position?: unknown
	data?: unknown
}

/** The slice of a vfile the plugin reports rendering errors to. */
export interface VFileLike {
	message(reason: string, place?: unknown): unknown
}

/**
 * remark plugin: replaces ` ```bpmn `, ` ```bpmn-compact ` and ` ```bpmn-json ` code
 * blocks with an inline SVG diagram.
 *
 * It works on mdast, before any syntax highlighter sees the block, and hands the
 * diagram on as hast (`data.hName` / `data.hChildren`) rather than as a raw `html`
 * node — so it survives MDX, which drops raw HTML, as well as plain Markdown.
 *
 * A fence attribute `title="…"` overrides the diagram's accessible name.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { remarkBpmn } from "@bpmnkit/markdown"
 * export default defineConfig({ markdown: { remarkPlugins: [[remarkBpmn, { maxWidth: 720 }]] } })
 * ```
 */
export function remarkBpmn(options: RenderOptions = {}) {
	return (tree: MdastNode, file?: VFileLike): void => {
		visit(tree, options, file)
	}
}

function visit(node: MdastNode, options: RenderOptions, file: VFileLike | undefined): void {
	const children = node.children
	if (!children) return
	for (let i = 0; i < children.length; i++) {
		const child = children[i]
		if (!child) continue
		if (child.type === "code" && isBpmnLang(child.lang)) {
			const title = parseFenceMeta(child.meta).title
			const result = renderBpmnBlock(child.value ?? "", child.lang, {
				...options,
				...(title ? { title } : {}),
			})
			if (!result.ok) file?.message(`BPMN block not rendered: ${result.error}`, child.position)
			children[i] = toMdast(result.html, child.position)
		} else {
			visit(child, options, file)
		}
	}
}

/**
 * An empty paragraph that mdast-util-to-hast turns into the given element: the
 * documented way for a remark plugin to emit hast.
 */
function toMdast(html: string, position: unknown): MdastNode {
	const [el] = toHast(html) as [HastElement]
	return {
		type: "paragraph",
		children: [],
		position,
		data: { hName: el.tagName, hProperties: el.properties, hChildren: el.children },
	}
}

import { decodeEntities } from "./hast.js"
import { type RenderOptions, isBpmnLang, renderBpmnBlock } from "./render.js"

/**
 * `<pre><code class="language-bpmn">…</code></pre>` — the CommonMark rendering of a
 * fenced block, which most Markdown-to-HTML tools emit.
 */
const CODE_BLOCK =
	/<pre[^>]*>\s*<code[^>]*\bclass="[^"]*\blanguage-([\w-]+)[^"]*"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g

/**
 * Replaces BPMN code blocks in an HTML string with inline SVG diagrams, for
 * pipelines that produce HTML without a remark or markdown-it stage to plug into.
 *
 * @example
 * ```ts
 * import { renderBpmnInHtml } from "@bpmnkit/markdown"
 * const page = renderBpmnInHtml(markdownToHtml(source), { theme: "auto" })
 * ```
 */
export function renderBpmnInHtml(html: string, options: RenderOptions = {}): string {
	return html.replace(CODE_BLOCK, (block, lang: string, content: string) =>
		isBpmnLang(lang) ? renderBpmnBlock(decodeEntities(content), lang, options).html : block,
	)
}

import { type RenderOptions, isBpmnLang, parseFenceInfo, renderBpmnBlock } from "./render.js"

/** The slice of a markdown-it `Token` a fence rule reads. */
export interface MarkdownItToken {
	info: string
	content: string
}

/**
 * The slice of a markdown-it instance the plugin needs. Structural, so the package
 * does not depend on markdown-it; a `MarkdownIt` instance is assignable to it.
 */
export interface MarkdownItLike {
	renderer: {
		rules: {
			// Method syntax on purpose: it keeps parameters bivariant, so markdown-it's own
			// rule type (with its full `Token`, `Options` and `Renderer`) is assignable.
			fence?(
				tokens: MarkdownItToken[],
				idx: number,
				options: unknown,
				env: unknown,
				self: MarkdownItRendererLike,
			): string
		}
	}
}

export interface MarkdownItRendererLike {
	renderToken(tokens: MarkdownItToken[], idx: number, options: unknown): string
}

/**
 * markdown-it plugin: renders ` ```bpmn `, ` ```bpmn-compact ` and ` ```bpmn-json `
 * fences as inline SVG diagrams, and leaves every other fence to the rule that was
 * there before (VitePress's code groups and highlighting keep working).
 *
 * @example
 * ```ts
 * // .vitepress/config.ts
 * import { markdownItBpmn } from "@bpmnkit/markdown"
 * export default defineConfig({ markdown: { config: (md) => md.use(markdownItBpmn) } })
 * ```
 */
export function markdownItBpmn(md: MarkdownItLike, options: RenderOptions = {}): void {
	const rules = md.renderer.rules
	const previous = rules.fence?.bind(rules)
	rules.fence = (tokens, idx, renderOptions, env, self) => {
		const token = tokens[idx]
		const { lang, attrs } = parseFenceInfo(token?.info ?? "")
		if (token && isBpmnLang(lang)) {
			return renderBpmnBlock(token.content, lang, {
				...options,
				...(attrs.title ? { title: attrs.title } : {}),
			}).html
		}
		return previous
			? previous(tokens, idx, renderOptions, env, self)
			: self.renderToken(tokens, idx, renderOptions)
	}
}

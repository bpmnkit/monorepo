/**
 * Reducing Camunda's MDX to the Markdown a chunk should carry.
 *
 * The rule this module exists to enforce: **never drop anything silently**. Camunda's own
 * `docusaurus-plugin-llms` export removes every construct it does not recognise, which is how
 * 94 BPMN diagrams vanish from the best-practice pages while the prose goes on referring to
 * them. Here an unrecognised component is an error naming the file and line, so a new upstream
 * component stops the build instead of quietly thinning the corpus.
 */

/** Raised when a document uses a construct no rule covers. The build must not continue. */
export class UnknownConstructError extends Error {
	constructor(
		readonly file: string,
		readonly line: number,
		readonly construct: string,
	) {
		super(`${file}:${line}: unhandled MDX construct <${construct}>`)
		this.name = "UnknownConstructError"
	}
}

/**
 * Components that carry meaning and are replaced by text rather than removed.
 *
 * `MarkerCamundaExtension` is the reason this map exists: it appears 25 times in the FEEL
 * reference to mark a function as Camunda's own rather than standard FEEL, and a reader who
 * loses it is told the opposite of the truth.
 */
const REPLACED: Record<string, string> = {
	MarkerCamundaExtension: "(Camunda extension)",
	MarkerStronglyConsistentExtension: "(strongly consistent)",
	MarkerEventuallyConsistentExtension: "(eventually consistent)",
	MarkerRequiredPermissions: "(requires permissions)",
	MarkerGuideline: "(guideline)",
	MarkerAddedInVersion: "(added in version)",
	GitHubInlineIcon: "",
}

/** Components that are page furniture: navigation cards, decorative icons, layout wrappers. */
const DROPPED = new Set([
	"PageDescription",
	"AoGrid",
	"ApiGrid",
	"FormViewer",
	"Versions",
	"GlossaryTerm",
	"CamundaDistributions",
	"CamundaSelfManaged",
	"HelmInstallOverviewMethods",
	"Property",
	"Highlight",
	"br",
	"hr",
	"img",
	"p",
	"span",
	"div",
	"a",
	"b",
	"i",
	"em",
	"strong",
	"code",
	"pre",
	"ul",
	"ol",
	"li",
	"table",
	"thead",
	"tbody",
	"tr",
	"td",
	"th",
	"small",
	"sup",
	"sub",
	"details",
	"summary",
	"figure",
	"figcaption",
])

/** An imported SVG component renders as an inline icon; its name is the only text in it. */
const SVG_COMPONENT = /^[A-Z][A-Za-z0-9]*Svg$/

const ADMONITION = /^:::(note|tip|info|caution|warning|important|danger|success)\s*(.*)$/
const ADMONITION_END = /^:::\s*$/
const IMPORT = /^import\s/
const EXPORT = /^export\s/

export interface StripOptions {
	/** Path reported in an error, so a failure names the upstream file a human must look at. */
	file: string
	/** Lines removed before this body, so a reported line number opens the right place. */
	lineOffset?: number
	/** Resolve `<div bpmn="…"/>` to flow text. Returning undefined drops the embed. */
	renderBpmn?: (path: string) => string | undefined
	/**
	 * Read an imported Markdown partial, relative to the importing file. Returning undefined
	 * leaves the component to the allowlist, so a missing partial fails loudly.
	 */
	readPartial?: (importPath: string) => string | undefined
	/** Guards against a partial that imports itself, directly or through another. */
	depth?: number
}

/** A partial chain deeper than this is a cycle, not a document. */
const MAX_PARTIAL_DEPTH = 4

/** `import SaasPrereqs from '../guides/react-components/\_saas-prerequisites.md'` */
const PARTIAL_IMPORT = /^import\s+(\w+)\s+from\s+["']([^"']+\.mdx?)["']/

/**
 * Strip one MDX document to Markdown.
 *
 * @throws UnknownConstructError when a component appears that no rule covers.
 */
export function stripMdx(source: string, options: StripOptions): string {
	const out: string[] = []
	let fence: string | null = null
	const partials = partialImports(source)

	const lines = source.split(/\r?\n/)
	for (const [index, raw] of lines.entries()) {
		const line = raw
		const number = index + 1 + (options.lineOffset ?? 0)

		const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
		if (fenceMatch?.[1]) {
			fence = fence === null ? (fenceMatch[1][0] ?? null) : null
			out.push(line)
			continue
		}
		if (fence !== null) {
			out.push(line)
			continue
		}

		if (IMPORT.test(line) || EXPORT.test(line)) continue

		const admonition = ADMONITION.exec(line.trim())
		if (admonition?.[1]) {
			const title = (admonition[2] ?? "").trim()
			out.push(`**${capitalize(admonition[1])}${title === "" ? "" : `: ${title}`}**`)
			continue
		}
		if (ADMONITION_END.test(line.trim())) continue

		const bpmn = /<div\s+bpmn="([^"]+)"[^>]*\/?>/.exec(line)
		if (bpmn?.[1]) {
			const rendered = options.renderBpmn?.(bpmn[1])
			if (rendered !== undefined && rendered.trim() !== "") out.push("", rendered, "")
			continue
		}

		// A partial is included by using the component the import bound it to. Its prose is the
		// page's prose — prerequisites, setup steps — so it is inlined, not dropped.
		const used = /<(\w+)\s*\/>/.exec(line.trim())
		const importPath = used?.[1] === undefined ? undefined : partials.get(used[1])
		if (importPath !== undefined) {
			const partial = options.readPartial?.(importPath)
			if (partial !== undefined) {
				out.push("", inlinePartial(partial, importPath, options), "")
				continue
			}
		}

		// `<span className="callout">1</span>` numbers a element in the diagram above. The
		// number means nothing on its own, so it becomes an ordered marker the prose after it
		// still reads correctly against.
		const calloutMatch = /<span\s+className="callout">\s*(\d+)\s*<\/span>/.exec(line)
		if (calloutMatch?.[1]) {
			out.push(`**(${calloutMatch[1]})**`)
			continue
		}

		out.push(replaceComponents(line, options.file, number))
	}

	return collapseBlankRuns(out.join("\n")).trim()
}

/**
 * Rewrite or remove every JSX tag on one line, failing on anything unrecognised.
 *
 * Inline code is left alone first: `<key>` in `run view <key>` is a placeholder a reader is
 * meant to substitute, and rewriting or refusing it would be wrong both ways.
 */
function replaceComponents(line: string, file: string, number: number): string {
	return outsideCode(line, (text) => replaceTags(text, file, number))
}

function replaceTags(text: string, file: string, number: number): string {
	return text.replace(/<\/?([A-Za-z][\w.]*)\b[^>]*>/g, (tag, rawName: string) => {
		const name = rawName.split(".")[0] ?? rawName

		const replacement = REPLACED[name]
		if (replacement !== undefined) return replacement
		if (SVG_COMPONENT.test(name)) return ""
		if (DROPPED.has(name)) return ""

		// JSX components are capitalised by the language's own rule. A lowercase name that is
		// not HTML is prose in angle brackets — `<your-token>`, `<version>` — and belongs to
		// the sentence, so it stays exactly as written.
		if (name[0] === name[0]?.toLowerCase()) return tag

		// Tabs are the one construct that must keep its labels: a tab titled "VS Code Copilot"
		// is the search term someone would actually type.
		if (name === "Tabs") return ""
		if (name === "TabItem") {
			const value = /value=\{?"([^"]+)"\}?/.exec(tag)?.[1]
			return value === undefined ? "" : `\n### ${value}\n`
		}

		throw new UnknownConstructError(file, number, name)
	})
}

/** Map every `import Name from "./partial.md"` in a document to the path it names. */
function partialImports(source: string): Map<string, string> {
	const found = new Map<string, string>()
	for (const line of source.split(/\r?\n/)) {
		const match = PARTIAL_IMPORT.exec(line.trim())
		if (!match?.[1] || !match[2]) continue
		// Docusaurus escapes the leading underscore of a partial's filename for MDX.
		found.set(match[1], match[2].replace(/\\_/g, "_"))
	}
	return found
}

/** Strip a partial with the same rules, keeping its own frontmatter out of the prose. */
function inlinePartial(source: string, path: string, options: StripOptions): string {
	const depth = (options.depth ?? 0) + 1
	if (depth > MAX_PARTIAL_DEPTH) {
		throw new Error(`${options.file}: partial imports nested more than ${MAX_PARTIAL_DEPTH} deep`)
	}
	const body = source.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
	return stripMdx(body, { ...options, file: path, lineOffset: 0, depth })
}

/** Apply `transform` to the parts of a line that are not inside an inline code span. */
function outsideCode(line: string, transform: (text: string) => string): string {
	const parts = line.split(/(`+[^`]*`+)/)
	return parts.map((part) => (part.startsWith("`") ? part : transform(part))).join("")
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1)
}

function collapseBlankRuns(text: string): string {
	return text.replace(/\n{3,}/g, "\n\n")
}

/**
 * Splitting Markdown into retrievable chunks.
 *
 * A chunk is one `##` section: the unit a reader would have scrolled to anyway.
 * Sections too large for the budget are subdivided at `###` and then at paragraph
 * boundaries; sections too small to stand alone are merged with the next one, so
 * reference tables do not become one chunk per row.
 */

import { STOP_WORDS, estimateTokens, tokenize } from "./text.js"

/** A Markdown file to be chunked, identified by its slug under the docs root. */
export interface SourceDoc {
	/** Path relative to the docs root without extension, e.g. `guides/ai-agents`. */
	slug: string
	markdown: string
}

/** A chunk before it is written: the manifest entry and the file body together. */
export interface BuiltChunk {
	id: string
	title: string
	tags: string[]
	entities: string[]
	/** Markdown written to `.llms/chunks/<id>.md`. */
	body: string
	tokens: number
}

export interface ChunkOptions {
	/** Subdivide a section above this many tokens. */
	maxTokens?: number
	/** Merge a section below this many tokens into the next one. */
	minTokens?: number
	/** Base URL used for the source link at the foot of each chunk. */
	siteUrl?: string
}

interface Section {
	heading: string
	lines: string[]
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const DIRECTIVE = /^<!--\s*docspack:\s*(tags|entities)\s*=\s*(.+?)\s*-->\s*$/

/** Split one document into chunks. */
export function chunkDocument(doc: SourceDoc, options: ChunkOptions = {}): BuiltChunk[] {
	const maxTokens = options.maxTokens ?? 800
	const minTokens = options.minTokens ?? 120

	const { attributes, body } = parseFrontMatter(doc.markdown)
	const title = attributes.title ?? titleFromSlug(doc.slug)
	const docTags = attributes.tags ?? []

	const merged = mergeSmall(splitByHeading(body, 2), minTokens)
	const chunks: BuiltChunk[] = []
	const used = new Set<string>()

	for (const section of merged) {
		for (const part of subdivide(section, maxTokens)) {
			const text = part.lines.join("\n").trim()
			if (text === "") continue

			const directives = readDirectives(part.lines)
			const chunkTitle = part.heading === "" ? title : `${title} — ${part.heading}`
			const source = options.siteUrl ? `\n\n---\nSource: ${options.siteUrl}/${doc.slug}/` : ""
			const bodyText = `# ${chunkTitle}\n\n${stripDirectives(text)}${source}\n`

			chunks.push({
				id: uniqueId(makeId(doc.slug, part.heading), used),
				title: chunkTitle,
				tags: dedupe([
					...docTags,
					...directives.tags,
					...doc.slug.split("/"),
					...headingTags(part.heading),
				]).slice(0, 12),
				entities: dedupe([...directives.entities, ...extractEntities(text)]).slice(0, 12),
				body: bodyText,
				tokens: estimateTokens(bodyText),
			})
		}
	}

	return chunks
}

/** Parse the leading YAML front matter. Only the keys a chunk needs are read. */
function parseFrontMatter(markdown: string): {
	attributes: { title?: string; tags?: string[] }
	body: string
} {
	const match = FRONT_MATTER.exec(markdown)
	if (!match?.[1]) return { attributes: {}, body: markdown }

	const attributes: { title?: string; tags?: string[] } = {}
	for (const line of match[1].split(/\r?\n/)) {
		const pair = /^(title|tags):\s*(.*)$/.exec(line)
		if (!pair?.[1]) continue
		const value = (pair[2] ?? "").trim()
		if (pair[1] === "title") attributes.title = unquote(value)
		else
			attributes.tags = value
				.replace(/^\[|\]$/g, "")
				.split(",")
				.map(unquote)
				.filter(Boolean)
	}
	return { attributes, body: markdown.slice(match[0].length) }
}

function unquote(value: string): string {
	return value
		.trim()
		.replace(/^["']|["']$/g, "")
		.trim()
}

/**
 * Split on ATX headings of exactly `level`, ignoring anything inside a fenced
 * code block — a `## comment` in a shell sample is not a section.
 */
function splitByHeading(body: string, level: number): Section[] {
	const marker = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`)
	const sections: Section[] = [{ heading: "", lines: [] }]
	let fence: string | null = null

	for (const line of body.split(/\r?\n/)) {
		const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
		if (fenceMatch?.[1]) {
			if (fence === null) fence = fenceMatch[1][0] ?? null
			else if (line.trimStart().startsWith(fence)) fence = null
		}

		const heading = fence === null ? marker.exec(line) : null
		if (heading?.[1]) sections.push({ heading: heading[1], lines: [] })
		else sections[sections.length - 1]?.lines.push(line)
	}

	return sections.filter((s) => s.heading !== "" || s.lines.join("").trim() !== "")
}

/** Merge each section that is too short to answer anything into the one after it. */
function mergeSmall(sections: Section[], minTokens: number): Section[] {
	const out: Section[] = []
	for (const section of sections) {
		const previous = out[out.length - 1]
		if (previous && estimateTokens(previous.lines.join("\n")) < minTokens) {
			previous.lines.push(
				"",
				section.heading === "" ? "" : `## ${section.heading}`,
				...section.lines,
			)
			continue
		}
		out.push({ heading: section.heading, lines: [...section.lines] })
	}
	return out
}

/** Break an oversized section at `###`, then at paragraph boundaries. */
function subdivide(section: Section, maxTokens: number): Section[] {
	if (estimateTokens(section.lines.join("\n")) <= maxTokens) return [section]

	const parts: Section[] = []
	for (const sub of splitByHeading(section.lines.join("\n"), 3)) {
		const heading = sub.heading === "" ? section.heading : `${section.heading} — ${sub.heading}`
		parts.push(...byParagraph({ heading, lines: sub.lines }, maxTokens))
	}
	return parts.length > 0 ? parts : [section]
}

/** Last resort: pack whole paragraphs until the budget is spent, never mid-fence. */
function byParagraph(section: Section, maxTokens: number): Section[] {
	if (estimateTokens(section.lines.join("\n")) <= maxTokens) return [section]

	const parts: Section[] = []
	let current: string[] = []
	let fence: string | null = null

	const flush = () => {
		if (current.join("").trim() === "") return
		const suffix = parts.length === 0 ? "" : ` (${parts.length + 1})`
		parts.push({ heading: `${section.heading}${suffix}`, lines: current })
		current = []
	}

	for (const line of section.lines) {
		const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
		if (fenceMatch?.[1]) {
			if (fence === null) fence = fenceMatch[1][0] ?? null
			else if (line.trimStart().startsWith(fence)) fence = null
		}
		if (fence === null && line.trim() === "" && estimateTokens(current.join("\n")) >= maxTokens) {
			flush()
			continue
		}
		current.push(line)
	}
	flush()

	return parts
}

function readDirectives(lines: string[]): { tags: string[]; entities: string[] } {
	const tags: string[] = []
	const entities: string[] = []
	for (const line of lines) {
		const match = DIRECTIVE.exec(line.trim())
		if (!match?.[2]) continue
		const values = match[2]
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean)
		if (match[1] === "tags") tags.push(...values)
		else entities.push(...values)
	}
	return { tags, entities }
}

function stripDirectives(text: string): string {
	return text
		.split(/\r?\n/)
		.filter((line) => !DIRECTIVE.test(line.trim()))
		.join("\n")
		.trim()
}

/** Heading words carry the topic; function words carry nothing worth weighting 3x. */
function headingTags(heading: string): string[] {
	return tokenize(heading).filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

/**
 * Identifiers named in inline code. A bare word in backticks is usually a value,
 * not an API, so only qualified, called or camel-cased names are kept.
 */
function extractEntities(text: string): string[] {
	const found: string[] = []
	for (const match of text.matchAll(/`([^`\n]{2,60})`/g)) {
		const value = (match[1] ?? "").trim()
		if (!/^@?[A-Za-z][\w./-]*(\(\))?$/.test(value)) continue
		if (!/[./]/.test(value) && !value.endsWith("()") && !/[a-z][A-Z]/.test(value)) continue
		found.push(value)
	}
	return found
}

function makeId(slug: string, heading: string): string {
	const base = slugify(slug.replace(/\//g, "."))
	const section = slugify(heading)
	return section === "" ? base : `${base}.${section}`
}

/** Reduce to the manifest's `^[A-Za-z0-9][A-Za-z0-9._-]*$`. */
function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^[^a-z0-9]+|[-._]+$/g, "")
}

/**
 * Make `id` unique against `used`, recording it. Ids are unique within a document
 * by construction, but two documents can still land on the same one — a page
 * `cli/casen` and a `## casen` section of a page `cli` both want `cli.casen`.
 */
export function uniqueId(id: string, used: Set<string>): string {
	const base = id === "" ? "chunk" : id
	let candidate = base
	for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`
	used.add(candidate)
	return candidate
}

function titleFromSlug(slug: string): string {
	const last = slug.split("/").pop() ?? slug
	return last.replace(/[-_]+/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function dedupe(values: string[]): string[] {
	const seen = new Set<string>()
	const out: string[] = []
	for (const value of values) {
		const key = value.toLowerCase()
		if (value === "" || seen.has(key)) continue
		seen.add(key)
		out.push(value)
	}
	return out
}

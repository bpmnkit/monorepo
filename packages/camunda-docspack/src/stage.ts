/**
 * Staging camunda-docs into the Markdown tree `@bpmnkit/docspack` builds from.
 *
 * Every file is written at the path it is published under, so the `siteUrl` link the chunker
 * appends to each chunk resolves to the real page. The transforms run in a fixed order and
 * are pure functions of the checkout: the same upstream commit stages byte-identically, which
 * is what lets the weekly build assert reproducibility instead of hoping for it.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { bpmnToText } from "./bpmn-text.js"
import { SITE_URL, absoluteLinks } from "./links.js"
import { stripMdx } from "./mdx.js"
import { readOperations } from "./openapi.js"

/**
 * The directories of `docs/` this package covers, relative to the camunda-docs checkout.
 *
 * An explicit list rather than a glob: a directory Camunda adds upstream should be a decision
 * somebody makes, not a corpus that silently grows between two weekly builds.
 */
export const INCLUDED = [
	"docs/components/best-practices",
	"docs/components/modeler/bpmn",
	"docs/components/modeler/feel",
	"docs/components/concepts",
	"docs/apis-tools/orchestration-cluster-api-rest",
] as const

/** Generated API reference: a base64 blob wrapped in React imports, with no prose in it. */
const EXCLUDED = /\/specifications\//

/** The Orchestration Cluster API specification, which those generated pages are rendered from. */
const API_SPEC = "api/camunda/v2/camunda-openapi.yaml"

/**
 * Where an operation's digest is staged.
 *
 * Deliberately the path of the page Camunda publishes for that operation, so the `Source:` link
 * on the chunk opens the real reference page. All 227 slugs match a published page.
 */
const API_PAGES = "apis-tools/orchestration-cluster-api-rest/specifications"

export interface StageOptions {
	/** Root of a camunda-docs checkout. */
	source: string
	/** Directory the staged Markdown is written to. Replaced, not merged. */
	out: string
}

export interface StageResult {
	documents: number
	/** Diagrams resolved and rendered into the prose. */
	diagrams: number
	/** Imported Markdown partials inlined into their including page. */
	partials: number
	/** API operations digested from the specification. */
	operations: number
	/** `<div bpmn>` embeds whose file was missing from `static/bpmn/`. */
	missingDiagrams: string[]
	/**
	 * Rewritten links pointing at a page that does not exist upstream, as `<page> -> <target>`.
	 *
	 * These are Camunda's own broken links — a missing leading slash, one `../` too few — and
	 * this package cannot fix them. Reporting the count is still worth it: it is a handful
	 * today, so a jump means a transform regressed rather than an author slipped.
	 */
	unresolvedLinks: string[]
}

export function stage(options: StageOptions): StageResult {
	const source = resolve(options.source)
	const out = resolve(options.out)
	rmSync(out, { recursive: true, force: true })

	let diagrams = 0
	let partials = 0
	const missingDiagrams: string[] = []
	let documents = 0
	const unresolvedLinks: string[] = []
	let operations = 0
	// Every page in `docs/`, not just the included ones: a chunk may legitimately link out to
	// `self-managed/` or `guides/`, and only a target missing from the whole tree is broken.
	// The generated API reference is excluded from staging but is still published, so it is a
	// valid link target; the set has to be the whole tree, unfiltered.
	const pages = new Set(publishedPages(join(source, "docs")).map((path) => docSlug(source, path)))

	for (const file of sources(source)) {
		const slug = docSlug(source, file)
		const raw = readFileSync(file, "utf8")
		const { attributes, body, lineOffset } = splitFrontMatter(raw)

		const stripped = stripMdx(body, {
			file: relative(source, file),
			lineOffset,
			renderBpmn: (path) => {
				const diagram = join(source, "static", "bpmn", path)
				if (!existsSync(diagram)) {
					missingDiagrams.push(path)
					return undefined
				}
				diagrams += 1
				return bpmnToText(readFileSync(diagram, "utf8"))
			},
			readPartial: (importPath) => {
				const partial = resolve(dirname(file), importPath)
				if (!existsSync(partial)) return undefined
				partials += 1
				return readFileSync(partial, "utf8")
			},
		})

		const text = absoluteLinks(stripped, slug)
		for (const target of unresolved(text, pages)) unresolvedLinks.push(`${slug} -> ${target}`)
		const target = join(out, `${slug}.md`)
		mkdirSync(dirname(target), { recursive: true })
		writeFileSync(target, document(attributes, text))
		documents += 1
	}

	for (const operation of readOperations(join(source, API_SPEC))) {
		const target = join(out, API_PAGES, `${operation.slug}.api.md`)
		mkdirSync(dirname(target), { recursive: true })
		const directive = `<!-- docspack: entities=${operation.entities.join(", ")} -->`
		writeFileSync(
			target,
			document(
				{ title: operation.summary, keywords: operation.tags },
				`${directive}\n\n${operation.digest}`,
			),
		)
		operations += 1
		documents += 1
	}

	return { documents, diagrams, partials, operations, missingDiagrams, unresolvedLinks }
}

/** A document's path under `docs/` without its extension, which is also its published URL. */
function docSlug(source: string, file: string): string {
	return relative(join(source, "docs"), file).replace(/\.mdx?$/, "")
}

/** Links this build rewrote that name a page outside the corpus and outside `docs/`. */
function unresolved(text: string, pages: ReadonlySet<string>): string[] {
	const out: string[] = []
	for (const match of text.matchAll(/\]\((https:\/\/docs\.camunda\.io\/docs\/next\/[^)\s]+)/g)) {
		const target = (match[1] ?? "").slice(`${SITE_URL}/`.length).split("#")[0]?.replace(/\/$/, "")
		if (target === undefined || target === "") continue
		if (!pages.has(target)) out.push(target)
	}
	return out
}

/**
 * Assemble the staged file.
 *
 * `description` is the reason this is not a straight copy. Camunda writes one on nearly every
 * page, phrased the way a person would ask the question, and neither the docspack chunker nor
 * Camunda's own export reads it. Promoting it to the first paragraph puts the best retrieval
 * signal in the repository into the indexed text.
 */
function document(attributes: FrontMatter, body: string): string {
	const front = ["---", `title: ${JSON.stringify(attributes.title ?? "")}`]
	if (attributes.keywords.length > 0) {
		front.push(`tags: [${attributes.keywords.map((k) => JSON.stringify(k)).join(", ")}]`)
	}
	front.push("---", "")

	const lead = attributes.description === undefined ? [] : [attributes.description, ""]
	return `${front.join("\n")}\n${[...lead, body].join("\n")}\n`
}

interface FrontMatter {
	title?: string
	description?: string
	keywords: string[]
}

const FRONT_MATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * Read the three keys that matter. Deliberately not a YAML parser: anything structured enough
 * to need one is not metadata a retrieval index can use.
 */
function splitFrontMatter(raw: string): {
	attributes: FrontMatter
	body: string
	lineOffset: number
} {
	const match = FRONT_MATTER.exec(raw)
	const attributes: FrontMatter = { keywords: [] }
	if (!match?.[1]) return { attributes, body: raw, lineOffset: 0 }

	for (const line of match[1].split(/\r?\n/)) {
		const pair = /^(title|description|keywords):\s*(.*)$/.exec(line)
		if (!pair?.[1]) continue
		const value = (pair[2] ?? "").trim()
		if (pair[1] === "title") attributes.title = unquote(value)
		else if (pair[1] === "description") attributes.description = unquote(value)
		else if (value.startsWith("[")) {
			attributes.keywords = value
				.replace(/^\[|\]$/g, "")
				.split(",")
				.map(unquote)
				.filter((entry) => entry !== "")
		}
	}
	const lineOffset = match[0].split("\n").length - 1
	return { attributes, body: raw.slice(match[0].length), lineOffset }
}

function unquote(value: string): string {
	return value
		.trim()
		.replace(/^["']|["']$/g, "")
		.trim()
}

/** Every included Markdown document, in a stable order so the build is reproducible. */
function sources(root: string): string[] {
	const out: string[] = []
	for (const included of INCLUDED) {
		const dir = join(root, included)
		if (!existsSync(dir)) throw new Error(`${dir}: not found in the camunda-docs checkout`)
		walk(dir, out)
	}
	return out.sort()
}

/** Every document Docusaurus publishes, staged or not — the set a link may legitimately name. */
function publishedPages(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir).sort()) {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) publishedPages(path, out)
		else if (/\.mdx?$/.test(name) && !name.startsWith("_")) out.push(path)
	}
	return out
}

function walk(dir: string, out: string[]): void {
	for (const name of readdirSync(dir).sort()) {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) {
			walk(path, out)
			continue
		}
		if (!/\.mdx?$/.test(name)) continue
		if (name.startsWith("_")) continue
		if (EXCLUDED.test(path)) continue
		out.push(path)
	}
}

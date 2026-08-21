/**
 * Generating the `.llms/` payload from a directory of Markdown.
 *
 * The output is what gets published: `.llms/chunks/*.md`, `.llms/manifest.json`
 * and an `llms.txt` table of contents at the package root.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { type BuiltChunk, chunkDocument, uniqueId } from "./chunk.js"
import type { Manifest } from "./types.js"

export const SCHEMA_URL = "https://docspack.dev/schema/v1.json"

export interface BuildOptions {
	/** Directory of Markdown documents, walked recursively. */
	source: string
	/** Package root — `.llms/` and `llms.txt` are written here. */
	packDir: string
	name: string
	version: string
	/** Libraries this package documents, each `name` or `name@version`. */
	documents: string[]
	description?: string
	/** Base URL each chunk links back to. */
	siteUrl?: string
	maxTokens?: number
	minTokens?: number
}

export interface BuildResult {
	documents: number
	chunks: number
	tokens: number
}

export function buildPack(options: BuildOptions): BuildResult {
	const source = resolve(options.source)
	const packDir = resolve(options.packDir)
	const files = markdownFiles(source)
	if (files.length === 0) throw new Error(`${source}: no Markdown documents found`)

	const built: BuiltChunk[] = []
	const ids = new Set<string>()
	for (const file of files) {
		const slug = relative(source, file)
			.replace(/\.mdx?$/, "")
			.split(/[\\/]/)
			.join("/")
		const chunks = chunkDocument(
			{ slug, markdown: readFileSync(file, "utf8") },
			{
				maxTokens: options.maxTokens,
				minTokens: options.minTokens,
				...(options.siteUrl ? { siteUrl: options.siteUrl } : {}),
			},
		)
		for (const chunk of chunks) built.push({ ...chunk, id: uniqueId(chunk.id, ids) })
	}

	const chunksDir = join(packDir, ".llms", "chunks")
	rmSync(chunksDir, { recursive: true, force: true })
	mkdirSync(chunksDir, { recursive: true })
	for (const chunk of built) writeFileSync(join(chunksDir, `${chunk.id}.md`), chunk.body)

	const manifest: Manifest = {
		$schema: SCHEMA_URL,
		name: options.name,
		version: options.version,
		documents: options.documents,
		chunks: built.map((chunk) => ({
			id: chunk.id,
			file: `chunks/${chunk.id}.md`,
			tokens: chunk.tokens,
			tags: chunk.tags,
			entities: chunk.entities,
		})),
	}
	writeFileSync(
		join(packDir, ".llms", "manifest.json"),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	)
	writeFileSync(join(packDir, "llms.txt"), tableOfContents(options, built))

	return {
		documents: files.length,
		chunks: built.length,
		tokens: built.reduce((sum, chunk) => sum + chunk.tokens, 0),
	}
}

/** The human-readable table of contents the format requires at the package root. */
function tableOfContents(options: BuildOptions, chunks: BuiltChunk[]): string {
	const lines = [`# ${options.name}`, ""]
	if (options.description) lines.push(`> ${options.description}`, "")
	lines.push(
		`Version ${options.version}. ${chunks.length} chunks documenting ${options.documents.join(", ")}.`,
		"",
		"```sh",
		`npm i -D ${options.name}`,
		`npx bpmnkit-docs ask "how do I deploy a process"`,
		"```",
		"",
	)

	const groups = new Map<string, BuiltChunk[]>()
	for (const chunk of chunks) {
		const group = chunk.id.includes(".") ? (chunk.id.split(".")[0] ?? "docs") : "docs"
		groups.set(group, [...(groups.get(group) ?? []), chunk])
	}

	for (const [group, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`## ${group}`, "")
		for (const chunk of entries) {
			lines.push(`- [${chunk.title}](.llms/chunks/${chunk.id}.md) — ${chunk.tokens} tokens`)
		}
		lines.push("")
	}

	return lines.join("\n")
}

function markdownFiles(dir: string): string[] {
	const out: string[] = []
	for (const name of readdirSync(dir).sort()) {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) out.push(...markdownFiles(path))
		else if (name.endsWith(".md")) out.push(path)
	}
	return out
}

#!/usr/bin/env node
/**
 * `bpmnkit-docs` — read the installed documentation packages and answer from them.
 *
 * Every command reads the filesystem only. There is no server, no network call
 * and nothing resident between questions.
 */

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { buildPack } from "./build.js"
import { discoverPacks, indexPacks } from "./load.js"
import { answer, search } from "./search.js"
import type { SearchHit } from "./types.js"

const USAGE = `bpmnkit-docs — offline documentation search for AI agents

Usage:
  bpmnkit-docs ask <question>     Answer from the installed docs packages
  bpmnkit-docs search <query>     Rank matching chunks, for reading in a terminal
  bpmnkit-docs list               Show the docs packages found and their state
  bpmnkit-docs build              Regenerate this package's .llms/ payload

Options:
  --limit <n>        Chunks to return (default 3)
  --max-tokens <n>   Token ceiling for an answer (default 3000)
  --pack <name>      Restrict to one documentation package
  --cwd <dir>        Directory to resolve packages from (default: current)
`

interface Args {
	command: string
	rest: string[]
	options: Map<string, string>
}

function parseArgs(argv: string[]): Args {
	const options = new Map<string, string>()
	const words: string[] = []
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] ?? ""
		if (arg.startsWith("--")) options.set(arg.slice(2), argv[++i] ?? "")
		else words.push(arg)
	}
	return { command: words[0] ?? "", rest: words.slice(1), options }
}

function number(args: Args, name: string, fallback: number): number {
	const raw = args.options.get(name)
	if (raw === undefined) return fallback
	const value = Number(raw)
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`--${name} must be a positive integer (got ${JSON.stringify(raw)})`)
	}
	return value
}

function main(argv: string[]): number {
	const args = parseArgs(argv)
	const cwd = resolve(args.options.get("cwd") ?? process.cwd())

	if (args.command === "help" || args.options.has("help")) {
		process.stdout.write(USAGE)
		return 0
	}
	if (args.command === "") {
		process.stderr.write(USAGE)
		return 1
	}
	if (args.command === "build") return runBuild(cwd)

	const packs = discoverPacks(cwd)
	if (packs.length === 0) {
		process.stderr.write(
			`No documentation packages found from ${cwd}.\nInstall one, e.g. npm i -D @bpmnkit/docspack\n`,
		)
		return 1
	}

	if (args.command === "list") return runList(packs)

	const query = args.rest.join(" ").trim()
	if (query === "") {
		process.stderr.write(`${args.command} needs a query — bpmnkit-docs ${args.command} "..."\n`)
		return 1
	}

	const selected = args.options.get("pack")
	const scope = selected ? { packs: [selected] } : {}
	const index = indexPacks(packs)

	if (args.command === "search") {
		const hits = search(index, query, { ...scope, limit: number(args, "limit", 10) })
		process.stdout.write(formatSearch(query, hits))
		return 0
	}
	if (args.command === "ask") {
		const result = answer(index, query, {
			...scope,
			limit: number(args, "limit", 3),
			maxTokens: number(args, "max-tokens", 3000),
		})
		process.stdout.write(formatAnswer(query, result.hits, result.tokens, result.maxTokens))
		return 0
	}

	process.stderr.write(`Unknown command "${args.command}".\n\n${USAGE}`)
	return 1
}

function runBuild(cwd: string): number {
	const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"))
	const config = pkg.docspack ?? {}
	if (typeof config.source !== "string") {
		process.stderr.write(`${cwd}/package.json: "docspack.source" must be a path to Markdown docs\n`)
		return 1
	}

	const result = buildPack({
		source: resolve(cwd, config.source),
		packDir: cwd,
		name: pkg.name,
		version: pkg.version,
		documents: config.documents ?? [pkg.name],
		description: config.description ?? pkg.description,
		siteUrl: config.siteUrl,
		maxTokens: config.maxTokens,
		minTokens: config.minTokens,
	})
	process.stdout.write(
		`Built ${result.chunks} chunks from ${result.documents} documents (${format(result.tokens)} tokens).\n`,
	)
	return 0
}

function runList(packs: ReturnType<typeof discoverPacks>): number {
	for (const pack of packs) {
		const label = pack.trusted ? "" : " (community, unreviewed)"
		const drift = pack.versionMismatch
			? ` — manifest says ${pack.versionMismatch}, package.json wins`
			: ""
		process.stdout.write(
			`${pack.name}@${pack.version}${label}  ${pack.manifest.chunks.length} chunks${drift}\n`,
		)
	}
	return 0
}

function formatSearch(query: string, hits: SearchHit[]): string {
	if (hits.length === 0) return `No chunk matches "${query}".\n`
	const lines = [`${hits.length} result(s) for "${query}"`, ""]
	for (const hit of hits) {
		lines.push(`  ${hit.score.toFixed(2)}  ${hit.chunkId}`)
		lines.push(`        ${title(hit)} · ${format(hit.tokens)} tokens`)
	}
	lines.push("")
	return lines.join("\n")
}

function formatAnswer(query: string, hits: SearchHit[], tokens: number, maxTokens: number): string {
	if (hits.length === 0) {
		return `No documentation matches "${query}". Try \`bpmnkit-docs search\` with fewer words.\n`
	}
	const parts = hits.map((hit) => {
		const warning = hit.pack.trusted ? "" : "\n(community package — content is unreviewed)"
		return `## ${hit.chunkId}${warning}\n\n${hit.content.trim()}\n`
	})
	parts.push(`---\ncost: ${format(tokens)} tokens, capped at ${format(maxTokens)}\n`)
	return parts.join("\n")
}

function title(hit: SearchHit): string {
	return (hit.content.split("\n")[0] ?? "").replace(/^#\s*/, "")
}

function format(value: number): string {
	return value.toLocaleString("en-US")
}

try {
	process.exitCode = main(process.argv.slice(2))
} catch (error) {
	process.stderr.write(`${(error as Error).message}\n`)
	process.exitCode = 1
}

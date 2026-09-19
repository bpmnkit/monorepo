/**
 * The whole build: stage camunda-docs, then hand the result to `@bpmnkit/docspack`.
 *
 * Chunking, manifest and `llms.txt` are all the docspack package's job — this adds only what
 * it cannot know, which is how to turn Camunda's MDX into Markdown worth indexing.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { buildPack } from "@bpmnkit/docspack"
import { notice } from "./notice.js"
import { type StageResult, stage } from "./stage.js"

export interface BuildOptions {
	/** Root of a camunda-docs checkout. */
	camundaDocs: string
	/** This package's root — `.llms/`, `llms.txt` and `NOTICE` are written here. */
	packDir: string
	/** Upstream commit the checkout is at, recorded in the NOTICE for attribution. */
	commit: string
}

export interface BuildReport extends StageResult {
	chunks: number
	tokens: number
}

interface PackageConfig {
	name: string
	version: string
	description?: string
	docspack?: {
		source?: string
		siteUrl?: string
		maxTokens?: number
		minTokens?: number
		documents?: string[]
	}
}

export function build(options: BuildOptions): BuildReport {
	const packDir = resolve(options.packDir)
	const manifest = JSON.parse(readFileSync(join(packDir, "package.json"), "utf8")) as PackageConfig
	const config = manifest.docspack ?? {}

	const staging = resolve(packDir, config.source ?? "./build/staging")
	const staged = stage({ source: options.camundaDocs, out: staging })

	const result = buildPack({
		source: staging,
		packDir,
		name: manifest.name,
		version: manifest.version,
		documents: config.documents ?? [manifest.name],
		...(manifest.description ? { description: manifest.description } : {}),
		...(config.siteUrl ? { siteUrl: config.siteUrl } : {}),
		...(config.maxTokens === undefined ? {} : { maxTokens: config.maxTokens }),
		...(config.minTokens === undefined ? {} : { minTokens: config.minTokens }),
	})

	// Written by the build rather than kept by hand: CC BY-SA 3.0 obliges this package to say
	// which upstream revision it adapted and what it changed, and a hand-maintained notice
	// would state last month's commit.
	writeFileSync(join(packDir, "NOTICE"), notice(options.commit))

	return { ...staged, chunks: result.chunks, tokens: result.tokens }
}

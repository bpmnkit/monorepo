/**
 * AI example — index your own corpus
 *
 * You have five Markdown files describing a flow. An agent handed the folder
 * either reads the wrong file or burns its context on all of them. Indexing
 * them as a docspack pack turns the folder into something it can ask questions
 * of, bounded to the passages that answer each one.
 *
 * `buildPack` is the same function behind `bpmnkit-docs build`, so the pack
 * this writes is an ordinary docspack package: `bpmnkit-docs ask --cwd
 * output/flow-corpus "..."` reads it, and so does any other docspack reader.
 *
 * Indexing runs no model and makes no network call, so it costs no tokens.
 *
 * Run: pnpm --filter @bpmnkit/examples ai:index
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { answer, buildPack, indexPacks, loadPack } from "@bpmnkit/docspack"
import { writeFlowDocs } from "./flow-docs.js"

const SOURCE = join("output", "flow-docs")
const PACK = join("output", "flow-corpus")

// A name outside the `@docspack-community` scope keeps answers unlabelled; a
// pack you built from your own files is not third-party content.
const NAME = "order-fulfilment-corpus"

const files = writeFlowDocs(SOURCE)
console.log(`Wrote ${files} Markdown files to ${SOURCE}/`)

// `loadPack` reads the version from package.json, not from the manifest, so the
// pack needs one even when it is never published.
mkdirSync(PACK, { recursive: true })
writeFileSync(
	join(PACK, "package.json"),
	`${JSON.stringify({ name: NAME, version: "1.0.0", private: true }, null, "\t")}\n`,
)

const started = performance.now()
const result = buildPack({
	source: SOURCE,
	packDir: PACK,
	name: NAME,
	version: "1.0.0",
	documents: [NAME],
	// Small sections merge into the one before them, so a two-line heading does
	// not become a chunk that can answer nothing.
	minTokens: 60,
	maxTokens: 800,
})
const ms = Math.round(performance.now() - started)

console.log(
	`Indexed ${result.documents} documents into ${result.chunks} chunks (${result.tokens} tokens) in ${ms}ms`,
)

const index = indexPacks([loadPack(PACK)])

for (const question of [
	"when does an order need manager approval",
	"what runs in parallel with picking and packing",
	"what happens if the carrier refuses the booking",
	"is anything sent to the warehouse",
]) {
	const { hits, tokens } = answer(index, question, { limit: 1, maxTokens: 800 })
	const [top] = hits
	console.log(`\n? ${question}`)
	console.log(`  ${top?.chunkId ?? "no match"} · ${tokens} tokens`)
	if (top) console.log(indent(top.content.trim()))
}

console.log(`\nAsk it yourself:  npx bpmnkit-docs ask "..." --cwd ${PACK}`)

function indent(text: string): string {
	return text
		.split("\n")
		.map((line) => `    ${line}`)
		.join("\n")
}

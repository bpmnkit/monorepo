/**
 * AI example — ask the two documentation packs
 *
 * BPMN Kit ships its documentation as docspack packages an agent can search
 * without a network call, a server or a model:
 *
 *   @bpmnkit/docspack          BPMN Kit's own APIs, CLI and guides
 *   @bpmnkit/camunda-docspack  the Camunda 8 documentation — BPMN, FEEL, the
 *                              engine and the Orchestration Cluster API
 *
 * Both are read by the same CLI (`npx bpmnkit-docs ask "..."`) and the same
 * library, shown here. Retrieval is BM25 over chunks on disk: no tokens spent,
 * and the whole script runs in well under a second.
 *
 * Run: pnpm --filter @bpmnkit/examples ai:ask
 */

import { answer, discoverPacks, indexPacks } from "@bpmnkit/docspack"

const BPMNKIT = "@bpmnkit/docspack"
const CAMUNDA = "@bpmnkit/camunda-docspack"

const packs = discoverPacks()
if (packs.length === 0) {
	throw new Error("No documentation packs found. Run `pnpm install` from the repo root.")
}

console.log("Packs found:")
for (const pack of packs) {
	console.log(`  ${pack.name}@${pack.version} — ${pack.manifest.chunks.length} chunks`)
}

// Indexing reads every chunk off disk, and it is the only expensive step. A
// `bpmnkit-docs ask` pays it per question; a long-lived agent pays it once.
const started = performance.now()
const index = indexPacks(packs)
console.log(`\nIndexed in ${Math.round(performance.now() - started)}ms\n`)

const questions = [
	// Ours: how to drive the library.
	{ pack: BPMNKIT, question: "what does compactify drop from a diagram" },
	{ pack: BPMNKIT, question: "how do I deploy a process to Camunda 8" },
	// Camunda's: how the engine behaves. A different pack because it is a
	// different question — asking ours about gateway semantics gets you our
	// wrapper, not the engine's rules.
	{ pack: CAMUNDA, question: "what happens when no exclusive gateway condition is true" },
	{ pack: CAMUNDA, question: "FEEL string concatenation" },
]

const installed = new Set(packs.map((pack) => pack.name))
for (const { pack, question } of questions) {
	if (!installed.has(pack)) {
		// `answer` throws on a pack that was never indexed rather than returning
		// nothing, because an empty result reads as "the docs do not cover this".
		console.log(`? ${question}\n  skipped — ${pack} is not installed\n`)
		continue
	}
	const { hits, tokens } = answer(index, question, { packs: [pack], limit: 1, maxTokens: 1200 })
	const [top] = hits
	console.log(`? ${question}`)
	console.log(`  ${top?.chunkId ?? "no match"} · ${tokens} tokens`)
	console.log(`  ${firstSentence(top?.content ?? "")}\n`)
}

function firstSentence(content: string): string {
	const prose = content
		.split("\n")
		.filter((line) => line.trim() !== "" && !line.startsWith("#"))
		.join(" ")
	return `${prose.slice(0, 160).trim()}…`
}

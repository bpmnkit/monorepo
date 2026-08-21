/**
 * The retrieval side: a BM25 index over chunk text, with tags and entities
 * weighted above prose. Built in memory from the manifests — the corpus is a
 * project's own documentation, not the whole registry, so there is nothing to
 * persist and no database to keep in step.
 */

import { terms } from "./text.js"
import type { ManifestChunk, Pack, SearchHit } from "./types.js"

/** BM25 saturation and length-normalisation, at their conventional values. */
const K1 = 1.2
const B = 0.75

/** A tag is a deliberate index term; a word in a paragraph is incidental. */
const TAG_WEIGHT = 3
const ENTITY_WEIGHT = 3

interface IndexedChunk {
	chunkId: string
	pack: Pack
	chunk: ManifestChunk
	tokens: number
	content: string
	frequencies: Map<string, number>
	length: number
}

export interface DocsIndex {
	chunks: IndexedChunk[]
	documentFrequency: Map<string, number>
	averageLength: number
}

/** One chunk's content, paired with the pack it came from. */
export interface IndexInput {
	pack: Pack
	chunk: ManifestChunk
	content: string
	tokens: number
}

export function buildIndex(inputs: IndexInput[]): DocsIndex {
	const chunks: IndexedChunk[] = []
	const documentFrequency = new Map<string, number>()

	for (const input of inputs) {
		const frequencies = new Map<string, number>()
		const add = (values: readonly string[], weight: number) => {
			for (const term of values) frequencies.set(term, (frequencies.get(term) ?? 0) + weight)
		}
		const contentTerms = terms(input.content)
		add(contentTerms, 1)
		add(terms((input.chunk.tags ?? []).join(" ")), TAG_WEIGHT)
		add(terms((input.chunk.entities ?? []).join(" ")), ENTITY_WEIGHT)

		for (const term of frequencies.keys()) {
			documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
		}

		chunks.push({
			chunkId: `${input.pack.name}@${input.pack.version}/${input.chunk.id}`,
			pack: input.pack,
			chunk: input.chunk,
			tokens: input.tokens,
			content: input.content,
			frequencies,
			length: contentTerms.length,
		})
	}

	const total = chunks.reduce((sum, c) => sum + c.length, 0)
	return {
		chunks,
		documentFrequency,
		averageLength: chunks.length === 0 ? 1 : Math.max(1, total / chunks.length),
	}
}

export interface SearchOptions {
	/** Maximum hits to return. */
	limit?: number
	/** Restrict to these package names — a project asks only about what it installed. */
	packs?: readonly string[]
}

/** Rank every chunk that shares a term with the query. Ties break on chunk id. */
export function search(index: DocsIndex, query: string, options: SearchOptions = {}): SearchHit[] {
	const limit = options.limit ?? 3
	const queryTerms = terms(query)
	if (queryTerms.length === 0) return []

	const allowed = options.packs ? new Set(options.packs) : null
	const total = index.chunks.length
	const hits: SearchHit[] = []

	for (const candidate of index.chunks) {
		if (allowed && !allowed.has(candidate.pack.name)) continue

		let score = 0
		for (const term of new Set(queryTerms)) {
			const frequency = candidate.frequencies.get(term)
			if (!frequency) continue
			const documents = index.documentFrequency.get(term) ?? 0
			const idf = Math.log(1 + (total - documents + 0.5) / (documents + 0.5))
			const norm = K1 * (1 - B + (B * candidate.length) / index.averageLength)
			score += idf * ((frequency * (K1 + 1)) / (frequency + norm))
		}
		if (score <= 0) continue

		hits.push({
			chunkId: candidate.chunkId,
			pack: candidate.pack,
			chunk: candidate.chunk,
			tokens: candidate.tokens,
			content: candidate.content,
			score,
		})
	}

	hits.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
	return hits.slice(0, limit)
}

export interface AnswerOptions extends SearchOptions {
	/** Hard ceiling on the tokens an answer may spend, counted before content. */
	maxTokens?: number
}

/**
 * The hits an agent gets back: the top matches that fit the token budget.
 * The budget is spent from the manifest counts, so a chunk that would overrun
 * it is dropped rather than truncated mid-sentence.
 */
export function answer(index: DocsIndex, query: string, options: AnswerOptions = {}) {
	const maxTokens = options.maxTokens ?? 3000
	const limit = options.limit ?? 3
	const ranked = search(index, query, { ...options, limit: Math.max(limit * 4, limit) })

	const selected: SearchHit[] = []
	let spent = 0
	for (const hit of ranked) {
		if (selected.length >= limit) break
		if (spent + hit.tokens > maxTokens) continue
		selected.push(hit)
		spent += hit.tokens
	}
	return { hits: selected, tokens: spent, maxTokens }
}

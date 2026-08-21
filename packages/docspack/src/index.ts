/**
 * `@bpmnkit/docspack` — BPMN Kit's documentation as a docspack package, plus the
 * offline index an agent searches it with.
 *
 * @see https://docspack.dev/spec for the package format.
 */

export { type BuildOptions, type BuildResult, SCHEMA_URL, buildPack } from "./build.js"
export {
	type BuiltChunk,
	type ChunkOptions,
	type SourceDoc,
	chunkDocument,
	uniqueId,
} from "./chunk.js"
export { chunkPath, discoverPacks, indexPacks, loadPack, readChunk } from "./load.js"
export {
	type AnswerOptions,
	type DocsIndex,
	type IndexInput,
	type SearchOptions,
	answer,
	buildIndex,
	search,
} from "./search.js"
export { estimateTokens, stem, terms, tokenize } from "./text.js"
export type { Manifest, ManifestChunk, Pack, SearchHit } from "./types.js"

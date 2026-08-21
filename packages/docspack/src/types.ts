/** The docspack package format, version 1: https://docspack.dev/spec */

/** One retrievable unit of documentation, as described in `.llms/manifest.json`. */
export interface ManifestChunk {
	/** Unique within the package. Matches `^[A-Za-z0-9][A-Za-z0-9._-]*$`. */
	id: string
	/** Path relative to `.llms/`. Must not escape that directory. */
	file: string
	/** Approximate token count, used to budget an answer. Never 0. */
	tokens?: number
	/** Search terms indexed alongside the content, weighted above it. */
	tags?: string[]
	/** Identifiers the chunk documents, e.g. `Bpmn.createProcess`. */
	entities?: string[]
}

/** Contents of `.llms/manifest.json`. */
export interface Manifest {
	$schema?: string
	name: string
	version: string
	/** Libraries this package documents, each `name` or `name@version`. */
	documents?: string[]
	chunks: ManifestChunk[]
}

/** A documentation package found on disk, with its manifest already validated. */
export interface Pack {
	name: string
	/** The installed `package.json` version, which supersedes the manifest's. */
	version: string
	/** Absolute path to the package root (the directory holding `.llms/`). */
	dir: string
	/** False for `@docspack-community/*`, whose content is unreviewed. */
	trusted: boolean
	manifest: Manifest
	/** Set when the manifest version disagrees with the installed package.json. */
	versionMismatch?: string
}

/** A chunk that matched a query, scored against the whole corpus. */
export interface SearchHit {
	/** `<name>@<version>/<id>` — the identifier an answer header shows. */
	chunkId: string
	pack: Pack
	chunk: ManifestChunk
	/** The chunk's own Markdown, already read from disk. */
	content: string
	tokens: number
	score: number
}

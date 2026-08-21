/**
 * Finding and reading documentation packages on disk.
 *
 * A manifest is third-party input that ends up in a model's context, so it is
 * validated as a security boundary: a chunk path that leaves `.llms/` is refused,
 * and the installed `package.json` version supersedes whatever the manifest claims.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { type DocsIndex, type IndexInput, buildIndex } from "./search.js"
import { estimateTokens } from "./text.js"
import type { Manifest, ManifestChunk, Pack } from "./types.js"

const CHUNK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const COMMUNITY_SCOPE = "@docspack-community"

/** Read one documentation package from its root directory. */
export function loadPack(dir: string): Pack {
	const root = resolve(dir)
	const pkg = readJson(join(root, "package.json"), "package.json")
	const manifest = readJson(join(root, ".llms", "manifest.json"), "manifest") as Manifest

	if (typeof pkg.name !== "string" || typeof pkg.version !== "string") {
		throw new Error(`${root}: package.json needs a "name" and a "version"`)
	}
	if (!Array.isArray(manifest.chunks)) {
		throw new Error(`${root}: .llms/manifest.json needs a "chunks" array`)
	}

	const seen = new Set<string>()
	for (const chunk of manifest.chunks) {
		if (!CHUNK_ID.test(chunk.id ?? "")) {
			throw new Error(`${pkg.name}: chunk id ${JSON.stringify(chunk.id)} is not a valid id`)
		}
		if (seen.has(chunk.id)) throw new Error(`${pkg.name}: duplicate chunk id "${chunk.id}"`)
		seen.add(chunk.id)
		if (chunk.tokens !== undefined && (!Number.isInteger(chunk.tokens) || chunk.tokens < 1)) {
			throw new Error(`${pkg.name}/${chunk.id}: "tokens" must be an integer of at least 1`)
		}
		chunkPath(root, chunk)
	}

	return {
		name: pkg.name,
		version: pkg.version,
		dir: root,
		trusted: !pkg.name.startsWith(`${COMMUNITY_SCOPE}/`),
		manifest,
		...(manifest.version && manifest.version !== pkg.version
			? { versionMismatch: manifest.version }
			: {}),
	}
}

/**
 * Resolve a chunk's file inside `.llms/`, refusing any path that escapes it.
 * The manifest is untrusted, so this is the only way a chunk path is turned
 * into a real one.
 */
export function chunkPath(packDir: string, chunk: ManifestChunk): string {
	const base = resolve(packDir, ".llms")
	const target = resolve(base, chunk.file ?? "")
	const inside = relative(base, target)
	if (inside === "" || inside.startsWith("..") || inside.startsWith(`..${sep}`)) {
		throw new Error(`${chunk.id}: chunk file "${chunk.file}" escapes .llms/`)
	}
	return target
}

export function readChunk(pack: Pack, chunk: ManifestChunk): string {
	return readFileSync(chunkPath(pack.dir, chunk), "utf8")
}

/**
 * Every documentation package reachable from `cwd`: the vendor-scoped
 * `@<vendor>/docspack` and community `@docspack-community/*` packages installed
 * in any `node_modules` up the tree, plus `cwd` itself when it is a pack.
 */
export function discoverPacks(cwd = process.cwd()): Pack[] {
	const found = new Map<string, Pack>()

	const offer = (dir: string) => {
		try {
			const pack = loadPack(dir)
			if (!found.has(pack.name)) found.set(pack.name, pack)
		} catch {
			// Not a documentation package, or one we must not read. Skip it.
		}
	}

	offer(cwd)
	for (const modules of nodeModulesChain(resolve(cwd))) {
		for (const scope of listDirectory(modules)) {
			if (!scope.startsWith("@")) continue
			if (scope === COMMUNITY_SCOPE) {
				for (const name of listDirectory(join(modules, scope))) offer(join(modules, scope, name))
			} else {
				offer(join(modules, scope, "docspack"))
			}
		}
	}

	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Load every chunk of every pack into a searchable index. */
export function indexPacks(packs: readonly Pack[]): DocsIndex {
	const inputs: IndexInput[] = []
	for (const pack of packs) {
		for (const chunk of pack.manifest.chunks) {
			const content = readChunk(pack, chunk)
			inputs.push({ pack, chunk, content, tokens: chunk.tokens ?? estimateTokens(content) })
		}
	}
	return buildIndex(inputs)
}

function nodeModulesChain(from: string): string[] {
	const dirs: string[] = []
	let current = from
	for (;;) {
		dirs.push(join(current, "node_modules"))
		const parent = dirname(current)
		if (parent === current) return dirs
		current = parent
	}
}

function listDirectory(dir: string): string[] {
	try {
		return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory())
	} catch {
		return []
	}
}

function readJson(path: string, label: string): Record<string, unknown> & Partial<Manifest> {
	let raw: string
	try {
		raw = readFileSync(path, "utf8")
	} catch {
		throw new Error(`${path}: ${label} not found`)
	}
	try {
		return JSON.parse(raw)
	} catch (error) {
		throw new Error(`${path}: ${label} is not valid JSON — ${(error as Error).message}`)
	}
}

/**
 * The project `casen dev` serves: which files are in it, and which paths a
 * browser request may name.
 *
 * Every path a request carries goes through {@link resolveProjectPath} before
 * anything touches the disk. The server binds to loopback, but a page open in
 * the same browser can still reach loopback, so "only local callers" is not the
 * same as "only trusted input".
 */

import { createHash } from "node:crypto"
import { readdir, realpath } from "node:fs/promises"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import type { EditableKind, ProjectFile } from "./protocol.js"

export type { EditableKind, ModelKind, ProjectFile } from "./protocol.js"

/** Directories that never hold a project's own models, and are expensive to walk. */
export const SKIPPED_DIRS = new Set(["node_modules", "dist", "build", "target", "coverage", "out"])

export const TESTS_SUFFIX = ".tests.json"

/** Classifies a path by name alone; `null` when the dev server has no business with it. */
export function kindOf(path: string): EditableKind | null {
	const lower = path.toLowerCase()
	if (lower.endsWith(`.bpmn${TESTS_SUFFIX}`)) return "tests"
	if (lower.endsWith(".bpmn")) return "bpmn"
	if (lower.endsWith(".dmn")) return "dmn"
	if (lower.endsWith(".form")) return "form"
	return null
}

/** A content fingerprint — what a client says it last saw, so a write never clobbers a newer file. */
export function etagOf(text: string): string {
	return createHash("sha1").update(text).digest("hex").slice(0, 16)
}

function toPosix(path: string): string {
	return sep === "/" ? path : path.split(sep).join("/")
}

/**
 * Lists every `.bpmn`, `.dmn` and `.form` file under `root`, sorted by path.
 *
 * Hidden directories (`.git`, `.turbo`, …) and build output are skipped, and
 * symlinks are not followed: a link can point outside the project, and the
 * listing must only name files the server would agree to open.
 */
export async function discoverFiles(root: string): Promise<ProjectFile[]> {
	const found: ProjectFile[] = []
	const all = new Set<string>()

	async function walk(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue
			const full = join(dir, entry.name)
			if (entry.isDirectory()) {
				if (!SKIPPED_DIRS.has(entry.name)) await walk(full)
			} else if (entry.isFile()) {
				all.add(toPosix(relative(root, full)))
			}
		}
	}

	await walk(root)
	for (const path of all) {
		const kind = kindOf(path)
		if (kind === null || kind === "tests") continue
		found.push({ path, kind, hasTests: kind === "bpmn" && all.has(`${path}${TESTS_SUFFIX}`) })
	}
	return found.sort((a, b) => a.path.localeCompare(b.path))
}

export class PathError extends Error {}

/**
 * Turns a project-relative path from a request into an absolute one, or throws.
 *
 * Rejected: absolute paths, anything that climbs out of the project (`..`),
 * hidden segments, files of a kind the server does not edit, and — once the
 * file exists — a real path outside the project, which is what a symlink
 * pointing out of it resolves to.
 *
 * @param root - The project directory, already resolved through {@link realpath}.
 * @param requested - The path as the client sent it.
 */
export async function resolveProjectPath(
	root: string,
	requested: string,
): Promise<{ absolute: string; relative: string; kind: EditableKind }> {
	if (requested.length === 0 || requested.includes("\0")) {
		throw new PathError("A file path is required.")
	}
	if (isAbsolute(requested) || /^[a-zA-Z]:/.test(requested)) {
		throw new PathError(`Not a project-relative path: ${requested}`)
	}
	const absolute = resolve(root, requested)
	const rel = relative(root, absolute)
	if (rel.length === 0 || rel.startsWith("..") || isAbsolute(rel)) {
		throw new PathError(`Outside the project: ${requested}`)
	}
	if (rel.split(sep).some((segment) => segment.startsWith("."))) {
		throw new PathError(`Hidden paths are not served: ${requested}`)
	}
	const kind = kindOf(rel)
	if (kind === null) {
		throw new PathError(`Not a .bpmn, .dmn, .form or .bpmn.tests.json file: ${requested}`)
	}

	// A symlink inside the project can still point anywhere; judge where it lands.
	const real = await realpath(absolute).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return null
		throw error
	})
	if (real !== null) {
		const realRel = relative(root, real)
		if (realRel.startsWith("..") || isAbsolute(realRel)) {
			throw new PathError(`Outside the project: ${requested}`)
		}
	}
	return { absolute, relative: toPosix(rel), kind }
}

/**
 * The directories the proxy's filesystem routes may touch.
 *
 * A workspace root is either configured when the proxy starts (`--root`,
 * `BPMNKIT_PROXY_ROOTS`) or opened by a client: Studio names its project
 * folder, and the proxy accepts it when it looks like a project folder rather
 * than the home directory, the filesystem root or a hidden folder such as
 * `~/.ssh`. Every other path a route is given must then resolve — symlinks
 * followed — to somewhere inside one of those roots, and name a model file
 * (`.bpmn`, `.dmn`, `.form`, `.md`). So even an allowed client that goes
 * wrong can neither read a key nor overwrite a shell profile.
 */

import { lstatSync, realpathSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"

export const MODEL_EXTENSIONS: ReadonlySet<string> = new Set([".bpmn", ".dmn", ".form", ".md"])

export type Resolved =
	| { ok: true; path: string; root: string }
	| { ok: false; status: 400 | 403 | 404; error: string }

/** Expand a leading `~` to the user's home directory. */
export function expandHome(p: string): string {
	if (p === "~" || p.startsWith("~/")) return homedir() + p.slice(1)
	return p
}

/** True when `target` is `root` or lies beneath it. Both must already be resolved. */
export function isWithin(root: string, target: string): boolean {
	const rel = relative(root, target)
	return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * The real path of `target`, which need not exist yet: the nearest existing
 * ancestor is resolved and the missing tail appended. That is where a write
 * would land, so a symlinked parent pointing elsewhere is seen for what it is.
 * `null` when the nearest existing entry is a dangling symlink, whose target a
 * write would silently create.
 */
export function realLocation(target: string): string | null {
	const tail: string[] = []
	let current = resolve(target)
	while (lstatSync(current, { throwIfNoEntry: false }) === undefined) {
		const parent = dirname(current)
		if (parent === current) break
		tail.unshift(basename(current))
		current = parent
	}
	try {
		return join(realpathSync(current), ...tail)
	} catch {
		return null
	}
}

function realHome(): string {
	try {
		return realpathSync(homedir())
	} catch {
		return resolve(homedir())
	}
}

/** Why `dir` (a real path) is not acceptable as a client-opened root, or `null` if it is. */
export function unsafeRootReason(dir: string): string | null {
	if (dirname(dir) === dir) return "it is the filesystem root"
	if (isWithin(dir, realHome())) return "it is your home directory or contains it"
	const hidden = dir.split(sep).find((part) => part.startsWith("."))
	if (hidden !== undefined) return `it is inside the hidden folder "${hidden}"`
	return null
}

export class WorkspaceRoots {
	private readonly configured: string[] = []
	private readonly opened = new Set<string>()

	/** `roots` are trusted as given — the user named them — but must exist. */
	constructor(roots: readonly string[] = []) {
		for (const raw of roots) {
			const abs = resolve(expandHome(raw))
			try {
				if (!statSync(abs).isDirectory()) throw new Error("not a directory")
				this.configured.push(realpathSync(abs))
			} catch {
				console.warn(`[workspace] ignoring root ${JSON.stringify(raw)}: not an existing directory`)
			}
		}
	}

	/** Every root currently in force. */
	list(): string[] {
		return [...this.configured, ...this.opened]
	}

	/**
	 * Accept `raw` as a workspace root: a configured root or a folder inside
	 * one, or else a folder that passes `unsafeRootReason`.
	 */
	open(raw: string | null | undefined): Resolved {
		const expanded = expandHome(raw ?? "")
		if (expanded === "") return { ok: false, status: 400, error: "Missing root" }
		if (!isAbsolute(expanded)) {
			return { ok: false, status: 400, error: "root must be an absolute path" }
		}
		let real: string
		try {
			real = realpathSync(expanded)
		} catch {
			return { ok: false, status: 404, error: "Project root not found" }
		}
		if (!statSync(real).isDirectory()) {
			return { ok: false, status: 400, error: "Project root is not a directory" }
		}
		const configured = this.configured.find((r) => isWithin(r, real))
		if (configured !== undefined) return { ok: true, path: real, root: real }
		const reason = unsafeRootReason(real)
		if (reason !== null) {
			return {
				ok: false,
				status: 403,
				error: `Refusing to open ${expanded} as a workspace: ${reason}. Pick a project folder, or start the proxy with --root ${expanded} to allow it explicitly.`,
			}
		}
		this.opened.add(real)
		return { ok: true, path: real, root: real }
	}

	/**
	 * Resolve a path a client sent: absolute, no `..`, inside `rootHint` (opened
	 * on the way) or else inside any root in force. `kind: "model"` also
	 * requires a model-file extension; `"dir"` is for folders.
	 */
	resolve(
		raw: string | null | undefined,
		kind: "model" | "dir",
		rootHint?: string | null,
	): Resolved {
		const expanded = expandHome(raw ?? "")
		if (expanded === "") return { ok: false, status: 400, error: "Missing path" }
		if (!isAbsolute(expanded)) return { ok: false, status: 400, error: "path must be absolute" }
		if (expanded.split(/[\\/]/).includes("..")) {
			return { ok: false, status: 400, error: "path must not contain '..'" }
		}
		if (kind === "model" && !MODEL_EXTENSIONS.has(extname(expanded).toLowerCase())) {
			return {
				ok: false,
				status: 403,
				error: "Only .bpmn, .dmn, .form and .md files can be accessed through the proxy",
			}
		}
		let roots: string[]
		if (rootHint) {
			const opened = this.open(rootHint)
			if (!opened.ok) return opened
			roots = [opened.root]
		} else {
			roots = this.list()
		}
		const real = realLocation(expanded)
		const root = real === null ? undefined : roots.find((r) => isWithin(r, real))
		if (real === null || root === undefined) {
			return {
				ok: false,
				status: 403,
				error: "Path is outside every workspace root the proxy has opened",
			}
		}
		return { ok: true, path: real, root }
	}

	/** Whether `target` — resolved like a write target — still lies inside `root`. */
	contains(root: string, target: string): boolean {
		const real = realLocation(target)
		return real !== null && isWithin(root, real)
	}
}

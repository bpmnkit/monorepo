/**
 * `GET /element-templates` — a project's own element templates, for a browser
 * that cannot walk a filesystem itself.
 *
 * - `?root=<abs>` — every template under the project, merged (a CI-style
 *   sweep: `collectElementTemplates`).
 * - `?root=<abs>&file=<path>` — only the templates that apply to that one
 *   diagram: the `.camunda/element-templates/` folders from the diagram's own
 *   folder up to `root`, nearest winning (`discoverElementTemplates`, Camunda
 *   Desktop Modeler's per-file resolution). `file` is absolute or relative to
 *   `root`.
 *
 * Per-file resolution reads no more than `?root=` already does: `file` must lie
 * inside `root`, and the walk stops there. Without that bound the walk would
 * climb to the filesystem root and read template folders the caller never
 * named.
 */

import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, resolve, sep } from "node:path"
import { collectElementTemplates, discoverElementTemplates } from "@bpmnkit/connectors/node"

export interface RouteResult {
	status: number
	body: unknown
}

/** Expand a leading `~` to the user's home directory. */
function expandHome(p: string): string {
	if (p === "~" || p.startsWith("~/")) return homedir() + p.slice(1)
	return p
}

/**
 * True when `target` is `root` or lies beneath it, and never names `..` —
 * the rule the proxy's filesystem helpers apply, checked on the raw value too
 * so a traversal is refused rather than silently normalised away.
 */
export function isInsideRoot(root: string, target: string): boolean {
	if (target.split(/[\\/]/).includes("..")) return false
	const normRoot = root.endsWith(sep) ? root : root + sep
	return target === root || target.startsWith(normRoot)
}

/** A config folder is one directory name, e.g. `.camunda` — never a path. */
function isPlainFolderName(name: string): boolean {
	return name !== "" && name !== "." && name !== ".." && !/[\\/]/.test(name)
}

function bad(message: string): RouteResult {
	return { status: 400, body: { error: message } }
}

export async function handleElementTemplates(params: URLSearchParams): Promise<RouteResult> {
	const root = expandHome(params.get("root") ?? "")
	if (root === "" || !existsSync(root)) {
		return bad("root query parameter must name an existing directory")
	}
	const configFolder = params.get("configFolder") ?? undefined
	const file = params.get("file")

	if (file === null) {
		const { templates, problems } = await collectElementTemplates(
			configFolder ? { root, configFolder } : { root },
		)
		return { status: 200, body: { templates, problems } }
	}

	if (configFolder !== undefined && !isPlainFolderName(configFolder)) {
		return bad("configFolder must be a single folder name")
	}
	const rawFile = expandHome(file)
	if (rawFile === "") return bad("file query parameter must not be empty")
	const absRoot = resolve(root)
	const absFile = isAbsolute(rawFile) ? resolve(rawFile) : resolve(absRoot, rawFile)
	if (!isInsideRoot(absRoot, absFile) || rawFile.split(/[\\/]/).includes("..")) {
		return bad("file must lie inside root")
	}
	if (!existsSync(absFile)) return { status: 404, body: { error: "file not found" } }

	const { templates, problems, directories } = await discoverElementTemplates({
		from: absFile,
		root: absRoot,
		...(configFolder ? { configFolder } : {}),
	})
	return { status: 200, body: { templates, problems, directories } }
}

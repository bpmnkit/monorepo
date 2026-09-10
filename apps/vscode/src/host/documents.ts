/**
 * Which artifact a path holds, decided by extension alone.
 *
 * Content sniffing is deliberately not done here. Every caller already has a
 * reason to believe the file is one of the three — a custom editor bound to
 * `*.bpmn`, a command enabled on `resourceExtname` — so the only question left
 * is which, and the extension answers it. `apps/drop` sniffs content because it
 * accepts uploads from strangers; an editor opens files the user named.
 */
import type { ViewerKind } from "../shared/protocol.js"

const BY_EXTENSION: Readonly<Record<string, ViewerKind>> = {
	".bpmn": "bpmn",
	".dmn": "dmn",
	".form": "form",
}

/**
 * The artifact kind for a path, or `null` when it is not one of the three.
 *
 * @param path - A file path or URI path. Only the trailing extension is read.
 */
export function kindForPath(path: string): ViewerKind | null {
	const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
	const name = path.slice(slash + 1)
	const dot = name.lastIndexOf(".")
	if (dot <= 0) return null
	return BY_EXTENSION[name.slice(dot).toLowerCase()] ?? null
}

/** The custom-editor view type that shows a given kind. */
export function viewTypeFor(kind: ViewerKind): string {
	return `bpmnkit.${kind}`
}

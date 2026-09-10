/**
 * Test data for starting a process instance, found by convention.
 *
 * Starting an instance needs variables, and typing JSON into a prompt is a
 * terrible place to keep the three payloads a process is always tried with.
 * So they live in the repository, beside the diagram, in
 * `.camunda/payloads/*.json` — the same `.camunda` folder element templates
 * already use (`@bpmnkit/connectors/node`), for the same reason: no
 * registration step, no settings file, drop the file in and the tools find it.
 *
 * The walk is duplicated from template discovery rather than shared. It is
 * thirty lines, the two conventions could reasonably diverge, and one consumer
 * does not justify widening a published package's API — see `doc/roadmap.md`,
 * Phase 7, for when that changes.
 */

import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"

/** The folder searched at each level, matching element-template discovery. */
export const PAYLOADS_PATH = join(".camunda", "payloads")

/** A named set of process variables. */
export interface Payload {
	/** The file's name without its extension — what the user picks by. */
	readonly name: string
	/** Absolute path, so a picker can say which one it found. */
	readonly path: string
	readonly variables: Record<string, unknown>
}

/** A payload file that could not be used, and why. */
export interface PayloadProblem {
	readonly path: string
	readonly message: string
}

export interface PayloadDiscovery {
	/** Usable payloads, sorted by name. A nearer directory wins a name clash. */
	readonly payloads: Payload[]
	/** Everything rejected. One bad file never costs the good ones beside it. */
	readonly problems: PayloadProblem[]
}

/** Directories from `root` down to `from`, so the nearest one is read last. */
function directoriesFromRootDown(from: string, root: string | undefined): string[] {
	const start = resolve(from)
	const stop = root === undefined ? undefined : resolve(root)
	// A start outside the root would walk past it and out of the project.
	if (stop !== undefined && start !== stop && !start.startsWith(stop + sep)) return [start]

	const chain: string[] = []
	for (let dir = start; ; dir = dirname(dir)) {
		chain.push(dir)
		if (dir === stop || dirname(dir) === dir) break
	}
	return chain.reverse()
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory()
	} catch {
		return false
	}
}

/**
 * Reads one payload file into variables.
 *
 * A payload is a JSON **object**: the thing a process instance is started
 * with. An array or a bare number is a file someone meant to be something
 * else, and saying so beats starting an instance with nothing.
 */
export function readPayload(path: string, text: string): Payload | PayloadProblem {
	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch (error) {
		return { path, message: `not JSON: ${(error as Error).message}` }
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return { path, message: "a payload must be a JSON object of process variables" }
	}

	const file = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf(sep)) + 1)
	return {
		name: file.replace(/\.json$/i, ""),
		path,
		variables: parsed as Record<string, unknown>,
	}
}

/**
 * Finds the payloads that apply to a diagram.
 *
 * Every directory from `root` down to the one holding `from` is checked for
 * `.camunda/payloads/*.json`. Directories are read root-first, so a payload
 * beside the diagram overrides one at the project root that shares its name.
 *
 * @param from - The diagram file, or the directory holding it.
 * @param root - Where to stop walking up. Without it the walk reaches the
 *   filesystem root, which is almost never what a caller wants.
 */
export async function discoverPayloads(from: string, root?: string): Promise<PayloadDiscovery> {
	const startDir = (await isDirectory(from)) ? resolve(from) : dirname(resolve(from))
	const byName = new Map<string, Payload>()
	const problems: PayloadProblem[] = []

	for (const dir of directoriesFromRootDown(startDir, root)) {
		const payloadDir = join(dir, PAYLOADS_PATH)
		if (!(await isDirectory(payloadDir))) continue

		const entries = (await readdir(payloadDir)).filter((name) =>
			name.toLowerCase().endsWith(".json"),
		)
		for (const entry of entries.sort()) {
			const path = join(payloadDir, entry)
			let text: string
			try {
				text = await readFile(path, "utf8")
			} catch (error) {
				problems.push({ path, message: (error as Error).message })
				continue
			}
			const result = readPayload(path, text)
			if ("message" in result) problems.push(result)
			else byName.set(result.name, result)
		}
	}

	return {
		payloads: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
		problems,
	}
}

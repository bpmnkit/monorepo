import { randomUUID } from "node:crypto"
import { chmod, link, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"

import { applyAutoLayout } from "../bpmn/auto-layout.js"
import type { BpmnDefinitions } from "../bpmn/bpmn-model.js"
import { parseBpmn } from "../bpmn/bpmn-parser.js"
import { serializeBpmn } from "../bpmn/bpmn-serializer.js"
import { type SemanticDiff, diffSemantics, semanticHash } from "../bpmn/semantic-hash.js"
import { sha256Hex } from "../bpmn/sha256.js"
import { WriteError, WriteVerificationError } from "../errors.js"

/**
 * The only place in this package that writes a BPMN file, and the only one that
 * checks what it wrote.
 *
 * Node-only — it is reached through the `@bpmnkit/core/node` subpath so that
 * importing `@bpmnkit/core` in a browser never pulls `node:fs` in.
 *
 * **What the verification does and does not cover.** Before anything reaches
 * disk, the model is serialised, parsed back, and the two semantic hashes are
 * compared. That catches the serialiser dropping or mangling something. It
 * cannot catch the *parser* dropping something on the way in: content the
 * parser never saw is absent from both sides and the hashes agree. Guarding
 * that is the round-trip corpus gate's job (`tests/roundtrip-corpus.test.ts`),
 * not this function's.
 *
 * There is deliberately no option to skip verification. Turning it off would
 * only ever be used to get past the bug it exists to report; callers who want
 * unchecked serialisation can still use `Bpmn.export()` and write it
 * themselves.
 */

export interface WriteBpmnOptions {
	/** Path to write to. */
	output: string
	/**
	 * Replace `output` if it already exists. Default `false`, which refuses
	 * rather than overwrite.
	 */
	force?: boolean
	/**
	 * `"preserve"` (default) writes the diagram the model already carries.
	 * `"auto"` regenerates it first — the model is unchanged either way, which
	 * the verification step proves.
	 */
	layout?: "preserve" | "auto"
}

export interface WriteBpmnResult {
	/** Absolute path written. */
	destination: string
	/** Size of the written file in bytes. */
	bytes: number
	/** SHA-256 of the exact bytes written. */
	outputSha256: string
	/** Semantic hash of the model, as verified after reading it back. */
	semanticHash: string
	/**
	 * What this write changed about the file that was already there, or
	 * `undefined` when the destination was newly created or the previous
	 * contents could not be parsed.
	 */
	changes?: SemanticDiff
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path)
		return true
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) return false
		throw error
	}
}

function isErrnoCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code
}

/** Codes returned by filesystems that cannot make a hard link. */
const NO_HARD_LINKS = new Set(["ENOTSUP", "EOPNOTSUPP", "EPERM", "EXDEV", "EMLINK"])

/**
 * Serialises a model, verifies it survives a round trip, and writes it
 * atomically.
 *
 * The file appears complete or not at all: the contents go to a temporary file
 * in the destination's own directory and are then renamed into place, so an
 * interrupted write cannot leave a half-written model behind. Without `force`
 * the final step is a hard link, which fails if the destination appeared in the
 * meantime rather than silently replacing it.
 *
 * @param definitions - The model to write.
 * @param options - Destination and write behaviour.
 * @returns Where it went, what it hashes to, and what it changed.
 * @throws {WriteVerificationError} If reading the output back does not
 *   reproduce the model. Nothing is written.
 * @throws {WriteError} If the destination exists and `force` was not given, or
 *   the filesystem refused the write.
 *
 * @example
 * ```typescript
 * import { writeBpmn } from "@bpmnkit/core/node"
 *
 * const result = await writeBpmn(definitions, { output: "flow.bpmn" })
 * console.log(result.semanticHash, result.changes?.changed.length ?? 0)
 * ```
 */
export async function writeBpmn(
	definitions: BpmnDefinitions,
	options: WriteBpmnOptions,
): Promise<WriteBpmnResult> {
	const destination = resolve(options.output)
	const force = options.force === true
	const exists = await pathExists(destination)

	// Fail before doing the work, not after it.
	if (exists && !force) {
		throw new WriteError(`Refusing to overwrite ${options.output}. Pass force: true to replace it.`)
	}

	// applyAutoLayout returns a new model, so the caller's stays untouched.
	const model = options.layout === "auto" ? applyAutoLayout(definitions) : definitions
	const expected = semanticHash(model)
	const xml = serializeBpmn(model)

	let reparsed: BpmnDefinitions
	try {
		reparsed = parseBpmn(xml)
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		throw new WriteVerificationError(
			`Serialising the model produced BPMN that cannot be parsed back: ${reason}`,
			{ added: [], removed: [], changed: [] },
		)
	}

	const actual = semanticHash(reparsed)
	if (actual !== expected) {
		const changes = diffSemantics(model, reparsed)
		throw new WriteVerificationError(
			[
				"Serialising the model did not reproduce it, so nothing was written.",
				`Lost: ${changes.removed.join(", ") || "none"}.`,
				`Added: ${changes.added.join(", ") || "none"}.`,
				`Altered: ${changes.changed.map((entry) => entry.id).join(", ") || "none"}.`,
			].join(" "),
			changes,
		)
	}

	const changes = exists ? await changesAgainst(destination, reparsed) : undefined
	await writeAtomically(destination, xml, force)

	return {
		destination,
		bytes: Buffer.byteLength(xml, "utf-8"),
		outputSha256: sha256Hex(xml),
		semanticHash: actual,
		changes,
	}
}

/**
 * Diffs the model about to be written against the one already on disk. A
 * previous file that cannot be read or parsed yields no report rather than
 * failing the write — the old contents are being replaced either way.
 */
async function changesAgainst(
	destination: string,
	next: BpmnDefinitions,
): Promise<SemanticDiff | undefined> {
	try {
		return diffSemantics(parseBpmn(await readFile(destination, "utf-8")), next)
	} catch {
		return undefined
	}
}

async function writeAtomically(
	destination: string,
	contents: string,
	force: boolean,
): Promise<void> {
	const temporary = resolve(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`)

	try {
		await writeFile(temporary, contents, { encoding: "utf-8", flag: "wx" })

		if (force) {
			// Keep the permissions the file already had; a rename would otherwise
			// hand it whatever the temporary file was created with.
			const mode = await modeOf(destination)
			if (mode !== undefined) await chmod(temporary, mode)
			await rename(temporary, destination)
			return
		}

		await linkOrCreateExclusively(temporary, destination, contents)
	} catch (error) {
		if (error instanceof WriteError) throw error
		if (isErrnoCode(error, "EEXIST")) {
			throw new WriteError(
				`Refusing to overwrite ${destination}: it appeared while writing. Pass force: true to replace it.`,
			)
		}
		const reason = error instanceof Error ? error.message : String(error)
		throw new WriteError(`Unable to write ${destination}: ${reason}`)
	} finally {
		await rm(temporary, { force: true })
	}
}

/**
 * Creates the destination without replacing anything. `link` fails with EEXIST
 * if the destination is taken, which `rename` would not, and it publishes the
 * already-complete temporary file in one step.
 *
 * Filesystems without hard links fall back to an exclusive create, which is
 * still safe against replacing an existing file but writes in place rather than
 * atomically — an interrupted write there can leave a partial file.
 */
async function linkOrCreateExclusively(
	temporary: string,
	destination: string,
	contents: string,
): Promise<void> {
	try {
		await link(temporary, destination)
	} catch (error) {
		if (!isErrnoCode(error, "EEXIST") && isNoHardLinkSupport(error)) {
			await writeFile(destination, contents, { encoding: "utf-8", flag: "wx" })
			return
		}
		throw error
	}
}

function isNoHardLinkSupport(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		NO_HARD_LINKS.has((error as NodeJS.ErrnoException).code ?? "")
	)
}

async function modeOf(path: string): Promise<number | undefined> {
	try {
		return (await stat(path)).mode
	} catch {
		return undefined
	}
}

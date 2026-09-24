/**
 * Saving a file from the browser without making the commit worse than the edit.
 *
 * The browser sends the whole document as the editor serialises it. Written as
 * is, the first box moved would reformat every line of a file someone wrote by
 * hand or in another tool. So the text is first written *into* the file that
 * is already there (`preserve*Formatting`), and that result is only used if it
 * still reads as the same model the editor sent — otherwise the editor's own
 * text is the floor. The write itself goes through a temporary file and a
 * rename, and is read back before it is reported as saved.
 */

import { randomBytes } from "node:crypto"
import { readFile, rename, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
	Bpmn,
	Dmn,
	Form,
	preserveBpmnFormatting,
	preserveDmnFormatting,
	preserveFormFormatting,
	preserveJsonFormatting,
} from "@bpmnkit/core"
import { type EditableKind, etagOf } from "./project.js"

export class WriteError extends Error {
	constructor(
		message: string,
		/** HTTP status the server answers with. */
		readonly status: 400 | 409 | 500,
		/** For a conflict: the fingerprint of what is on disk now. */
		readonly currentEtag?: string | null,
	) {
		super(message)
	}
}

/** Reads a document into a form two equal documents share, or throws if it is not one. */
function canonical(kind: EditableKind, text: string): string {
	switch (kind) {
		case "bpmn":
			return JSON.stringify(Bpmn.parse(text))
		case "dmn":
			return JSON.stringify(Dmn.parse(text))
		case "form":
			return JSON.stringify(Form.parse(text))
		case "tests": {
			const parsed: unknown = JSON.parse(text)
			if (!Array.isArray(parsed)) throw new Error("A tests file must hold an array of scenarios.")
			return JSON.stringify(parsed)
		}
	}
}

function preserve(kind: EditableKind, original: string, updated: string): string {
	switch (kind) {
		case "bpmn":
			return preserveBpmnFormatting(original, updated).xml
		case "dmn":
			return preserveDmnFormatting(original, updated).xml
		case "form":
			return preserveFormFormatting(original, updated).json
		case "tests":
			return preserveJsonFormatting(original, updated).json
	}
}

export interface WriteOutcome {
	etag: string
	/** `preserved` when the file's own formatting was kept around the edit. */
	outcome: "created" | "preserved" | "rewritten"
	/** Exactly what is now on disk. */
	text: string
}

/**
 * Writes `text` over the file at `absolute`, if the file is still the one the
 * client last saw.
 *
 * @param absolute - The target, already checked to be inside the project.
 * @param kind - What the file is; decides how it is validated and preserved.
 * @param text - The document the client wants on disk.
 * @param baseEtag - {@link etagOf} the text the client started from, or `null`
 *   to create a file that must not exist yet.
 */
export async function writeVerified(
	absolute: string,
	kind: EditableKind,
	text: string,
	baseEtag: string | null,
): Promise<WriteOutcome> {
	let wanted: string
	try {
		wanted = canonical(kind, text)
	} catch (error) {
		throw new WriteError(
			`Not saved — the document does not parse as ${kind}: ${error instanceof Error ? error.message : String(error)}`,
			400,
		)
	}

	const current = await readFile(absolute, "utf8").catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return null
		throw error
	})
	const currentEtag = current === null ? null : etagOf(current)
	if (currentEtag !== baseEtag) {
		throw new WriteError(
			current === null
				? "Not saved — the file was deleted on disk."
				: "Not saved — the file changed on disk since it was opened.",
			409,
			currentEtag,
		)
	}

	let next = text
	let outcome: WriteOutcome["outcome"] = current === null ? "created" : "rewritten"
	if (current !== null) {
		const preserved = preserve(kind, current, text)
		// The preserving writers check themselves; this is the one check that is
		// ours — that what goes to disk is still the model the editor sent.
		let same = false
		try {
			same = canonical(kind, preserved) === wanted
		} catch {
			same = false
		}
		if (same) {
			next = preserved
			if (preserved !== text) outcome = "preserved"
		}
	}

	// Hidden temp name: the watcher and the file listing both skip dot-files.
	const temp = join(
		dirname(absolute),
		`.${basename(absolute)}.casen-dev-${randomBytes(4).toString("hex")}`,
	)
	try {
		await writeFile(temp, next, "utf8")
		await rename(temp, absolute)
	} catch (error) {
		await rm(temp, { force: true })
		throw new WriteError(
			`Not saved — ${error instanceof Error ? error.message : String(error)}`,
			500,
		)
	}

	const onDisk = await readFile(absolute, "utf8")
	if (onDisk !== next) {
		throw new WriteError("Saved, but the file on disk does not match what was written.", 500)
	}
	return { etag: etagOf(onDisk), outcome, text: onDisk }
}

import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import type { FileKind } from "../shared/constants.js"
import { MAX_FILE_BYTES, MAX_ROW_BYTES } from "../shared/constants.js"
import { type FileMeta, type ParsedModel, extractMeta } from "./meta.js"

/** An input error that maps to a specific HTTP status. */
export class ValidationError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message)
		this.name = "ValidationError"
	}
}

/** A validated, parsed file ready to store. */
export interface ValidatedFile {
	kind: FileKind
	filename: string
	original: string
	/** `JSON.stringify` of the parsed model — the canonical stored representation. */
	json: string
	name: string | null
	meta: FileMeta
	sizeOriginal: number
	sizeJson: number
}

/** UTF-8 byte length of a string. */
export function byteLength(text: string): number {
	return new TextEncoder().encode(text).length
}

/** Strip any path, neutralize unsafe characters, and bound the length. */
export function sanitizeFilename(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? "file"
	const cleaned = base
		.replace(/[^\w.\- ]+/g, "_")
		.trim()
		.slice(0, 120)
	return cleaned.length > 0 ? cleaned : "file"
}

/** Decide the artifact kind from filename extension, falling back to content sniffing. */
export function sniffKind(filename: string, text: string): FileKind | null {
	const dot = filename.lastIndexOf(".")
	const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : ""
	if (ext === ".bpmn") return "bpmn"
	if (ext === ".dmn") return "dmn"
	if (ext === ".form") return "form"

	const head = text.slice(0, 4000)
	if (ext === ".json" || /^\s*[{[]/.test(head)) {
		return /"components"\s*:/.test(head) ? "form" : null
	}
	// XML — namespace URIs are unambiguous; element names are the fallback.
	if (head.includes("spec/DMN/")) return "dmn"
	if (head.includes("spec/BPMN/")) return "bpmn"
	if (/<(?:\w+:)?decision[\s/>]/i.test(head)) return "dmn"
	if (/<(?:\w+:)?(?:process|definitions)[\s/>]/i.test(head)) return "bpmn"
	return null
}

/** Parse text into a tagged model. Throws the parser's error on invalid input. */
export function parseModel(kind: FileKind, text: string): ParsedModel {
	switch (kind) {
		case "bpmn":
			return { kind, model: Bpmn.parse(text) }
		case "dmn":
			return { kind, model: Dmn.parse(text) }
		case "form":
			return { kind, model: Form.parse(text) }
	}
}

/**
 * Validate one uploaded file end to end: size caps, kind sniffing, parse, metadata.
 * Throws {@link ValidationError} with an actionable, filename-prefixed message.
 */
export function validateFile(rawName: string, text: string): ValidatedFile {
	const filename = sanitizeFilename(rawName)
	const sizeOriginal = byteLength(text)
	if (sizeOriginal === 0) throw new ValidationError(`${filename}: file is empty`, 400)
	if (sizeOriginal > MAX_FILE_BYTES) {
		throw new ValidationError(`${filename}: exceeds the ${MAX_FILE_BYTES}-byte file limit`, 413)
	}

	const kind = sniffKind(filename, text)
	if (!kind) {
		throw new ValidationError(`${filename}: not a recognized BPMN, DMN, or Form file`, 400)
	}

	let parsed: ParsedModel
	try {
		parsed = parseModel(kind, text)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		throw new ValidationError(`${filename}: ${msg}`, 400)
	}

	const { name, meta } = extractMeta(parsed)
	const json = JSON.stringify(parsed.model)
	const sizeJson = byteLength(json)
	if (sizeJson > MAX_ROW_BYTES) {
		throw new ValidationError(`${filename}: converted model is too large to store`, 413)
	}

	return { kind, filename, original: text, json, name, meta, sizeOriginal, sizeJson }
}

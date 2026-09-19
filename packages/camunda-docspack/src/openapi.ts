/**
 * Turning the Orchestration Cluster API specification into one digest per operation.
 *
 * The generated reference pages in `docs/apis-tools/*​/specifications/` are unusable here — each
 * one is a base64-gzipped blob wrapped in React imports, with no prose an index can match. The
 * specification itself is the real source, so operations are read from it directly.
 *
 * The document is modular: the entry file's `paths` are `$ref`s into 50 sibling files, each with
 * its own `components`. Rather than bundle it — which means solving name collisions and
 * recursive schemas for an artefact nobody reads — references are resolved on demand, relative
 * to the file they appear in, and only to the depth a digest shows.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parse } from "yaml"

/** A schema expanded deeper than this stops being a digest and becomes the document again. */
const MAX_FIELD_DEPTH = 1
/** Fields listed beyond this are elided; the schema name is there for the rest. */
const MAX_FIELDS = 25
/** A field note longer than this is a paragraph, not a label. */
const MAX_FIELD_NOTE = 160

export interface Operation {
	/** Kebab-cased `operationId`, which is also the page Camunda publishes it at. */
	readonly slug: string
	readonly operationId: string
	readonly method: string
	readonly path: string
	readonly summary: string
	readonly digest: string
	/**
	 * Search terms the index weights above prose.
	 *
	 * Without these a digest loses every query to the concept pages: it says "activate" and
	 * "jobs" once each, while the prose that merely mentions jobs says them twenty times, and
	 * BM25 has no reason to prefer the endpoint. These are the words someone actually types.
	 */
	readonly tags: string[]
	/** Both spellings of the operation's address, so it can be asked for by name. */
	readonly entities: string[]
}

interface Doc {
	readonly value: Record<string, unknown>
	readonly file: string
}

/** A `$ref` target plus the file it was found in, so nested refs resolve from the right place. */
interface Resolved {
	readonly value: Record<string, unknown>
	readonly file: string
}

/**
 * Read every operation in the specification, in a stable order.
 *
 * @param entry path to the entry document, e.g. `api/camunda/v2/camunda-openapi.yaml`
 */
export function readOperations(entry: string): Operation[] {
	const cache = new Map<string, Record<string, unknown>>()
	const load = (file: string): Record<string, unknown> => {
		const cached = cache.get(file)
		if (cached !== undefined) return cached
		const parsed = (parse(readFileSync(file, "utf8")) ?? {}) as Record<string, unknown>
		cache.set(file, parsed)
		return parsed
	}

	const root: Doc = { value: load(entry), file: entry }
	const paths = asRecord(root.value.paths)
	const operations: Operation[] = []

	// Code-unit order, not localeCompare: collation is locale-dependent, and the build asserts
	// that the same commit produces the same bytes on any runner.
	for (const [path, entryValue] of Object.entries(paths).sort(([a], [b]) => (a < b ? -1 : 1))) {
		const item = deref(entryValue, root, load)
		if (item === undefined) continue

		for (const method of ["get", "post", "put", "patch", "delete"]) {
			const raw = asRecord(item.value[method])
			const operationId = asString(raw.operationId)
			if (operationId === "") continue

			const context: Doc = { value: load(item.file), file: item.file }
			operations.push({
				slug: kebab(operationId),
				operationId,
				method: method.toUpperCase(),
				path,
				summary: asString(raw.summary) || operationId,
				digest: digest(method.toUpperCase(), path, raw, context, load),
				tags: searchTerms(operationId, method, path, raw),
				entities: [operationId, `${method.toUpperCase()} ${path}`],
			})
		}
	}

	return operations
}

type Load = (file: string) => Record<string, unknown>

/** Words from the operation's id, verb, address and spec tag — deduplicated, lowercase. */
function searchTerms(
	operationId: string,
	method: string,
	path: string,
	raw: Record<string, unknown>,
): string[] {
	const specTags = Array.isArray(raw.tags) ? raw.tags.map(String) : []
	const words = [
		...kebab(operationId).split("-"),
		method.toLowerCase(),
		...path.split(/[/{}]/),
		...specTags.flatMap((tag) => tag.toLowerCase().split(/[\s-]+/)),
		"api",
		"endpoint",
	]
	return [...new Set(words.map((word) => word.toLowerCase()).filter((word) => word.length > 1))]
}

/** One operation, written as the lines an agent needs to make the call and nothing more. */
function digest(
	method: string,
	path: string,
	raw: Record<string, unknown>,
	context: Doc,
	load: Load,
): string {
	const lines: string[] = [`\`${method} ${path}\``, ""]

	const notes = markers(asString(raw.description))
	const prose = withoutMarkers(asString(raw.description)).trim()
	if (prose !== "") lines.push(prose, "")
	if (notes.length > 0) lines.push(...notes.map((note) => `- ${note}`), "")

	const auth = securitySchemes(raw.security)
	if (auth.length > 0) lines.push(`Authentication: ${auth.join(" or ")}`, "")

	const parameters = describeParameters(raw.parameters, context, load)
	if (parameters.length > 0) lines.push("Parameters:", ...parameters, "")

	const body = describeBody(raw.requestBody, context, load)
	if (body.length > 0) lines.push("Request body:", ...body, "")

	const responses = describeResponses(raw.responses, context, load)
	if (responses.length > 0) lines.push("Responses:", ...responses, "")

	return lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
}

/**
 * Camunda encodes three facts into the description as `[[MARKER:value]]`, which its own site
 * renders as admonitions. They answer questions an agent actually asks — what permission does
 * this need, when did it appear, is the read consistent — so they are decoded rather than
 * stripped. The permissions marker is base64 JSON.
 */
function markers(description: string): string[] {
	const out: string[] = []
	for (const match of description.matchAll(/\[\[([A-Z_]+):([^\]]*)\]\]/g)) {
		const [, name = "", value = ""] = match
		if (name === "ADDED_IN_VERSION") out.push(`Added in Camunda ${value}.`)
		else if (name === "CONSISTENCY") out.push(`Consistency: ${value.toLowerCase()}.`)
		else if (name === "REQUIRED_PERMISSIONS") {
			const permissions = decodePermissions(value)
			if (permissions !== undefined) out.push(`Required permissions: ${permissions}.`)
		}
	}
	return out
}

function decodePermissions(encoded: string): string | undefined {
	try {
		const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
			permissions?: { resourceType?: string; permissionType?: string }[]
		}
		const listed = (parsed.permissions ?? [])
			.map((entry) => `${entry.permissionType} on ${entry.resourceType}`)
			.filter((entry) => !entry.includes("undefined"))
		return listed.length === 0 ? undefined : listed.join(", ")
	} catch {
		return undefined
	}
}

function withoutMarkers(description: string): string {
	return description.replace(/\[\[[A-Z_]+:[^\]]*\]\]/g, "")
}

function securitySchemes(security: unknown): string[] {
	if (!Array.isArray(security)) return []
	return [...new Set(security.flatMap((entry) => Object.keys(asRecord(entry))))]
}

function describeParameters(value: unknown, context: Doc, load: Load): string[] {
	if (!Array.isArray(value)) return []
	const out: string[] = []
	for (const entry of value) {
		const parameter = deref(entry, context, load)?.value
		if (parameter === undefined) continue
		const name = asString(parameter.name)
		if (name === "") continue
		const required = parameter.required === true ? ", required" : ""
		const where = asString(parameter.in)
		const type = schemaName(parameter.schema, context, load)
		out.push(`  ${name} (${[where, type, required.slice(2)].filter(Boolean).join(", ")})`)
	}
	return out
}

function describeBody(value: unknown, context: Doc, load: Load): string[] {
	const body = deref(value, context, load)
	if (body === undefined) return []
	const media = asRecord(body.value.content)
	const [type, schema] = Object.entries(media)[0] ?? []
	if (type === undefined) return []

	const target = deref(asRecord(schema).schema, { value: load(body.file), file: body.file }, load)
	const name = schemaName(
		asRecord(schema).schema,
		{ value: load(body.file), file: body.file },
		load,
	)
	const required = body.value.required === true ? " (required)" : ""
	const head = `  ${type}: ${name}${required}`
	return target === undefined ? [head] : [head, ...fields(target, load, 1)]
}

function describeResponses(value: unknown, context: Doc, load: Load): string[] {
	const responses = asRecord(value)
	const out: string[] = []
	for (const [status, entry] of Object.entries(responses)) {
		const response = deref(entry, context, load)
		if (response === undefined) continue
		const media = asRecord(response.value.content)
		const [, schema] = Object.entries(media)[0] ?? []
		const name = schemaName(
			asRecord(schema).schema,
			{ value: load(response.file), file: response.file },
			load,
		)
		const description = asString(response.value.description).replace(/\s+/g, " ").trim()
		out.push(
			`  ${status}${name === "" ? "" : ` ${name}`}${description === "" ? "" : ` — ${description}`}`,
		)
	}
	return out
}

/** One level of a schema's own properties: enough to build the call, not the whole type graph. */
function fields(schema: Resolved, load: Load, depth: number): string[] {
	if (depth > MAX_FIELD_DEPTH) return []
	const properties = asRecord(schema.value.properties)
	const required = new Set(
		Array.isArray(schema.value.required) ? schema.value.required.map(String) : [],
	)

	const out: string[] = []
	for (const [name, value] of Object.entries(properties).slice(0, MAX_FIELDS)) {
		const property = asRecord(value)
		const context: Doc = { value: load(schema.file), file: schema.file }
		const type = schemaName(value, context, load) || asString(property.type) || "unknown"
		const flag = required.has(name) ? ", required" : ""
		const note = summarize(asString(property.description))
		out.push(`    ${name} (${type}${flag})${note === "" ? "" : ` — ${note}`}`)
	}
	if (Object.keys(properties).length > MAX_FIELDS) out.push("    …")
	return out
}

/**
 * A field's description, cut to a line.
 *
 * Cut by length at a word boundary rather than at the first full stop: Camunda's field
 * descriptions are full of abbreviations, and splitting on the period in "(e.g. ..." truncates
 * the sentence exactly where it was about to become useful.
 */
function summarize(description: string): string {
	const text = description.replace(/\s+/g, " ").trim()
	if (text.length <= MAX_FIELD_NOTE) return text
	const cut = text.slice(0, MAX_FIELD_NOTE)
	return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`
}

/** A schema's name if it has one, else its primitive shape. */
function schemaName(value: unknown, context: Doc, load: Load): string {
	const schema = asRecord(value)
	const ref = asString(schema.$ref)
	if (ref !== "") return ref.split("/").pop() ?? ""
	if (asString(schema.type) === "array") {
		const items = schemaName(schema.items, context, load)
		return items === "" ? "array" : `${items}[]`
	}
	const composed = schema.allOf ?? schema.oneOf ?? schema.anyOf
	if (Array.isArray(composed) && composed[0] !== undefined) {
		return schemaName(composed[0], context, load)
	}
	return asString(schema.type)
}

/**
 * Follow a `$ref` to the thing it names.
 *
 * A reference is relative to the file it is written in — `common-responses.yaml#/components/…`
 * from `jobs.yaml` means the sibling file — so the file travels with the value.
 */
function deref(value: unknown, context: Doc, load: Load): Resolved | undefined {
	let current = asRecord(value)
	let file = context.file

	for (let hop = 0; hop < 8; hop++) {
		const ref = asString(current.$ref)
		if (ref === "") return { value: current, file }

		const [target = "", pointer = ""] = ref.split("#")
		const next = target === "" ? file : join(dirname(file), target)
		const found = pointerInto(load(next), pointer)
		if (found === undefined) return undefined
		current = found
		file = next
	}
	return undefined
}

/** Walk a JSON pointer, undoing the `~1` escape a path like `/jobs/activation` needs. */
function pointerInto(
	doc: Record<string, unknown>,
	pointer: string,
): Record<string, unknown> | undefined {
	let current: unknown = doc
	for (const raw of pointer.split("/")) {
		if (raw === "") continue
		const key = raw.replace(/~1/g, "/").replace(/~0/g, "~")
		if (typeof current !== "object" || current === null) return undefined
		current = (current as Record<string, unknown>)[key]
	}
	return typeof current === "object" && current !== null
		? (current as Record<string, unknown>)
		: undefined
}

/** `activateJobs` → `activate-jobs`, which is the filename Camunda publishes the page at. */
function kebab(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[^A-Za-z0-9]+/g, "-")
		.toLowerCase()
		.replace(/^-+|-+$/g, "")
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : ""
}

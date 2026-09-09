import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Bpmn } from "../../src/bpmn/index.js"
import { PRESENTATION_PREFIXES } from "../../src/bpmn/semantic-hash.js"
import { xmlSignature } from "./xml-signature.js"

/**
 * Measures how much of the BPMN and Zeebe descriptor surface survives a round
 * trip through `@bpmnkit/core`.
 *
 * The model in `bpmn-model.ts` is hand-written, so it can fall behind the
 * specification without anything noticing — which is how the losses in
 * `doc/bpmn-sdk-comparison.md` §4 accumulated. This walks the vendored moddle
 * descriptors instead of a hand-maintained list, builds a minimal document
 * containing each type, and reports what came back.
 *
 * Nothing here asserts a mapping someone wrote down. A type is `modelled`,
 * `preserved` or `dropped` because a document containing it was actually parsed
 * and re-serialised.
 *
 * **One parent per type.** Each type is probed in the first container the
 * descriptors allow it in. A type preserved under a process but dropped under a
 * lane would show as preserved here; that narrower question belongs to the
 * round-trip corpus, where such a case can be written by hand.
 */

/** A moddle descriptor package, as `bpmn-moddle` ships it. */
interface Descriptor {
	name: string
	prefix: string
	uri: string
	types: DescriptorType[]
}

interface DescriptorType {
	name: string
	isAbstract?: boolean
	superClass?: string[]
	properties?: DescriptorProperty[]
}

interface DescriptorProperty {
	name: string
	type: string
	isAttr?: boolean
	isMany?: boolean
	isReference?: boolean
	isBody?: boolean
}

const DESCRIPTOR_DIRECTORY = join(import.meta.dirname, "..", "..", "descriptors")
const DESCRIPTOR_FILES = ["bpmn.json", "bpmndi.json", "dc.json", "di.json", "zeebe.json"]

const NAMESPACES: Record<string, string> = {
	bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
	bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
	dc: "http://www.omg.org/spec/DD/20100524/DC",
	di: "http://www.omg.org/spec/DD/20100524/DI",
	zeebe: "http://camunda.org/schema/zeebe/1.0",
	xsi: "http://www.w3.org/2001/XMLSchema-instance",
}

/** Primitive property types, which are attributes or text rather than elements. */
const PRIMITIVES = new Set(["String", "Boolean", "Integer", "Real"])

export type Coverage = "modelled" | "preserved" | "dropped" | "unprobed"

export interface TypeCoverage {
	/** Qualified type name, e.g. `bpmn:ServiceTask`. */
	type: string
	coverage: Coverage
	/** The container the probe placed it in. */
	parent?: string
	/** Why it could not be probed, when `unprobed`. */
	reason?: string
}

function loadDescriptors(): Descriptor[] {
	return DESCRIPTOR_FILES.map(
		(file) => JSON.parse(readFileSync(join(DESCRIPTOR_DIRECTORY, file), "utf-8")) as Descriptor,
	)
}

function qualify(prefix: string, name: string): string {
	return name.includes(":") ? name : `${prefix}:${name}`
}

interface TypeIndex {
	byName: Map<string, { descriptor: Descriptor; type: DescriptorType }>
	/** Every type that is `name` or extends it, transitively. */
	subtypesOf: Map<string, Set<string>>
	/** Container type → the types it may hold as elements. */
	contains: Map<string, Set<string>>
}

function buildIndex(descriptors: Descriptor[]): TypeIndex {
	const byName = new Map<string, { descriptor: Descriptor; type: DescriptorType }>()
	for (const descriptor of descriptors) {
		for (const type of descriptor.types) {
			byName.set(qualify(descriptor.prefix, type.name), { descriptor, type })
		}
	}

	// Transitive supertypes, then invert for subtypes.
	const supertypesOf = new Map<string, Set<string>>()
	const walkSupers = (name: string, into: Set<string>): void => {
		const entry = byName.get(name)
		for (const parent of entry?.type.superClass ?? []) {
			const qualified = qualify(entry?.descriptor.prefix ?? "", parent)
			if (into.has(qualified)) continue
			into.add(qualified)
			walkSupers(qualified, into)
		}
	}
	for (const name of byName.keys()) {
		const supers = new Set<string>()
		walkSupers(name, supers)
		supertypesOf.set(name, supers)
	}

	const subtypesOf = new Map<string, Set<string>>()
	for (const [name, supers] of supertypesOf) {
		subtypesOf.set(name, subtypesOf.get(name) ?? new Set([name]))
		subtypesOf.get(name)?.add(name)
		for (const parent of supers) {
			if (!subtypesOf.has(parent)) subtypesOf.set(parent, new Set([parent]))
			subtypesOf.get(parent)?.add(name)
		}
	}

	// A type may hold X wherever it — or anything it extends — declares a
	// non-attribute, non-reference property whose type is X or a subtype of X.
	const contains = new Map<string, Set<string>>()
	for (const [name, entry] of byName) {
		const holders = new Set<string>()
		const own = [name, ...(supertypesOf.get(name) ?? [])]
		for (const holder of own) {
			for (const property of byName.get(holder)?.type.properties ?? []) {
				if (property.isAttr || property.isReference || property.isBody) continue
				if (PRIMITIVES.has(property.type)) continue
				const qualified = qualify(byName.get(holder)?.descriptor.prefix ?? "", property.type)
				for (const concrete of subtypesOf.get(qualified) ?? [qualified]) holders.add(concrete)
			}
		}
		contains.set(name, holders)
	}

	return { byName, subtypesOf, contains }
}

/**
 * Where a type may legally appear, and how specifically the container asks for
 * it.
 *
 * Specificity matters because the descriptors contain very general slots —
 * `bpmn:Lane.partitionElement` is declared as `BaseElement`, so by the letter of
 * the schema a lane may contain almost anything. Probing a data association
 * inside a lane would be legal and useless. Ranking by how many types the
 * declared property accepts puts `bpmn:Activity.dataInputAssociations` ahead of
 * it.
 */
function parentsOf(index: TypeIndex, target: string): Array<{ parent: string; breadth: number }> {
	const parents: Array<{ parent: string; breadth: number }> = []

	for (const [name, entry] of index.byName) {
		if (entry.type.isAbstract) continue
		for (const holder of [name, ...collectSupers(index, name)]) {
			for (const property of index.byName.get(holder)?.type.properties ?? []) {
				if (property.isAttr || property.isReference || property.isBody) continue
				if (PRIMITIVES.has(property.type)) continue
				const declared = qualify(index.byName.get(holder)?.descriptor.prefix ?? "", property.type)
				if (!index.subtypesOf.get(declared)?.has(target)) continue
				parents.push({ parent: name, breadth: index.subtypesOf.get(declared)?.size ?? 1 })
			}
		}
	}

	return parents.sort((left, right) => left.breadth - right.breadth)
}

/** Shortest containment path from `bpmn:Definitions` down to `target`, concrete types only. */
function pathTo(index: TypeIndex, target: string): string[] | undefined {
	const start = "bpmn:Definitions"
	if (target === start) return [start]

	const queue: string[][] = [[start]]
	const seen = new Set([start])

	while (queue.length > 0) {
		const path = queue.shift() as string[]
		const head = path[path.length - 1] as string
		for (const child of index.contains.get(head) ?? []) {
			if (index.byName.get(child)?.type.isAbstract) continue
			if (child === target) return [...path, child]
			if (seen.has(child)) continue
			if ((index.contains.get(child)?.size ?? 0) === 0) continue
			seen.add(child)
			queue.push([...path, child])
		}
	}
	return undefined
}

/** Descriptor packages that extend BPMN rather than defining it. */
function isExtensionPackage(prefix: string): boolean {
	return prefix !== "bpmn" && !PRESENTATION_PREFIXES.has(prefix)
}

/**
 * The nesting to probe a type in.
 *
 * Extension types (`zeebe:*`) are not *contained* by BPMN types — they extend
 * them, and at the XML level they live inside `bpmn:extensionElements`. The
 * containment graph cannot see that, so they get an explicit placement.
 */
function probePath(index: TypeIndex, target: string): string[] | undefined {
	const prefix = index.byName.get(target)?.descriptor.prefix ?? ""
	if (isExtensionPackage(prefix)) {
		return [
			"bpmn:Definitions",
			"bpmn:Process",
			"bpmn:ServiceTask",
			"bpmn:ExtensionElements",
			target,
		]
	}

	for (const { parent } of parentsOf(index, target)) {
		const path = pathTo(index, parent)
		if (path) return [...path, target]
	}
	return pathTo(index, target)
}

function localName(qualified: string): string {
	const colon = qualified.indexOf(":")
	return colon === -1 ? qualified : qualified.slice(colon + 1)
}

function prefixOf(qualified: string): string {
	const colon = qualified.indexOf(":")
	return colon === -1 ? "" : qualified.slice(0, colon)
}

/** The XML element name moddle would serialise this type as. */
function elementName(index: TypeIndex, qualified: string): string {
	const entry = index.byName.get(qualified)
	const prefix = entry?.descriptor.prefix ?? prefixOf(qualified)
	const name = localName(qualified)
	// BPMN element names are lower-camel; DI keeps the type name as written.
	return PRESENTATION_PREFIXES.has(prefix)
		? `${prefix}:${name}`
		: `${prefix}:${name[0]?.toLowerCase() ?? ""}${name.slice(1)}`
}

/**
 * Minimal attributes for an element of this type: an `id` where the type has
 * one, plus a placeholder for every attribute that is a reference, since the
 * parser requires several of them to be present.
 */
function attributesFor(index: TypeIndex, qualified: string, id: string): Record<string, string> {
	const attributes: Record<string, string> = {}
	const entry = index.byName.get(qualified)
	const chain = [qualified, ...collectSupers(index, qualified)]

	for (const name of chain) {
		for (const property of index.byName.get(name)?.type.properties ?? []) {
			if (!property.isAttr) continue
			// The parser requires several reference attributes to be present at all
			// (`sourceRef`, `attachedToRef`), so give every one a placeholder.
			if (property.name === "id") attributes.id = id
			else if (property.isReference) attributes[property.name] = `${id}_ref`
		}
	}
	if (entry?.type.name === "Definitions") attributes.targetNamespace = "http://example.invalid"
	return attributes
}

function collectSupers(index: TypeIndex, qualified: string): string[] {
	const out: string[] = []
	const visit = (name: string): void => {
		const entry = index.byName.get(name)
		for (const parent of entry?.type.superClass ?? []) {
			const q = qualify(entry?.descriptor.prefix ?? "", parent)
			if (out.includes(q)) continue
			out.push(q)
			visit(q)
		}
	}
	visit(qualified)
	return out
}

function renderAttributes(attributes: Record<string, string>): string {
	return Object.entries(attributes)
		.map(([name, value]) => ` ${name}="${value}"`)
		.join("")
}

/** Builds a document with `path` nested from the root, innermost type last. */
function documentFor(index: TypeIndex, path: string[]): string {
	const declarations = Object.entries(NAMESPACES)
		.map(([prefix, uri]) => ` xmlns:${prefix}="${uri}"`)
		.join("")

	let inner = ""
	for (let depth = path.length - 1; depth >= 1; depth--) {
		const type = path[depth] as string
		const name = elementName(index, type)
		const attributes = renderAttributes(attributesFor(index, type, `Probe_${depth}`))
		// An element whose content is character data is dropped when it is empty,
		// which would read as a gap rather than as an empty probe.
		const body = inner === "" ? (bodyTextFor(index, type) ?? "") : inner
		inner = body === "" ? `<${name}${attributes} />` : `<${name}${attributes}>${body}</${name}>`
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions${declarations} id="Definitions_probe" targetNamespace="http://example.invalid">
${inner}
</bpmn:definitions>`
}

/**
 * Probes every concrete type in the descriptors and reports what a round trip
 * does to it.
 */
export function descriptorCoverage(): TypeCoverage[] {
	const descriptors = loadDescriptors()
	const index = buildIndex(descriptors)
	const results: TypeCoverage[] = []

	for (const [qualified, entry] of index.byName) {
		if (entry.type.isAbstract) continue
		if (PRESENTATION_PREFIXES.has(entry.descriptor.prefix)) continue
		if (qualified === "bpmn:Definitions") continue

		const path = probePath(index, qualified)
		if (!path) {
			results.push({
				type: qualified,
				coverage: "unprobed",
				reason: "no containment path from bpmn:definitions",
			})
			continue
		}

		const parent = path[path.length - 2] as string
		const source = documentFor(index, path)
		const name = elementName(index, qualified)

		let exported: string
		try {
			exported = Bpmn.export(Bpmn.parse(source))
		} catch (error) {
			results.push({
				type: qualified,
				coverage: "unprobed",
				parent,
				reason: error instanceof Error ? error.message : String(error),
			})
			continue
		}

		const survived = (xmlSignature(exported).get(`element:${name}`) ?? 0) > 0
		if (!survived) {
			results.push({ type: qualified, coverage: "dropped", parent })
			continue
		}

		results.push({
			type: qualified,
			coverage: viaUnknownChildren(source, name) ? "preserved" : "modelled",
			parent,
		})
	}

	return results.sort((left, right) => left.type.localeCompare(right.type))
}

/** Types whose content is character data, which must not be probed empty. */
function bodyTextFor(index: TypeIndex, qualified: string): string | undefined {
	for (const name of [qualified, ...collectSupers(index, qualified)]) {
		for (const property of index.byName.get(name)?.type.properties ?? []) {
			if (property.isBody) return "probe text"
		}
	}
	return undefined
}

/** Whether the parser kept this element as raw XML rather than a typed field. */
function viaUnknownChildren(source: string, name: string): boolean {
	const seen = new Set<string>()
	const walk = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const entry of value) walk(entry)
			return
		}
		if (typeof value !== "object" || value === null) return
		const record = value as Record<string, unknown>
		if (Array.isArray(record.unknownChildren)) {
			for (const child of record.unknownChildren) {
				const element = child as { name?: unknown }
				if (typeof element.name === "string") seen.add(element.name)
			}
		}
		for (const entry of Object.values(record)) walk(entry)
	}
	walk(Bpmn.parse(source))
	return seen.has(name)
}

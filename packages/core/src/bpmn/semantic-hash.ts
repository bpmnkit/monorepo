import type { BpmnDefinitions } from "./bpmn-model.js"
import { sha256Hex } from "./sha256.js"

/**
 * A presentation-free, canonical view of a BPMN model, and a hash over it.
 *
 * Two documents that mean the same thing hash the same, however they are laid
 * out, ordered or formatted. That turns a claim into an assertion: re-running
 * auto-layout, or re-serialising a file, cannot change the hash — if it does,
 * something touched the model, not the diagram.
 *
 * What is excluded, and why:
 *
 * - **Diagram interchange** (`diagrams`) entirely — shapes, edges, waypoints and
 *   their `bioc`/`color` extensions are where a layout lives.
 * - **`zeebe:modelerTemplateIcon`** — a base64 icon that would otherwise
 *   dominate every diff it appears in.
 * - **`exporter` / `exporterVersion`** — which tool wrote the file, not what the
 *   file says. The same model exported by two tools hashes the same.
 *
 * `modeler:executionPlatform` and its version are deliberately **kept**: they
 * name the engine the model targets, so changing them is a real change. This
 * differs from some other implementations; flip it here if that is not wanted.
 *
 * Ordering carries no meaning in BPMN — `flowElements` may appear in any order —
 * so collections are sorted canonically and object keys are sorted by name.
 */

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/** Attribute names dropped wherever they appear. */
const EXCLUDED_ATTRIBUTES = new Set(["zeebe:modelerTemplateIcon"])

/**
 * Namespace prefixes that carry presentation rather than meaning.
 *
 * Named once so the two things that need the notion cannot disagree about what
 * counts as presentation: this module, and the descriptor coverage check, which
 * treats these packages as handled structurally by the diagram model rather than
 * as gaps.
 *
 * They are excluded here in two different ways, which is why the list is not
 * itself the attribute filter. `bpmndi` / `dc` / `di` describe the diagram, and
 * the diagram is dropped wholesale via the `diagrams` key. `bioc` and `color`
 * are extension *attributes* that ride on diagram elements, so they are dropped
 * by name wherever they appear.
 */
export const PRESENTATION_PREFIXES: ReadonlySet<string> = new Set([
	"bpmndi",
	"dc",
	"di",
	"bioc",
	"color",
])

/** The subset of the above excluded per-attribute rather than per-subtree. */
const EXCLUDED_ATTRIBUTE_PREFIXES = ["bioc:", "color:"] as const

/** Top-level `BpmnDefinitions` keys that describe the exporter or the diagram. */
const EXCLUDED_DEFINITIONS_KEYS = new Set(["diagrams", "exporter", "exporterVersion"])

function isExcludedAttribute(name: string): boolean {
	return (
		EXCLUDED_ATTRIBUTES.has(name) ||
		EXCLUDED_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Canonicalises a value: drops empties, sorts object keys, and sorts array
 * entries by their own canonical form so ordering cannot affect the result.
 */
function canonicalise(value: unknown, excludedKeys?: ReadonlySet<string>): JsonValue | undefined {
	if (value === undefined || value === null) return undefined
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value
	}

	if (Array.isArray(value)) {
		const entries = value
			.map((entry) => canonicalise(entry))
			.filter((entry): entry is JsonValue => entry !== undefined)
			.map((entry) => [JSON.stringify(entry), entry] as const)
			.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
			.map(([, entry]) => entry)
		return entries.length > 0 ? entries : undefined
	}

	if (!isRecord(value)) return undefined

	const result: Record<string, JsonValue> = {}
	for (const key of Object.keys(value).sort()) {
		if (excludedKeys?.has(key)) continue
		if (isExcludedAttribute(key)) continue
		const projected = canonicalise(value[key])
		if (projected !== undefined) result[key] = projected
	}
	return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Replaces every descendant that carries its own `id` with that id, so an
 * element's projection describes the element and not its whole subtree.
 */
function shallow(value: JsonValue): JsonValue {
	if (Array.isArray(value)) return value.map(shallow)
	if (typeof value !== "object" || value === null) return value

	const result: Record<string, JsonValue> = {}
	for (const [key, entry] of Object.entries(value)) {
		if (key === "id") {
			result[key] = entry
			continue
		}
		if (Array.isArray(entry)) {
			result[key] = entry.map((item) =>
				isRecord(item) && typeof item.id === "string" ? item.id : shallow(item as JsonValue),
			)
			continue
		}
		result[key] =
			isRecord(entry) && typeof entry.id === "string" ? entry.id : shallow(entry as JsonValue)
	}
	return result
}

function collectElements(value: JsonValue, into: Map<string, JsonValue>): void {
	if (Array.isArray(value)) {
		for (const entry of value) collectElements(entry, into)
		return
	}
	if (!isRecord(value)) return

	if (typeof value.id === "string") {
		into.set(value.id, shallow(value))
	}
	for (const entry of Object.values(value)) {
		collectElements(entry as JsonValue, into)
	}
}

/** A canonical view of a model, plus a per-element index for diffing. */
export interface SemanticProjection {
	/** Canonical JSON of the whole model, presentation excluded. */
	readonly value: JsonValue
	/**
	 * One entry per element that carries an `id`, projected shallowly —
	 * descendants with their own id appear as that id, so a change is attributed
	 * to the element that actually changed rather than to all its ancestors.
	 */
	readonly elements: ReadonlyMap<string, JsonValue>
}

/**
 * Projects a model onto its canonical, presentation-free form.
 *
 * @param definitions - The model to project.
 */
export function projectSemantics(definitions: BpmnDefinitions): SemanticProjection {
	const value = canonicalise(definitions, EXCLUDED_DEFINITIONS_KEYS) ?? {}
	const elements = new Map<string, JsonValue>()
	collectElements(value, elements)
	return { value, elements }
}

/**
 * Returns the SHA-256 of a model's canonical projection.
 *
 * Stable across formatting, element order, attribute order and any change to
 * the diagram. Use it to tell "the model changed" from "the picture moved".
 *
 * @param definitions - The model to hash.
 */
export function semanticHash(definitions: BpmnDefinitions): string {
	return sha256Hex(JSON.stringify(projectSemantics(definitions).value))
}

/** What changed between two models, keyed by element id. */
export interface SemanticDiff {
	/** Ids present only in the later model. */
	added: string[]
	/** Ids present only in the earlier model. */
	removed: string[]
	/** Ids whose own projection differs, with both sides. */
	changed: Array<{ id: string; before: JsonValue; after: JsonValue }>
}

/**
 * Compares two models element by element.
 *
 * @param before - The earlier model.
 * @param after - The later model.
 * @returns Ids added, removed, and changed — the report a write boundary or a
 *   review loop shows a user before touching anything.
 */
export function diffSemantics(before: BpmnDefinitions, after: BpmnDefinitions): SemanticDiff {
	const left = projectSemantics(before).elements
	const right = projectSemantics(after).elements

	const added = [...right.keys()].filter((id) => !left.has(id)).sort()
	const removed = [...left.keys()].filter((id) => !right.has(id)).sort()
	const changed = [...right.keys()]
		.filter((id) => left.has(id))
		.sort()
		.flatMap((id) => {
			const earlier = left.get(id) as JsonValue
			const later = right.get(id) as JsonValue
			return JSON.stringify(earlier) === JSON.stringify(later)
				? []
				: [{ id, before: earlier, after: later }]
		})

	return { added, removed, changed }
}

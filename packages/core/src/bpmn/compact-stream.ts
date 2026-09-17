/**
 * The diagram a model is writing, read out of the tokens as they arrive.
 *
 * A language model emits a diagram one character at a time, so the shape of a
 * process is knowable long before its last token. Nothing downstream can use a
 * half-written document, though: `JSON.parse` wants the closing brace, and the
 * outermost one — the tool argument's own wrapper — is the very last character
 * sent.
 *
 * So this does not parse the document. It picks complete `{…}` object literals
 * out of the text as they close and keeps the ones shaped like a
 * {@link CompactElement} or a {@link CompactFlow}, which are the innermost
 * objects and therefore the first to finish. That is also what makes it
 * indifferent to what it is reading: a `replace_diagram` argument, a ```json
 * block in an assistant's prose, or the body of a `compose_diagram` snippet all
 * carry the same literals, and none of them have to be valid as a whole.
 *
 * **Frames are advisory.** Everything here is a guess at an unfinished
 * document, and the caller is expected to have an authoritative result coming.
 * That is what lets it drop what it cannot place instead of reporting an error,
 * and why it never throws on input.
 *
 * @packageDocumentation
 */

import type { BpmnDefinitions } from "./bpmn-model.js"
import { expand } from "./compact.js"
import type { CompactDiagram, CompactElement, CompactFlow } from "./compact.js"
import { ELEMENT_TYPE_GROUPS } from "./element-catalog.js"

/** Options for {@link createCompactStream}. */
export interface CompactStreamOptions {
	/**
	 * The diagram being edited.
	 *
	 * A model changing an existing process streams only what it is adding, so
	 * without this a frame is a disconnected fragment rather than the diagram
	 * with the fragment in it. Only the first process is previewed; a frame is
	 * one process, whatever the document turns out to hold.
	 */
	base?: CompactDiagram | null
}

/** A diagram assembled from a text stream. See {@link createCompactStream}. */
export interface CompactStream {
	/**
	 * Adds the next piece of text.
	 *
	 * @returns The diagram as it now stands, or `null` when this chunk added
	 * nothing renderable — no new element, or not enough for a diagram yet.
	 */
	push(chunk: string): BpmnDefinitions | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Reads a diagram out of a stream of text.
 *
 * @param options - See {@link CompactStreamOptions}.
 *
 * @example
 * ```typescript
 * const stream = createCompactStream({ base: currentDiagram })
 * for await (const chunk of tokens) {
 *   const defs = stream.push(chunk)
 *   if (defs) render(defs)
 * }
 * ```
 */
export function createCompactStream(options?: CompactStreamOptions): CompactStream {
	const baseProcess = options?.base?.processes[0]
	const elements = new Map<string, CompactElement>()
	const flows = new Map<string, CompactFlow>()
	for (const element of baseProcess?.elements ?? []) elements.set(element.id, element)
	for (const flow of baseProcess?.flows ?? []) flows.set(flow.id, flow)

	const documentId = options?.base?.id ?? "Definitions_1"
	const processId = baseProcess?.id ?? "Process_1"
	const processName = baseProcess?.name

	let text = ""
	/** How far `scan` has read. Every character is looked at exactly once. */
	let read = 0
	/** Offsets of the `{`s that are still open, outermost first. */
	const open: number[] = []
	let inString = false
	let escaped = false
	let changed = false

	/** Drops a container's contents from the top level — they belong to it. */
	function forget(children: CompactElement["children"]): void {
		for (const child of children?.elements ?? []) {
			elements.delete(child.id)
			forget(child.children)
		}
		for (const flow of children?.flows ?? []) flows.delete(flow.id)
	}

	/** Keeps `value` if it is an element or a flow. */
	function take(value: unknown): void {
		if (!isRecord(value) || typeof value.id !== "string" || value.id === "") return

		if (typeof value.type === "string" && Object.hasOwn(ELEMENT_TYPE_GROUPS, value.type)) {
			const element = value as unknown as CompactElement
			forget(element.children)
			elements.set(element.id, element)
			changed = true
			return
		}

		if (typeof value.from === "string" && typeof value.to === "string") {
			// `isDefault` is dropped rather than carried: `expand` throws when a flow
			// claims a gateway that has not been written yet, which during a stream is
			// most of the time. A preview without the marker beats no preview.
			const { isDefault: _dropped, ...flow } = value as unknown as CompactFlow
			flows.set(flow.id, flow)
			changed = true
		}
	}

	/**
	 * Reads the new text once, taking each literal at the `}` that closes it.
	 *
	 * A brace stack rather than a re-scan: every character is looked at exactly
	 * once across the whole stream, and each literal is considered exactly once,
	 * innermost first — so a container is seen after the children it has to
	 * reclaim, and the tool argument's own wrapper is not waited on.
	 */
	function scan(): void {
		for (; read < text.length; read++) {
			const ch = text[read]
			if (escaped) {
				escaped = false
				continue
			}
			if (ch === "\\") {
				escaped = true
				continue
			}
			if (ch === '"') {
				inString = !inString
				continue
			}
			if (inString) continue
			if (ch === "{") {
				open.push(read)
				continue
			}
			if (ch !== "}") continue
			const start = open.pop()
			if (start === undefined) continue // a stray brace in prose
			try {
				take(JSON.parse(text.slice(start, read + 1)))
			} catch {
				/* not a literal we can read */
			}
		}
	}

	return {
		push(chunk: string): BpmnDefinitions | null {
			text += chunk
			scan()
			if (!changed) return null
			changed = false

			const kept = [...elements.values()]
			if (kept.length === 0) return null
			const known = new Set(kept.map((element) => element.id))
			const diagram: CompactDiagram = {
				id: documentId,
				processes: [
					{
						id: processId,
						name: processName,
						elements: kept,
						// A flow whose other end has not been written yet lays out as
						// nothing; one naming an element that never arrives would too.
						flows: [...flows.values()].filter((flow) => known.has(flow.from) && known.has(flow.to)),
					},
				],
			}
			try {
				return expand(diagram)
			} catch {
				return null // an element whose fields have not all arrived
			}
		},
	}
}

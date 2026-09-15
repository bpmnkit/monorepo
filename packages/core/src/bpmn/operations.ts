import { assertCompactDiagram } from "./argument-guards.js"
import type { CompactDiagram, CompactElement, CompactFlow, CompactProcess } from "./compact.js"

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * An atomic edit operation on a {@link CompactDiagram}.
 * All element/flow references use stable string IDs, not array positions.
 *
 * Used by {@link applyOperations} to apply AI-suggested improvements without
 * regenerating the full BPMN XML.
 */
export type BpmnOperation =
	/** Rename an element. */
	| { op: "rename"; id: string; name: string }
	/** Patch arbitrary fields of an element (type-safe subset of CompactElement). */
	| { op: "update"; id: string; patch: Partial<CompactElement> }
	/** Remove an element by ID. */
	| { op: "delete"; id: string }
	/**
	 * Insert a new element.
	 * Optionally place it after or before an existing element ID.
	 * Use `parent` to insert inside a sub-process container.
	 */
	| { op: "insert"; element: CompactElement; after?: string; before?: string; parent?: string }
	/**
	 * Add a sequence flow between two existing elements.
	 * Use `parent` when both elements are inside a sub-process.
	 */
	| {
			op: "add_flow"
			id?: string
			from: string
			to: string
			condition?: string
			name?: string
			parent?: string
	  }
	/** Remove a sequence flow by ID. */
	| { op: "delete_flow"; id: string }
	/** Redirect a sequence flow to a different source or target. */
	| { op: "redirect_flow"; id: string; from?: string; to?: string }

// ── Internal helpers ──────────────────────────────────────────────────────────

type ElementContainer = { elements: CompactElement[]; flows: CompactFlow[] }

function findElementIn(
	container: ElementContainer,
	id: string,
): { container: ElementContainer; element: CompactElement; index: number } | null {
	for (let i = 0; i < container.elements.length; i++) {
		const el = container.elements[i]
		if (!el) continue
		if (el.id === id) return { container, element: el, index: i }
		if (el.children) {
			const found = findElementIn(el.children, id)
			if (found) return found
		}
	}
	return null
}

function findFlowIn(
	container: ElementContainer,
	id: string,
): { container: ElementContainer; flow: CompactFlow; index: number } | null {
	for (let i = 0; i < container.flows.length; i++) {
		const f = container.flows[i]
		if (!f) continue
		if (f.id === id) return { container, flow: f, index: i }
	}
	for (const el of container.elements) {
		if (el.children) {
			const found = findFlowIn(el.children, id)
			if (found) return found
		}
	}
	return null
}

function resolveContainer(process: CompactProcess, parentId?: string): ElementContainer {
	if (!parentId) return process
	const found = findElementIn(process, parentId)
	if (!found) return process
	if (!found.element.children) found.element.children = { elements: [], flows: [] }
	return found.element.children
}

function nextFlowId(process: CompactProcess): string {
	const ids = new Set<string>()
	const collect = (c: ElementContainer) => {
		for (const f of c.flows) ids.add(f.id)
		for (const e of c.elements) if (e.children) collect(e.children)
	}
	collect(process)
	let n = ids.size + 1
	while (ids.has(`flow_${n}`)) n++
	return `flow_${n}`
}

function applyOne(diagram: CompactDiagram, op: BpmnOperation): void {
	for (const process of diagram.processes) {
		switch (op.op) {
			case "rename": {
				const found = findElementIn(process, op.id)
				if (found) found.element.name = op.name
				break
			}
			case "update": {
				const found = findElementIn(process, op.id)
				if (found) Object.assign(found.element, op.patch)
				break
			}
			case "delete": {
				const found = findElementIn(process, op.id)
				if (found) found.container.elements.splice(found.index, 1)
				break
			}
			case "insert": {
				const container = resolveContainer(process, op.parent)
				if (op.after !== undefined) {
					const idx = container.elements.findIndex((e) => e.id === op.after)
					container.elements.splice(idx >= 0 ? idx + 1 : container.elements.length, 0, op.element)
				} else if (op.before !== undefined) {
					const idx = container.elements.findIndex((e) => e.id === op.before)
					container.elements.splice(idx >= 0 ? idx : 0, 0, op.element)
				} else {
					container.elements.push(op.element)
				}
				break
			}
			case "add_flow": {
				const container = resolveContainer(process, op.parent)
				const flow: CompactFlow = {
					id: op.id ?? nextFlowId(process),
					from: op.from,
					to: op.to,
				}
				if (op.name) flow.name = op.name
				if (op.condition) flow.condition = op.condition
				container.flows.push(flow)
				break
			}
			case "delete_flow": {
				const found = findFlowIn(process, op.id)
				if (found) found.container.flows.splice(found.index, 1)
				break
			}
			case "redirect_flow": {
				const found = findFlowIn(process, op.id)
				if (found) {
					if (op.from !== undefined) found.flow.from = op.from
					if (op.to !== undefined) found.flow.to = op.to
				}
				break
			}
		}
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply a list of {@link BpmnOperation}s to a {@link CompactDiagram}, returning
 * a new diagram (the original is not mutated).
 *
 * Operations are applied in order. Element and flow references use stable IDs
 * so operations survive concurrent unrelated insertions.
 *
 * @example
 * ```typescript
 * const updated = applyOperations(compact, [
 *   { op: "rename", id: "task_1", name: "Approve Invoice" },
 *   { op: "insert", element: { id: "t_notify", type: "userTask", name: "Notify Finance" }, after: "task_1" },
 *   { op: "add_flow", from: "t_notify", to: "end_1" },
 * ])
 * const xml = Bpmn.export(expand(updated))
 * ```
 *
 * @throws {TypeError} When `diagram` is not a CompactDiagram. Raw XML is the
 *   easy mistake — `compactify(Bpmn.parse(xml))` is the way in.
 */
export function applyOperations(diagram: CompactDiagram, ops: BpmnOperation[]): CompactDiagram {
	assertCompactDiagram(diagram, "applyOperations")
	const result: CompactDiagram = structuredClone(diagram)
	for (const op of ops) {
		applyOne(result, op)
	}
	return result
}

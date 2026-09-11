/**
 * What the room will accept as a document.
 *
 * An op arrives from a browser the room does not trust, is replayed, and
 * produces a new document. Before that document becomes the drop's state it has
 * to be one that can be served back: no two elements sharing an id, no flow
 * pointing at something that is not there, nothing on the canvas without a
 * shape to draw it with. A document failing any of those renders as a broken
 * diagram for every viewer, and the version log would faithfully preserve the
 * breakage.
 *
 * So this is a gate, not a linter. It answers one question — *may this be
 * stored?* — and the answer travels back to the writer as a reason rather than
 * as a silent no-op. Everything softer (an unreachable task, a gateway with one
 * outgoing flow) is `lintDiagram`'s business and none of this function's.
 *
 * The checks are deliberately cheap: one walk to collect ids, one to resolve
 * references. Ops arrive at drag speed, and this runs on every one.
 */
import type { BpmnDefinitions, BpmnFlowElement } from "@bpmnkit/core"
import { checkDiCompleteness } from "@bpmnkit/core"

/** Why a document was refused. `detail` names the element, for the writer. */
export interface IntegrityProblem {
	kind: "duplicate-id" | "dangling-ref" | "missing-di" | "orphan-di"
	detail: string
}

/** A sub-process-like element: the fields `walk` recurses through. */
interface Nested {
	flowElements?: BpmnFlowElement[]
	sequenceFlows?: Array<{ id: string; sourceRef: string; targetRef: string }>
	textAnnotations?: Array<{ id: string }>
	associations?: Array<{ id: string; sourceRef: string; targetRef: string }>
	groups?: Array<{ id: string }>
}

/** A flow node that hangs off an activity — the one reference a shape can carry. */
interface Attachable {
	attachedToRef?: string
}

/**
 * The first thing wrong with `defs`, or `null` when it may be stored.
 *
 * First rather than all: the writer's next action is to undo, and a list of
 * consequences is no more useful for that than the first cause.
 */
export function checkIntegrity(defs: BpmnDefinitions): IntegrityProblem | null {
	const ids = new Set<string>()
	let duplicate: string | null = null

	/** Records an id, remembering the first collision. */
	const claim = (id: string): void => {
		if (ids.has(id)) duplicate ??= id
		else ids.add(id)
	}

	/** Every reference to check once the id set is complete. */
	const refs: Array<{ from: string; to: string }> = []

	const walk = (scope: Nested): void => {
		for (const el of scope.flowElements ?? []) {
			claim(el.id)
			const attached = (el as Attachable).attachedToRef
			if (attached) refs.push({ from: el.id, to: attached })
			walk(el as Nested)
		}
		for (const flow of scope.sequenceFlows ?? []) {
			claim(flow.id)
			refs.push({ from: flow.id, to: flow.sourceRef }, { from: flow.id, to: flow.targetRef })
		}
		for (const ta of scope.textAnnotations ?? []) claim(ta.id)
		for (const assoc of scope.associations ?? []) {
			claim(assoc.id)
			refs.push({ from: assoc.id, to: assoc.sourceRef }, { from: assoc.id, to: assoc.targetRef })
		}
		for (const group of scope.groups ?? []) claim(group.id)
	}

	for (const process of defs.processes) walk(process)
	for (const collab of defs.collaborations) {
		for (const participant of collab.participants) claim(participant.id)
		for (const mf of collab.messageFlows) {
			claim(mf.id)
			if (mf.sourceRef) refs.push({ from: mf.id, to: mf.sourceRef })
			if (mf.targetRef) refs.push({ from: mf.id, to: mf.targetRef })
		}
	}

	if (duplicate) return { kind: "duplicate-id", detail: duplicate }

	for (const ref of refs) {
		if (!ids.has(ref.to)) {
			return { kind: "dangling-ref", detail: `${ref.from} → ${ref.to}` }
		}
	}

	// DI shares the document's id space, so its ids go through the same claim —
	// but a shape resolves against the *model*, which is why that set is taken
	// before these are added to it.
	const modelIds = new Set(ids)
	for (const diagram of defs.diagrams) {
		for (const shape of diagram.plane.shapes) claim(shape.id)
		for (const edge of diagram.plane.edges) claim(edge.id)
	}
	if (duplicate) return { kind: "duplicate-id", detail: duplicate }

	for (const diagram of defs.diagrams) {
		for (const shape of diagram.plane.shapes) {
			// A pool's process lives at the top level rather than among the flow
			// elements, so a shape drawn for one resolves against the plane's owner.
			if (!modelIds.has(shape.bpmnElement) && !isPlaneOwner(defs, shape.bpmnElement)) {
				return { kind: "orphan-di", detail: `shape ${shape.id} → ${shape.bpmnElement}` }
			}
		}
		for (const edge of diagram.plane.edges) {
			if (!modelIds.has(edge.bpmnElement)) {
				return { kind: "orphan-di", detail: `edge ${edge.id} → ${edge.bpmnElement}` }
			}
		}
	}

	const di = checkDiCompleteness(defs)
	const missing = di.missingShapes[0] ?? di.missingEdges[0]
	if (missing) return { kind: "missing-di", detail: missing }

	return null
}

/** True when the id names a process or collaboration — what a plane is drawn for. */
function isPlaneOwner(defs: BpmnDefinitions, id: string): boolean {
	return (
		defs.processes.some((p) => p.id === id) ||
		defs.collaborations.some((c) => c.id === id) ||
		defs.diagrams.some((d) => d.plane.bpmnElement === id)
	)
}

/** A one-line explanation of a refusal, for the writer's console. */
export function describeProblem(problem: IntegrityProblem): string {
	switch (problem.kind) {
		case "duplicate-id":
			return `two elements would share the id "${problem.detail}"`
		case "dangling-ref":
			return `a reference would point at nothing (${problem.detail})`
		case "orphan-di":
			return `the diagram would draw an element that does not exist (${problem.detail})`
		case "missing-di":
			return `"${problem.detail}" would have nothing to draw it with`
	}
}

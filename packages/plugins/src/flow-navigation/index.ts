/**
 * @bpmnkit/canvas-plugin-flow-navigation — keyboard traversal along sequence flows.
 *
 * Keyboard modelling works until the first branch. After appending a task
 * behind a gateway the cursor sits on the new task, and there is no keyboard
 * way back to the gateway to append the other branch — so the hand goes to the
 * mouse. This adds the traversal that closes that gap: Tab follows the flow
 * out, Shift+Tab follows it back, and at a fan-out Tab picks between the
 * outgoing flows rather than guessing.
 *
 * ## Keys
 *
 * | Key | Where | Does |
 * |---|---|---|
 * | `Tab` | shape with one outgoing flow | move to its target |
 * | `Tab` | shape with several | select the first outgoing flow |
 * | `Tab` | a selected flow | cycle to the next sibling flow |
 * | `Shift+Tab` | shape | move back along an incoming flow |
 * | `Enter` | a selected flow | follow it to its target |
 * | `Enter` | collapsed sub-process | drill into it |
 * | `u` | inside a sub-process | drill back out |
 * | `Escape` | a selected flow | drop the selection |
 *
 * The canvas binds Tab itself, to the next shape in document order. This
 * plugin intercepts in the capture phase and only stops the event when it has
 * somewhere to go, so an element with no flows still falls through to that
 * document-order walk rather than trapping the user.
 *
 * ## Usage
 * ```typescript
 * import { createFlowNavigationPlugin } from "@bpmnkit/plugins/flow-navigation";
 *
 * new BpmnCanvas({ container, xml, plugins: [createFlowNavigationPlugin()] });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectFlowNavigationStyles } from "./css.js"

export { FLOW_NAVIGATION_CSS, FLOW_NAVIGATION_STYLE_ID, injectFlowNavigationStyles } from "./css.js"

const CURSOR_CLASS = "bpmnkit-flownav-cursor"
const CANDIDATE_CLASS = "bpmnkit-flownav-candidate"

/** Element types that open a plane of their own when drilled into. */
const DRILLABLE = new Set(["subProcess", "transaction", "adHocSubProcess", "eventSubProcess"])

export interface FlowNavigationOptions {
	/** Called whenever the cursor moves, with the element it moved to. */
	onMove?: (elementId: string) => void
}

export interface FlowNavigationApi {
	/** The element the keyboard cursor is on, or `null`. */
	getCursor(): string | null
	/** Moves the cursor to an element, centring it. */
	setCursor(elementId: string | null): void
	/** The flow currently selected at a fan-out, or `null`. */
	getCandidate(): string | null
}

interface Flow {
	id: string
	sourceRef: string
	targetRef: string
}

/** Sequence flows of a process and of every container nested in it. */
function collectFlows(definitions: BpmnDefinitions): Flow[] {
	const flows: Flow[] = []

	for (const process of definitions.processes) {
		const containers: Array<{
			sequenceFlows?: Flow[]
			flowElements?: Array<{ type?: string }>
		}> = [process as never]

		while (containers.length > 0) {
			const container = containers.pop()
			if (container === undefined) continue
			for (const flow of container.sequenceFlows ?? []) {
				flows.push({ id: flow.id, sourceRef: flow.sourceRef, targetRef: flow.targetRef })
			}
			for (const element of container.flowElements ?? []) {
				const nested = element as { sequenceFlows?: Flow[]; flowElements?: unknown[] }
				if (nested.sequenceFlows !== undefined || nested.flowElements !== undefined) {
					containers.push(nested as never)
				}
			}
		}
	}

	return flows
}

/**
 * Creates the flow-navigation plugin.
 *
 * @param options - A hook called on every cursor move.
 */
export function createFlowNavigationPlugin(
	options: FlowNavigationOptions = {},
): CanvasPlugin & { api: FlowNavigationApi } {
	let canvasApi: CanvasApi | null = null
	let flows: Flow[] = []
	let elementTypes = new Map<string, string>()
	let cursor: string | null = null
	/** The fan-out being chosen from: its flows, and which one is selected. */
	let candidates: string[] = []
	let candidateIndex = -1
	const unsubs: Array<() => void> = []

	// ── Model index ──────────────────────────────────────────────────────────

	function index(definitions: BpmnDefinitions): void {
		flows = collectFlows(definitions)
		elementTypes = new Map()
		for (const process of definitions.processes) {
			const stack: Array<{ flowElements?: Array<{ id: string; type: string }> }> = [
				process as never,
			]
			while (stack.length > 0) {
				const container = stack.pop()
				if (container === undefined) continue
				for (const element of container.flowElements ?? []) {
					elementTypes.set(element.id, element.type)
					const nested = element as unknown as { flowElements?: unknown[] }
					if (nested.flowElements !== undefined) stack.push(nested as never)
				}
			}
		}
	}

	function outgoing(elementId: string): Flow[] {
		return flows.filter((f) => f.sourceRef === elementId)
	}

	function incoming(elementId: string): Flow[] {
		return flows.filter((f) => f.targetRef === elementId)
	}

	// ── Rendering ────────────────────────────────────────────────────────────

	function rendered(): Map<string, SVGGElement> {
		const api = canvasApi
		const elements = new Map<string, SVGGElement>()
		if (api === null) return elements
		for (const shape of api.getShapes()) elements.set(shape.id, shape.element)
		for (const edge of api.getEdges()) elements.set(edge.id, edge.element)
		return elements
	}

	function paint(): void {
		const api = canvasApi
		if (api === null) return
		for (const el of api.viewportEl.querySelectorAll(`.${CURSOR_CLASS},.${CANDIDATE_CLASS}`)) {
			el.classList.remove(CURSOR_CLASS, CANDIDATE_CLASS)
		}
		const elements = rendered()
		if (cursor !== null) elements.get(cursor)?.classList.add(CURSOR_CLASS)
		const candidate = candidates[candidateIndex]
		if (candidate !== undefined) elements.get(candidate)?.classList.add(CANDIDATE_CLASS)
	}

	function moveTo(elementId: string): void {
		cursor = elementId
		candidates = []
		candidateIndex = -1
		canvasApi?.scrollToElement(elementId)
		paint()
		options.onMove?.(elementId)
	}

	function selectCandidates(flowIds: string[], startAt: number): void {
		candidates = flowIds
		candidateIndex = startAt
		const candidate = candidates[candidateIndex]
		if (candidate !== undefined) canvasApi?.scrollToElement(candidate)
		paint()
	}

	/** The first shape to start from when nothing is selected yet. */
	function firstStart(): string | null {
		const api = canvasApi
		if (api === null) return null
		const shapes = api.getShapes()
		const start = shapes.find((s) => s.flowElement?.type === "startEvent")
		return (start ?? shapes[0])?.id ?? null
	}

	// ── Movement ─────────────────────────────────────────────────────────────

	/** @returns whether the key was used, and so should not reach the canvas. */
	function forward(): boolean {
		if (cursor === null) {
			const first = firstStart()
			if (first === null) return false
			moveTo(first)
			return true
		}

		// Already choosing between a fan-out's flows: cycle to the next one.
		if (candidates.length > 0) {
			selectCandidates(candidates, (candidateIndex + 1) % candidates.length)
			return true
		}

		const out = outgoing(cursor)
		if (out.length === 0) return false
		if (out.length === 1) {
			const only = out[0]
			if (only === undefined) return false
			moveTo(only.targetRef)
			return true
		}
		// A branch is a choice, so make it one rather than guessing a target.
		selectCandidates(
			out.map((f) => f.id),
			0,
		)
		return true
	}

	function backward(): boolean {
		if (cursor === null) return false

		if (candidates.length > 0) {
			const previous = (candidateIndex - 1 + candidates.length) % candidates.length
			selectCandidates(candidates, previous)
			return true
		}

		const back = incoming(cursor)
		const first = back[0]
		if (first === undefined) return false
		moveTo(first.sourceRef)
		return true
	}

	function activate(): boolean {
		const candidate = candidates[candidateIndex]
		if (candidate !== undefined) {
			const flow = flows.find((f) => f.id === candidate)
			if (flow === undefined) return false
			moveTo(flow.targetRef)
			return true
		}

		if (cursor === null) return false
		const type = elementTypes.get(cursor)
		if (type !== undefined && DRILLABLE.has(type)) {
			const api = canvasApi
			if (api === null) return false
			// Only a sub-process with a plane of its own can be entered.
			if (!api.getPlanes().some((p) => p.id === cursor)) return false
			api.showPlane(cursor)
			return true
		}
		return false
	}

	function drillOut(): boolean {
		const api = canvasApi
		if (api === null) return false
		const planes = api.getPlanes()
		const root = planes[0]
		if (root === undefined) return false
		// The root plane is always first; going back to it is the one step out
		// this plugin offers without tracking a breadcrumb of its own.
		api.showPlane(root.id)
		return true
	}

	// ── Keyboard ─────────────────────────────────────────────────────────────

	/**
	 * Intercepts in the capture phase so the canvas's own document-order Tab
	 * does not also fire — but only swallows the event when there was somewhere
	 * to go, so a dead end still falls through to that walk.
	 *
	 * Both listeners sit on the same node, and the canvas registered first, so
	 * this depends on a capture listener running before a bubble one regardless
	 * of registration order, and on `stopPropagation()` suppressing the bubble
	 * listener beside it. Verified in Chromium rather than assumed; a test
	 * asserts the fall-through by watching for the canvas's handler, not by
	 * reading `defaultPrevented`, which the canvas sets on that path too.
	 */
	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.altKey || event.ctrlKey || event.metaKey) return

		let used = false
		switch (event.key) {
			case "Tab":
				used = event.shiftKey ? backward() : forward()
				break
			case "Enter":
				used = activate()
				break
			case "u":
			case "U":
				used = drillOut()
				break
			case "Escape":
				if (candidates.length > 0) {
					candidates = []
					candidateIndex = -1
					paint()
					used = true
				}
				break
			default:
				return
		}

		if (used) {
			event.preventDefault()
			event.stopPropagation()
		}
	}

	const api: FlowNavigationApi = {
		getCursor() {
			return cursor
		},
		setCursor(elementId) {
			if (elementId === null) {
				cursor = null
				candidates = []
				candidateIndex = -1
				paint()
				return
			}
			moveTo(elementId)
		},
		getCandidate() {
			return candidates[candidateIndex] ?? null
		},
	}

	return {
		name: "flow-navigation",
		api,

		install(canvas: CanvasApi) {
			canvasApi = canvas
			injectFlowNavigationStyles()
			canvas.container.addEventListener("keydown", onKeyDown, true)

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void
			const onAny = canvas.on as unknown as AnyOn

			unsubs.push(
				canvas.on("diagram:load", (defs: BpmnDefinitions) => {
					index(defs)
					cursor = null
					candidates = []
					candidateIndex = -1
					paint()
				}),
				canvas.on("diagram:clear", () => {
					flows = []
					elementTypes = new Map()
					cursor = null
					candidates = []
					candidateIndex = -1
				}),
				// Clicking is the other way to say "I am here"; keep the keyboard
				// cursor with it so Tab continues from where the user is looking.
				canvas.on("element:click", (id: string) => {
					cursor = id
					candidates = []
					candidateIndex = -1
					paint()
				}),
				// The editor reports selection instead of clicks. A multi-selection
				// has no single place to continue from, so only a single one moves
				// the cursor.
				onAny("editor:select", (ids: unknown) => {
					const selection = ids as string[]
					if (selection.length !== 1) return
					const only = selection[0]
					if (only === undefined || only === cursor) return
					cursor = only
					candidates = []
					candidateIndex = -1
					paint()
				}),
				canvas.on("plane:change", () => {
					cursor = null
					candidates = []
					candidateIndex = -1
					paint()
				}),
				onAny("diagram:change", (defs: unknown) => {
					index(defs as BpmnDefinitions)
				}),
			)
		},

		uninstall() {
			canvasApi?.container.removeEventListener("keydown", onKeyDown, true)
			for (const off of unsubs) off()
			unsubs.length = 0
			paint()
			canvasApi = null
			flows = []
			elementTypes = new Map()
			cursor = null
			candidates = []
			candidateIndex = -1
		},
	}
}

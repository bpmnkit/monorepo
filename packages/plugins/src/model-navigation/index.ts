/**
 * @bpmnkit/canvas-plugin-model-navigation — jump from an element to what it references.
 *
 * A Call Activity names a process, a Business Rule Task names a decision, a
 * User Task names a form. Following one of those means opening a *file*, and a
 * canvas has no idea what a file is — in the studio it is a row in IndexedDB,
 * in a drop it is a tab, in an editor extension it is a path on disk.
 *
 * So the plugin does the half it can do from the model — work out what an
 * element points at — and takes the other half as an injected
 * {@link ReferencePort}. Nothing here imports a host API, which is what lets
 * the same plugin serve every surface.
 *
 * ## Availability is optimistic, then corrected
 *
 * A reference is shown as soon as the model has one, and withdrawn only once
 * the host says it does not resolve. Waiting for the host would mean the
 * affordance appears late on every diagram; assuming it resolves means it is
 * occasionally wrong for one round trip. The first is worse, because it is
 * wrong every time.
 *
 * ## Usage
 * ```typescript
 * import { createModelNavigationPlugin } from "@bpmnkit/plugins/model-navigation";
 *
 * const nav = createModelNavigationPlugin({
 *   port: {
 *     open: (ref) => openFileForReference(ref),
 *     resolve: (refs) => refs.filter((r) => workspaceHas(r)).map((r) => r.elementId),
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectModelNavigationStyles } from "./css.js"

export {
	MODEL_NAVIGATION_CSS,
	MODEL_NAVIGATION_STYLE_ID,
	injectModelNavigationStyles,
} from "./css.js"

const AVAILABLE_CLASS = "bpmnkit-modelnav-available"

/** What an element points at, as the model states it. */
export interface ModelReference {
	/** The element holding the reference. */
	elementId: string
	/** What kind of thing is referenced, and so what the host should open. */
	kind: "process" | "decision" | "form"
	/** The referenced id: a process id, a decision id, or a form id. */
	ref: string
}

/**
 * The host's half of go-to-reference.
 *
 * The plugin never learns what a file is; it hands over a reference and the
 * host decides what opening it means.
 */
export interface ReferencePort {
	/** Opens what the reference points at. */
	open(reference: ModelReference): void
	/**
	 * Narrows a set of references to the ones the host can actually resolve,
	 * returning their `elementId`s.
	 *
	 * Optional: a host that cannot check cheaply should leave it out, and every
	 * syntactically valid reference stays available.
	 */
	resolve?(references: readonly ModelReference[]): Promise<readonly string[]> | readonly string[]
}

export interface ModelNavigationOptions {
	port: ReferencePort
	/**
	 * Key that opens the reference on the element under the cursor. Default `g`.
	 * Set to `null` to bind nothing and drive the plugin through its API.
	 */
	key?: string | null
}

export interface ModelNavigationApi {
	/** Every reference the loaded model states, resolvable or not. */
	getReferences(): ModelReference[]
	/** The reference on an element, if it has one the host can resolve. */
	getReference(elementId: string): ModelReference | null
	/** Opens an element's reference through the port. Returns whether it did. */
	open(elementId: string): boolean
}

/** Extension elements are kept verbatim, so a reference is read out of them. */
interface ExtensionLike {
	name: string
	attributes: Record<string, string>
}

interface ElementLike {
	id: string
	type: string
	extensionElements?: ExtensionLike[]
	unknownAttributes?: Record<string, string>
}

/**
 * Where each kind of reference lives.
 *
 * Camunda 8 puts it in an extension element; Camunda 7 put it in an attribute
 * on the element itself. Both shapes are read, because a diagram in a
 * repository may predate the migration even when the tooling does not.
 */
const REFERENCE_SOURCES: ReadonlyArray<{
	types: ReadonlySet<string>
	kind: ModelReference["kind"]
	extension: string
	extensionAttribute: string
	legacyAttribute: string
}> = [
	{
		types: new Set(["callActivity"]),
		kind: "process",
		extension: "zeebe:calledElement",
		extensionAttribute: "processId",
		legacyAttribute: "calledElement",
	},
	{
		types: new Set(["businessRuleTask"]),
		kind: "decision",
		extension: "zeebe:calledDecision",
		extensionAttribute: "decisionId",
		legacyAttribute: "camunda:decisionRef",
	},
	{
		types: new Set(["userTask"]),
		kind: "form",
		extension: "zeebe:formDefinition",
		extensionAttribute: "formId",
		legacyAttribute: "camunda:formKey",
	},
]

/** Reads the reference an element states, if any. */
export function referenceOf(element: ElementLike): ModelReference | null {
	for (const source of REFERENCE_SOURCES) {
		if (!source.types.has(element.type)) continue

		const extension = element.extensionElements?.find((e) => e.name === source.extension)
		const fromExtension = extension?.attributes[source.extensionAttribute]
		if (fromExtension !== undefined && fromExtension !== "") {
			return { elementId: element.id, kind: source.kind, ref: fromExtension }
		}

		const legacy = element.unknownAttributes?.[source.legacyAttribute]
		if (legacy !== undefined && legacy !== "") {
			return { elementId: element.id, kind: source.kind, ref: legacy }
		}
	}
	return null
}

/** Every reference in a model, sub-process contents included. */
export function collectReferences(definitions: BpmnDefinitions): ModelReference[] {
	const references: ModelReference[] = []
	for (const process of definitions.processes) {
		const stack: Array<{ flowElements?: ElementLike[] }> = [process as never]
		while (stack.length > 0) {
			const container = stack.pop()
			if (container === undefined) continue
			for (const element of container.flowElements ?? []) {
				const reference = referenceOf(element)
				if (reference !== null) references.push(reference)
				const nested = element as unknown as { flowElements?: unknown[] }
				if (nested.flowElements !== undefined) stack.push(nested as never)
			}
		}
	}
	return references
}

/**
 * Creates the model-navigation plugin.
 *
 * @param options - The host's {@link ReferencePort}, and the key to bind.
 */
export function createModelNavigationPlugin(
	options: ModelNavigationOptions,
): CanvasPlugin & { api: ModelNavigationApi } {
	const { port, key = "g" } = options

	let canvasApi: CanvasApi | null = null
	let references: ModelReference[] = []
	/** Element ids the host has said it cannot resolve. Absent means available. */
	const unresolvable = new Set<string>()
	let cursor: string | null = null
	/** Guards a stale resolve landing after the diagram moved on. */
	let generation = 0
	const unsubs: Array<() => void> = []

	function rendered(): Map<string, SVGGElement> {
		const api = canvasApi
		const elements = new Map<string, SVGGElement>()
		if (api === null) return elements
		for (const shape of api.getShapes()) elements.set(shape.id, shape.element)
		return elements
	}

	function paint(): void {
		const api = canvasApi
		if (api === null) return
		for (const el of api.viewportEl.querySelectorAll(`.${AVAILABLE_CLASS}`)) {
			el.classList.remove(AVAILABLE_CLASS)
		}
		const elements = rendered()
		for (const reference of references) {
			if (unresolvable.has(reference.elementId)) continue
			elements.get(reference.elementId)?.classList.add(AVAILABLE_CLASS)
		}
	}

	/**
	 * Asks the host which references resolve, and withdraws the rest.
	 *
	 * Marks are already painted optimistically by the time this runs, so the
	 * answer only ever takes affordances away — there is no flash of a link
	 * appearing late.
	 */
	async function reconcile(): Promise<void> {
		if (port.resolve === undefined || references.length === 0) return
		const mine = generation
		const resolvable = new Set(await port.resolve(references))
		if (mine !== generation) return

		unresolvable.clear()
		for (const reference of references) {
			if (!resolvable.has(reference.elementId)) unresolvable.add(reference.elementId)
		}
		paint()
	}

	function load(definitions: BpmnDefinitions): void {
		generation += 1
		references = collectReferences(definitions)
		unresolvable.clear()
		paint()
		void reconcile()
	}

	const api: ModelNavigationApi = {
		getReferences() {
			return [...references]
		},
		getReference(elementId) {
			if (unresolvable.has(elementId)) return null
			return references.find((r) => r.elementId === elementId) ?? null
		},
		open(elementId) {
			const reference = api.getReference(elementId)
			if (reference === null) return false
			port.open(reference)
			return true
		},
	}

	const onKeyDown = (event: KeyboardEvent): void => {
		if (key === null) return
		if (event.altKey || event.ctrlKey || event.metaKey) return
		if (event.key !== key) return
		if (cursor === null) return
		if (!api.open(cursor)) return
		event.preventDefault()
		event.stopPropagation()
	}

	return {
		name: "model-navigation",
		api,

		install(canvas: CanvasApi) {
			canvasApi = canvas
			injectModelNavigationStyles()
			canvas.container.addEventListener("keydown", onKeyDown, true)

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void
			const onAny = canvas.on as unknown as AnyOn

			unsubs.push(
				canvas.on("diagram:load", (defs: BpmnDefinitions) => {
					load(defs)
				}),
				canvas.on("diagram:clear", () => {
					generation += 1
					references = []
					unresolvable.clear()
					cursor = null
				}),
				canvas.on("element:click", (id: string) => {
					cursor = id
				}),
				canvas.on("element:focus", (id: string) => {
					cursor = id
				}),
				// The editor reports selection instead of clicks.
				onAny("editor:select", (ids: unknown) => {
					const selection = ids as string[]
					if (selection.length === 1) cursor = selection[0] ?? null
				}),
				// Drilling in re-renders the elements, taking the marks with them.
				canvas.on("plane:change", () => {
					paint()
				}),
				onAny("diagram:change", (defs: unknown) => {
					load(defs as BpmnDefinitions)
				}),
			)
		},

		uninstall() {
			canvasApi?.container.removeEventListener("keydown", onKeyDown, true)
			for (const off of unsubs) off()
			unsubs.length = 0
			generation += 1
			paint()
			references = []
			unresolvable.clear()
			cursor = null
			canvasApi = null
		},
	}
}

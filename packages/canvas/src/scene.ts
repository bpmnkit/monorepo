import type { BpmnDefinitions, BpmnDiPlane } from "@bpmnkit/core"
import {
	type RenderContext,
	buildRenderContext,
	renderEdgeGroup,
	renderShapeGroup,
} from "./renderer.js"
import type { RenderedEdge, RenderedShape } from "./types.js"

/** The four stacked SVG layers a scene renders into (bottom → top). */
export interface SceneLayers {
	containers: SVGGElement
	edges: SVGGElement
	shapes: SVGGElement
	labels: SVGGElement
}

interface RegistryEntry {
	rendered: RenderedShape | RenderedEdge
	/** External label group (shapes only), tracked so updates/removals stay in sync. */
	label: SVGGElement | null
	kind: "shape" | "edge"
}

/**
 * Owns a diagram's SVG layers and an id → graphics registry, and renders a DI
 * plane into them. Beyond the initial full {@link render}, individual elements
 * can be updated or removed in place ({@link updateElement}/{@link removeElement})
 * without tearing down the whole scene — the foundation for incremental editing.
 *
 * CSS classes added to an element's `<g>` after rendering (markers, selection,
 * highlights) are preserved across {@link updateElement}.
 */
export class Scene {
	private readonly _registry = new Map<string, RegistryEntry>()
	private _defs: BpmnDefinitions | null = null
	private _plane: BpmnDiPlane | null = null
	private _drillableIds: ReadonlySet<string> = new Set()

	constructor(
		private readonly _layers: SceneLayers,
		private readonly _instanceId: string,
	) {}

	/** Renders a plane from scratch, replacing any current content. */
	render(
		defs: BpmnDefinitions,
		plane: BpmnDiPlane,
		drillableIds: ReadonlySet<string> = new Set(),
	): void {
		this.clear()
		this._defs = defs
		this._plane = plane
		this._drillableIds = drillableIds

		const ctx = this._context()
		for (const edge of plane.edges) {
			const g = renderEdgeGroup(edge, ctx)
			this._layers.edges.appendChild(g)
			this._registry.set(edge.bpmnElement, {
				rendered: { id: edge.bpmnElement, element: g, edge },
				label: null,
				kind: "edge",
			})
		}
		for (const shape of plane.shapes) {
			const { group, layer, label, rendered } = renderShapeGroup(shape, ctx)
			this._layers[layer].appendChild(group)
			if (label) this._layers.labels.appendChild(label)
			this._registry.set(shape.bpmnElement, { rendered, label, kind: "shape" })
		}
	}

	/** Empties the layers and the registry. */
	clear(): void {
		this._layers.containers.replaceChildren()
		this._layers.edges.replaceChildren()
		this._layers.shapes.replaceChildren()
		this._layers.labels.replaceChildren()
		this._registry.clear()
	}

	/** Returns the registered shape or edge for an id, or `undefined`. */
	getElement(id: string): RenderedShape | RenderedEdge | undefined {
		return this._registry.get(id)?.rendered
	}

	/** Returns the `<g>` graphics element for an id, or `undefined`. */
	getGraphics(id: string): SVGGElement | undefined {
		return this._registry.get(id)?.rendered.element
	}

	/** Iterates every registered element in insertion order. */
	forEach(fn: (el: RenderedShape | RenderedEdge) => void): void {
		for (const entry of this._registry.values()) fn(entry.rendered)
	}

	/** All rendered shapes, in registry order. */
	getShapes(): RenderedShape[] {
		const out: RenderedShape[] = []
		for (const entry of this._registry.values()) {
			if (entry.kind === "shape") out.push(entry.rendered as RenderedShape)
		}
		return out
	}

	/** All rendered edges, in registry order. */
	getEdges(): RenderedEdge[] {
		const out: RenderedEdge[] = []
		for (const entry of this._registry.values()) {
			if (entry.kind === "edge") out.push(entry.rendered as RenderedEdge)
		}
		return out
	}

	/**
	 * Re-renders a single element's `<g>` in place from the current model,
	 * preserving CSS classes (markers/selection) applied after the last render.
	 * No-op if the id is unknown or there is no current plane.
	 */
	updateElement(id: string): void {
		const entry = this._registry.get(id)
		if (!entry || !this._plane) return
		const ctx = this._context()
		const oldClasses = (entry.rendered.element.getAttribute("class") ?? "")
			.split(/\s+/)
			.filter(Boolean)

		if (entry.kind === "edge") {
			const edge = this._plane.edges.find((e) => e.bpmnElement === id)
			if (!edge) return
			const g = renderEdgeGroup(edge, ctx)
			for (const c of oldClasses) g.classList.add(c)
			entry.rendered.element.replaceWith(g)
			this._registry.set(id, { rendered: { id, element: g, edge }, label: null, kind: "edge" })
			return
		}

		const shape = this._plane.shapes.find((s) => s.bpmnElement === id)
		if (!shape) return
		const { group, layer, label, rendered } = renderShapeGroup(shape, ctx)
		for (const c of oldClasses) group.classList.add(c)
		entry.rendered.element.replaceWith(group)
		entry.label?.remove()
		if (label) this._layers.labels.appendChild(label)
		// Keep the group in the correct layer if its target changed.
		if (group.parentNode !== this._layers[layer]) this._layers[layer].appendChild(group)
		this._registry.set(id, { rendered, label, kind: "shape" })
	}

	/** Removes an element's `<g>` (and its external label) from the scene. */
	removeElement(id: string): void {
		const entry = this._registry.get(id)
		if (!entry) return
		entry.rendered.element.remove()
		entry.label?.remove()
		this._registry.delete(id)
	}

	private _context(): RenderContext {
		if (!this._defs || !this._plane) {
			throw new Error("Scene has no rendered plane")
		}
		return buildRenderContext(this._defs, this._plane, this._drillableIds, this._instanceId)
	}
}

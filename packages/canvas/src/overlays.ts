import type { ScreenBox } from "./types.js"

/** Placement of an overlay relative to its anchor element's bounding box. */
export interface OverlayPosition {
	/** Distance (px) of the overlay's top edge below the element's top edge. */
	top?: number
	/** Distance (px) of the overlay's bottom edge above the element's bottom edge. */
	bottom?: number
	/** Distance (px) of the overlay's left edge right of the element's left edge. */
	left?: number
	/** Distance (px) of the overlay's right edge left of the element's right edge. */
	right?: number
}

/** Options for {@link OverlayManager.add}. */
export interface OverlayOptions {
	/** Where to anchor the overlay relative to the element. */
	position: OverlayPosition
	/** Overlay content — an HTML string or a pre-built element. */
	html: string | HTMLElement
	/** Zoom range in which the overlay is visible. */
	show?: { minZoom?: number; maxZoom?: number }
	/**
	 * Whether the overlay scales with zoom. `true` (default) scales 1:1 with the
	 * diagram; `false` keeps a constant pixel size; an object clamps the scale.
	 */
	scale?: boolean | { min?: number; max?: number }
	/** Optional tag for bulk queries and removal. */
	type?: string
}

/** A registered overlay. */
export interface Overlay {
	readonly id: string
	readonly element: string
	readonly type?: string
	readonly node: HTMLElement
}

/** Filter for {@link OverlayManager.get} / {@link OverlayManager.remove}. */
export interface OverlayFilter {
	element?: string
	type?: string
}

/** The host hooks an {@link OverlayManager} needs from a canvas or editor. */
export interface OverlayHost {
	/** The (position: relative) host element to mount the overlay layer into. */
	readonly hostEl: HTMLElement
	/** Current zoom scale. */
	getScale(): number
	/** Element bounding box in screen pixels relative to the host, or `null`. */
	getBBox(id: string): ScreenBox | null
	/** Subscribes to viewport changes; returns an unsubscribe function. */
	onViewportChange(cb: () => void): () => void
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v))
}

/**
 * Manages HTML overlays anchored to diagram elements. Overlays live in a
 * dedicated absolutely-positioned layer above the SVG and are repositioned on
 * every viewport change from the element's screen bounding box.
 */
export class OverlayManager {
	private readonly _layer: HTMLDivElement
	private readonly _overlays = new Map<string, Overlay & { opts: OverlayOptions }>()
	private readonly _unsub: () => void
	private _counter = 0

	constructor(private readonly _host: OverlayHost) {
		this._layer = document.createElement("div")
		this._layer.className = "bpmnkit-overlays"
		this._layer.style.cssText =
			"position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;"
		this._host.hostEl.appendChild(this._layer)
		this._unsub = this._host.onViewportChange(() => this._repositionAll())
	}

	/** Adds an overlay anchored to `elementId`. Returns its overlay id. */
	add(elementId: string, opts: OverlayOptions): string {
		const node = document.createElement("div")
		node.style.position = "absolute"
		node.style.pointerEvents = "auto"
		if (typeof opts.html === "string") node.innerHTML = opts.html
		else node.appendChild(opts.html)
		if (opts.type) node.dataset.overlayType = opts.type
		this._layer.appendChild(node)

		const id = String(this._counter++)
		const overlay = { id, element: elementId, type: opts.type, node, opts }
		this._overlays.set(id, overlay)
		this._position(overlay)
		return id
	}

	/** Removes an overlay by id, or all overlays matching a filter. */
	remove(idOrFilter: string | OverlayFilter): void {
		if (typeof idOrFilter === "string") {
			const overlay = this._overlays.get(idOrFilter)
			if (overlay) {
				overlay.node.remove()
				this._overlays.delete(idOrFilter)
			}
			return
		}
		for (const overlay of this.get(idOrFilter)) {
			overlay.node.remove()
			this._overlays.delete(overlay.id)
		}
	}

	/** Returns overlays matching a filter (all overlays when omitted). */
	get(filter?: OverlayFilter): Overlay[] {
		const all = [...this._overlays.values()]
		if (!filter) return all
		return all.filter(
			(o) =>
				(filter.element === undefined || o.element === filter.element) &&
				(filter.type === undefined || o.type === filter.type),
		)
	}

	/** Removes every overlay. */
	clear(): void {
		for (const overlay of this._overlays.values()) overlay.node.remove()
		this._overlays.clear()
	}

	/** Removes the overlay layer and unsubscribes from viewport changes. */
	destroy(): void {
		this._unsub()
		this.clear()
		this._layer.remove()
	}

	// ── Private ───────────────────────────────────────────────────────

	private _repositionAll(): void {
		for (const overlay of this._overlays.values()) this._position(overlay)
	}

	private _position(overlay: Overlay & { opts: OverlayOptions }): void {
		const { node, opts } = overlay
		const box = this._host.getBBox(overlay.element)
		if (!box) {
			node.style.display = "none"
			return
		}

		const scale = this._host.getScale()
		const min = opts.show?.minZoom ?? Number.NEGATIVE_INFINITY
		const max = opts.show?.maxZoom ?? Number.POSITIVE_INFINITY
		if (scale < min || scale > max) {
			node.style.display = "none"
			return
		}
		node.style.display = ""

		const { position } = opts
		const transforms: string[] = []
		let originX = "left"
		let originY = "top"
		let x = box.x
		let y = box.y

		if (position.left !== undefined) {
			x = box.x + position.left
		} else if (position.right !== undefined) {
			x = box.x + box.width - position.right
			transforms.push("translateX(-100%)")
			originX = "right"
		}
		if (position.top !== undefined) {
			y = box.y + position.top
		} else if (position.bottom !== undefined) {
			y = box.y + box.height - position.bottom
			transforms.push("translateY(-100%)")
			originY = "bottom"
		}

		node.style.left = `${x}px`
		node.style.top = `${y}px`

		const scaleFactor = this._scaleFactor(opts.scale, scale)
		if (scaleFactor !== 1) transforms.push(`scale(${scaleFactor})`)
		node.style.transformOrigin = `${originX} ${originY}`
		node.style.transform = transforms.join(" ")
	}

	private _scaleFactor(scale: OverlayOptions["scale"], zoom: number): number {
		// Default: scale 1:1 with the diagram.
		if (scale === undefined || scale === true) return zoom
		if (scale === false) return 1
		return clamp(zoom, scale.min ?? 0, scale.max ?? Number.POSITIVE_INFINITY)
	}
}

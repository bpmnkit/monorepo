import type { ViewportState } from "./types.js"

const MIN_SCALE = 0.05
const MAX_SCALE = 10

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v))
}

/**
 * Controls the pan/zoom viewport of the canvas.
 *
 * Uses the Pointer Events API (covering mouse, touch, and pen) with
 * `requestAnimationFrame`-batched rendering so interactions stay smooth at
 * 60 fps with no perceptible input lag.
 *
 * - **Mouse**: left-button drag to pan, scroll wheel to zoom toward cursor.
 * - **Touch**: one-finger drag to pan, two-finger pinch to zoom.
 * - **Keyboard**: handled externally in `keyboard.ts` via `zoomAt` / `set`.
 */
export class ViewportController {
	private _tx = 0
	private _ty = 0
	private _scale = 1
	private _raf: number | null = null
	private _dirty = false

	// Pan state
	private _dragging = false
	private _lastX = 0
	private _lastY = 0
	private _dragDist = 0
	private _locked = false

	// Pinch state
	private _activePointers = new Map<number, PointerEvent>()
	private _lastPinchDist = 0

	constructor(
		/** The host div — receives the `is-panning` CSS class. */
		private readonly _host: HTMLElement,
		/** The SVG element that receives pointer/wheel events. */
		private readonly _svg: SVGSVGElement,
		/** The `<g>` element whose `transform` attribute is updated. */
		private readonly _group: SVGGElement,
		/** The dot-grid `<pattern>` element (optional). Kept in sync with the viewport. */
		private readonly _gridPattern: SVGPatternElement | null,
		/** Called on every rendered frame with the new viewport state. */
		private readonly _onChanged: (state: ViewportState) => void,
	) {
		this._bindEvents()
	}

	/** Current viewport state snapshot. */
	get state(): ViewportState {
		return { tx: this._tx, ty: this._ty, scale: this._scale }
	}

	/**
	 * When locked, pointer-down is ignored (no new pan starts) and pointer-move
	 * does not continue any in-progress pan. Scroll-wheel zoom is unaffected.
	 */
	lock(locked: boolean): void {
		this._locked = locked
	}

	/**
	 * Whether the last pointer interaction was a drag (as opposed to a click).
	 * The canvas uses this to suppress `element:click` events after panning.
	 */
	get didPan(): boolean {
		return this._dragDist > 4
	}

	/** Programmatically sets viewport state. Any omitted fields are unchanged. */
	set(state: Partial<ViewportState>): void {
		if (state.tx !== undefined) this._tx = state.tx
		if (state.ty !== undefined) this._ty = state.ty
		if (state.scale !== undefined) this._scale = clamp(state.scale, MIN_SCALE, MAX_SCALE)
		this._scheduleApply()
	}

	/**
	 * Zooms the viewport by `factor`, keeping the point at (`screenX`, `screenY`)
	 * fixed in screen space (zoom-toward-cursor behaviour).
	 */
	zoomAt(screenX: number, screenY: number, factor: number): void {
		const newScale = clamp(this._scale * factor, MIN_SCALE, MAX_SCALE)
		const ratio = newScale / this._scale
		this._tx = screenX - (screenX - this._tx) * ratio
		this._ty = screenY - (screenY - this._ty) * ratio
		this._scale = newScale
		this._scheduleApply()
	}

	/** Removes all event listeners and cancels any pending animation frame. */
	destroy(): void {
		this._unbindEvents()
		if (this._raf !== null) cancelAnimationFrame(this._raf)
	}

	// ── Private ──────────────────────────────────────────────────────

	private _scheduleApply(): void {
		this._dirty = true
		if (this._raf === null) {
			this._raf = requestAnimationFrame(() => {
				this._raf = null
				if (this._dirty) {
					this._dirty = false
					this._apply()
				}
			})
		}
	}

	private _apply(): void {
		const t = `translate(${this._tx} ${this._ty}) scale(${this._scale})`
		this._group.setAttribute("transform", t)
		if (this._gridPattern) {
			this._gridPattern.setAttribute("patternTransform", t)
		}
		this._onChanged(this.state)
	}

	private readonly _onWheel = (e: WheelEvent): void => {
		e.preventDefault()
		const rect = this._svg.getBoundingClientRect()
		const cx = e.clientX - rect.left
		const cy = e.clientY - rect.top
		// Normalise across deltaMode variants (pixels, lines, pages)
		const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
		const factor = Math.exp(-delta * 0.001)
		this.zoomAt(cx, cy, factor)
	}

	private readonly _onPointerDown = (e: PointerEvent): void => {
		// Only pan with left mouse button (button=0) or touch/pen
		if (e.pointerType === "mouse" && e.button !== 0) return
		if (this._locked) return
		this._activePointers.set(e.pointerId, e)
		this._svg.setPointerCapture(e.pointerId)
		this._dragDist = 0
		if (this._activePointers.size === 1) {
			this._dragging = true
			this._lastX = e.clientX
			this._lastY = e.clientY
			this._host.classList.add("is-panning")
		}
	}

	private readonly _onPointerMove = (e: PointerEvent): void => {
		this._activePointers.set(e.pointerId, e)
		if (this._locked) return

		if (this._activePointers.size >= 2) {
			// Two-finger pinch-to-zoom
			const pts = [...this._activePointers.values()]
			const a = pts[0]
			const b = pts[1]
			if (!a || !b) return
			const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
			if (this._lastPinchDist > 0) {
				const cx = (a.clientX + b.clientX) / 2
				const cy = (a.clientY + b.clientY) / 2
				const rect = this._svg.getBoundingClientRect()
				this.zoomAt(cx - rect.left, cy - rect.top, dist / this._lastPinchDist)
			}
			this._lastPinchDist = dist
			return
		}

		if (!this._dragging) return
		const dx = e.clientX - this._lastX
		const dy = e.clientY - this._lastY
		this._dragDist += Math.abs(dx) + Math.abs(dy)
		this._lastX = e.clientX
		this._lastY = e.clientY
		this._tx += dx
		this._ty += dy
		this._scheduleApply()
	}

	private readonly _onPointerUp = (e: PointerEvent): void => {
		this._activePointers.delete(e.pointerId)
		this._lastPinchDist = 0
		if (this._activePointers.size === 0) {
			this._dragging = false
			this._host.classList.remove("is-panning")
		}
	}

	private _bindEvents(): void {
		this._svg.addEventListener("wheel", this._onWheel, { passive: false })
		this._svg.addEventListener("pointerdown", this._onPointerDown)
		this._svg.addEventListener("pointermove", this._onPointerMove)
		this._svg.addEventListener("pointerup", this._onPointerUp)
		this._svg.addEventListener("pointercancel", this._onPointerUp)
	}

	private _unbindEvents(): void {
		this._svg.removeEventListener("wheel", this._onWheel)
		this._svg.removeEventListener("pointerdown", this._onPointerDown)
		this._svg.removeEventListener("pointermove", this._onPointerMove)
		this._svg.removeEventListener("pointerup", this._onPointerUp)
		this._svg.removeEventListener("pointercancel", this._onPointerUp)
	}
}

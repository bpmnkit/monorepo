import type { RenderedShape } from "./types.js"
import type { ViewportController } from "./viewport.js"

const PAN_STEP = 60 // pixels per arrow key press
const ZOOM_STEP = 1.25 // factor per +/- key press

/**
 * Handles keyboard navigation for the BPMN canvas.
 *
 * ## Key bindings
 * | Key | Action |
 * |-----|--------|
 * | `←` `→` `↑` `↓` | Pan viewport |
 * | `+` / `=` | Zoom in |
 * | `-` | Zoom out |
 * | `0` / `Home` | Fit diagram to view |
 * | `Tab` | Focus next element |
 * | `Shift+Tab` | Focus previous element |
 * | `Enter` / `Space` | Activate focused element (fires `element:click`) |
 * | `Escape` | Return focus to canvas container |
 *
 * The canvas container uses `role="application"` so screen readers pass
 * all key presses to the application rather than handling them natively.
 */
export class KeyboardHandler {
	private _shapes: RenderedShape[] = []
	private _focusIndex = -1 // -1 = container has focus

	constructor(
		private readonly _container: HTMLElement,
		private readonly _viewport: ViewportController,
		private readonly _onFit: () => void,
		private readonly _onActivate: (id: string) => void,
		private readonly _onFocus: (id: string) => void,
		private readonly _onBlur: () => void,
	) {
		this._container.addEventListener("keydown", this._onKeyDown)
		this._container.addEventListener("focusout", this._onFocusOut)
	}

	/** Updates the navigable shape list after a diagram (re)load. */
	setShapes(shapes: RenderedShape[]): void {
		this._shapes = shapes.filter((s) => s.element.getAttribute("tabindex") === "-1")
		this._focusIndex = -1
	}

	/** Removes all keyboard event listeners. */
	destroy(): void {
		this._container.removeEventListener("keydown", this._onKeyDown)
		this._container.removeEventListener("focusout", this._onFocusOut)
	}

	// ── Internals ─────────────────────────────────────────────────────

	private _focusShape(index: number): void {
		const shape = this._shapes[index]
		if (!shape) return
		this._focusIndex = index
		shape.element.focus()
		shape.element.classList.add("bpmn-selected")
		this._onFocus(shape.id)
	}

	private _clearFocus(): void {
		if (this._focusIndex >= 0) {
			this._shapes[this._focusIndex]?.element.classList.remove("bpmn-selected")
		}
		this._focusIndex = -1
		this._onBlur()
	}

	private readonly _onKeyDown = (e: KeyboardEvent): void => {
		// Don't intercept keys typed into form controls or editable elements
		const target = e.target as HTMLElement
		if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
			return

		const svgRect = this._container.getBoundingClientRect()
		const cx = svgRect.width / 2
		const cy = svgRect.height / 2

		switch (e.key) {
			// ── Pan ────────────────────────────────────────────────────
			case "ArrowLeft":
				e.preventDefault()
				this._viewport.set({
					tx: this._viewport.state.tx + PAN_STEP,
					ty: this._viewport.state.ty,
				})
				break
			case "ArrowRight":
				e.preventDefault()
				this._viewport.set({
					tx: this._viewport.state.tx - PAN_STEP,
					ty: this._viewport.state.ty,
				})
				break
			case "ArrowUp":
				e.preventDefault()
				this._viewport.set({
					tx: this._viewport.state.tx,
					ty: this._viewport.state.ty + PAN_STEP,
				})
				break
			case "ArrowDown":
				e.preventDefault()
				this._viewport.set({
					tx: this._viewport.state.tx,
					ty: this._viewport.state.ty - PAN_STEP,
				})
				break

			// ── Zoom ───────────────────────────────────────────────────
			case "+":
			case "=":
				e.preventDefault()
				this._viewport.zoomAt(cx, cy, ZOOM_STEP)
				break
			case "-":
				e.preventDefault()
				this._viewport.zoomAt(cx, cy, 1 / ZOOM_STEP)
				break

			// ── Fit ────────────────────────────────────────────────────
			case "0":
			case "Home":
				e.preventDefault()
				this._onFit()
				break

			// ── Element navigation ─────────────────────────────────────
			case "Tab": {
				if (this._shapes.length === 0) break
				e.preventDefault()
				const next = e.shiftKey
					? this._focusIndex <= 0
						? this._shapes.length - 1
						: this._focusIndex - 1
					: this._focusIndex >= this._shapes.length - 1
						? 0
						: this._focusIndex + 1
				this._clearFocus()
				this._focusShape(next)
				break
			}

			// ── Activate ───────────────────────────────────────────────
			case "Enter":
			case " ": {
				if (this._focusIndex < 0) break
				const shape = this._shapes[this._focusIndex]
				if (shape) {
					e.preventDefault()
					this._onActivate(shape.id)
				}
				break
			}

			// ── Escape ─────────────────────────────────────────────────
			case "Escape":
				if (this._focusIndex >= 0) {
					e.preventDefault()
					this._clearFocus()
					this._container.focus()
				}
				break
		}
	}

	private readonly _onFocusOut = (e: FocusEvent): void => {
		// Only clear focus when leaving the container entirely
		if (!this._container.contains(e.relatedTarget as Node | null)) {
			this._clearFocus()
		}
	}
}

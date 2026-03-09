import type { ViewportState } from "@bpmn-sdk/canvas"
import type { BpmnBounds } from "@bpmn-sdk/core"

/**
 * HTML `contenteditable` label editor positioned over the diagram element.
 * Commits on blur or Enter; cancels on Escape.
 */
export class LabelEditor {
	private _div: HTMLDivElement | null = null
	private _activeId: string | null = null

	constructor(
		private readonly _container: HTMLElement,
		private readonly _onCommit: (id: string, text: string) => void,
		private readonly _onCancel: () => void,
	) {}

	get isActive(): boolean {
		return this._activeId !== null
	}

	start(
		id: string,
		currentText: string,
		bounds: BpmnBounds,
		viewport: ViewportState,
		svgRect: DOMRect,
	): void {
		this.stop()

		this._activeId = id

		const div = document.createElement("div")
		div.className = "bpmn-label-editor"
		div.contentEditable = "true"
		div.textContent = currentText

		// Position in screen coordinates
		const screenX = bounds.x * viewport.scale + viewport.tx + svgRect.left
		const screenY = bounds.y * viewport.scale + viewport.ty + svgRect.top
		const screenW = bounds.width * viewport.scale
		const screenH = bounds.height * viewport.scale

		// Relative to container
		const containerRect = this._container.getBoundingClientRect()
		div.style.left = `${screenX - containerRect.left}px`
		div.style.top = `${screenY - containerRect.top}px`
		div.style.width = `${Math.max(screenW, 60)}px`
		div.style.minHeight = `${Math.max(screenH, 16)}px`

		div.addEventListener("keydown", this._onKeyDown)
		div.addEventListener("blur", this._onBlur)

		this._container.appendChild(div)
		this._div = div

		// Select all text
		requestAnimationFrame(() => {
			div.focus()
			const range = document.createRange()
			range.selectNodeContents(div)
			const sel = window.getSelection()
			if (sel) {
				sel.removeAllRanges()
				sel.addRange(range)
			}
		})
	}

	stop(): void {
		if (!this._div) return
		this._div.removeEventListener("keydown", this._onKeyDown)
		this._div.removeEventListener("blur", this._onBlur)
		this._div.remove()
		this._div = null
		this._activeId = null
	}

	destroy(): void {
		this.stop()
	}

	// ── Event handlers ────────────────────────────────────────────────

	private readonly _onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			this._commit()
		} else if (e.key === "Escape") {
			e.preventDefault()
			this._cancel()
		}
	}

	private readonly _onBlur = (): void => {
		if (this._activeId !== null) {
			this._commit()
		}
	}

	private _commit(): void {
		if (!this._div || !this._activeId) return
		const text = this._div.textContent ?? ""
		const id = this._activeId
		this.stop()
		this._onCommit(id, text)
	}

	private _cancel(): void {
		this.stop()
		this._onCancel()
	}
}

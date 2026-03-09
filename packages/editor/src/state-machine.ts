import type { RenderedShape, ViewportState } from "@bpmn-sdk/canvas"
import type { BpmnBounds } from "@bpmn-sdk/core"
import { applyResize } from "./geometry.js"
import type { CreateShapeType, DiagPoint, HandleDir, HitResult, PortDir, Tool } from "./types.js"

// ── State types ──────────────────────────────────────────────────────────────

type SelectSub =
	| { name: "idle"; hoveredId: string | null }
	| { name: "pointing-canvas"; origin: DiagPoint; screenX: number; screenY: number }
	| { name: "rubber-band"; origin: DiagPoint; current: DiagPoint }
	| { name: "pointing-shape"; origin: DiagPoint; id: string; screenX: number; screenY: number }
	| { name: "translating"; origin: DiagPoint; last: DiagPoint }
	| {
			name: "pointing-handle"
			origin: DiagPoint
			id: string
			handle: HandleDir
			screenX: number
			screenY: number
	  }
	| { name: "resizing"; id: string; handle: HandleDir; original: BpmnBounds; current: DiagPoint }
	| {
			name: "pointing-port"
			origin: DiagPoint
			sourceId: string
			port: PortDir
			screenX: number
			screenY: number
	  }
	| { name: "connecting"; sourceId: string; ghostEnd: DiagPoint }
	| { name: "editing-label"; id: string }
	| {
			name: "pointing-edge-endpoint"
			edgeId: string
			isStart: boolean
			origin: DiagPoint
			screenX: number
			screenY: number
	  }
	| { name: "dragging-edge-endpoint"; edgeId: string; isStart: boolean; origin: DiagPoint }
	| {
			name: "pointing-edge-segment"
			edgeId: string
			segIdx: number
			isHoriz: boolean
			projPt: DiagPoint
			origin: DiagPoint
			screenX: number
			screenY: number
	  }
	| { name: "dragging-edge-waypoint-new"; edgeId: string; segIdx: number; origin: DiagPoint }
	| {
			name: "pointing-edge-waypoint"
			edgeId: string
			wpIdx: number
			pt: DiagPoint
			screenX: number
			screenY: number
	  }
	| { name: "dragging-edge-waypoint"; edgeId: string; wpIdx: number; origin: DiagPoint }

type SpaceSub =
	| { name: "idle" }
	| { name: "dragging"; origin: DiagPoint; last: DiagPoint; axis: "h" | "v" | null }

export type EditorMode =
	| { mode: "select"; sub: SelectSub }
	| { mode: "create"; elementType: CreateShapeType }
	| { mode: "pan" }
	| { mode: "space"; sub: SpaceSub }

// ── Callbacks ─────────────────────────────────────────────────────────────────

export interface Callbacks {
	getShapes(): RenderedShape[]
	getSelectedIds(): string[]
	getSelectedEdgeId(): string | null
	getViewport(): ViewportState
	viewportDidPan(): boolean
	isResizable(id: string): boolean
	lockViewport(lock: boolean): void
	setSelection(ids: string[]): void
	setEdgeSelected(edgeId: string | null): void
	previewTranslate(dx: number, dy: number): void
	commitTranslate(dx: number, dy: number): void
	cancelTranslate(): void
	previewResize(bounds: BpmnBounds): void
	commitResize(id: string, bounds: BpmnBounds): void
	previewConnect(ghostEnd: DiagPoint): void
	cancelConnect(): void
	commitConnect(sourceId: string, targetId: string): void
	previewRubberBand(origin: DiagPoint, current: DiagPoint): void
	cancelRubberBand(): void
	commitCreate(type: CreateShapeType, diagPoint: DiagPoint): void
	startLabelEdit(id: string): void
	setHovered(id: string | null): void
	executeDelete(ids: string[]): void
	executeCopy(): void
	executePaste(): void
	setTool(tool: Tool): void
	previewEndpointMove(edgeId: string, isStart: boolean, diagPoint: DiagPoint): void
	commitEndpointMove(edgeId: string, isStart: boolean, diagPoint: DiagPoint): void
	cancelEndpointMove(): void
	previewWaypointInsert(edgeId: string, segIdx: number, pt: DiagPoint): void
	commitWaypointInsert(edgeId: string, segIdx: number, pt: DiagPoint): void
	cancelWaypointInsert(): void
	previewWaypointMove(edgeId: string, wpIdx: number, pt: DiagPoint): void
	commitWaypointMove(edgeId: string, wpIdx: number, pt: DiagPoint): void
	cancelWaypointMove(): void
	showEdgeHoverDot(pt: DiagPoint): void
	hideEdgeHoverDot(): void
	showEdgeWaypointBalls(edgeId: string): void
	hideEdgeWaypointBalls(): void
	previewSpace(origin: DiagPoint, current: DiagPoint, axis: "h" | "v" | null): void
	commitSpace(origin: DiagPoint, current: DiagPoint, axis: "h" | "v" | null): void
	cancelSpace(): void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DRAG_THRESHOLD = 4 // screen pixels

function screenDist(ax: number, ay: number, bx: number, by: number): number {
	return Math.hypot(ax - bx, ay - by)
}

/**
 * Discriminated-union state machine for the BPMN editor.
 * Receives pointer + keyboard events from the editor and notifies the editor
 * via injected `Callbacks`.
 */
export class EditorStateMachine {
	private _mode: EditorMode = { mode: "select", sub: { name: "idle", hoveredId: null } }

	constructor(private readonly _cb: Callbacks) {}

	get mode(): EditorMode {
		return this._mode
	}

	setMode(mode: EditorMode): void {
		this._mode = mode
	}

	// ── Pointer down ─────────────────────────────────────────────────

	onPointerDown(e: PointerEvent, diag: DiagPoint, hit: HitResult): void {
		const mode = this._mode

		// Create mode: place shape and revert to select
		if (mode.mode === "create") {
			this._cb.commitCreate(mode.elementType, diag)
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
			this._cb.setTool("select")
			return
		}

		// Space mode: lock viewport and begin drag
		if (mode.mode === "space") {
			this._cb.lockViewport(true)
			this._mode = {
				mode: "space",
				sub: { name: "dragging", origin: diag, last: diag, axis: null },
			}
			return
		}

		// Pan mode: viewport handles this
		if (mode.mode === "pan") return

		// If already in connecting mode (entered from contextual toolbar), a click commits or cancels
		if (mode.sub.name === "connecting") {
			this._cb.lockViewport(false)
			if (hit.type === "shape" && hit.id !== mode.sub.sourceId) {
				this._cb.commitConnect(mode.sub.sourceId, hit.id)
			} else {
				this._cb.cancelConnect()
			}
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
			return
		}

		// In label-editing mode: clicking elsewhere commits label (via blur) — do nothing here
		if (mode.sub.name === "editing-label") return

		switch (hit.type) {
			case "handle": {
				if (!this._cb.isResizable(hit.shapeId)) break
				const shapes = this._cb.getShapes()
				const shape = shapes.find((s) => s.id === hit.shapeId)
				if (!shape) return
				this._cb.lockViewport(true)
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-handle",
						origin: diag,
						id: hit.shapeId,
						handle: hit.handle,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				}
				break
			}

			case "port": {
				this._cb.lockViewport(true)
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-port",
						origin: diag,
						sourceId: hit.shapeId,
						port: hit.port,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				}
				break
			}

			case "shape": {
				const selectedIds = this._cb.getSelectedIds()
				if (e.shiftKey) {
					const newIds = selectedIds.includes(hit.id)
						? selectedIds.filter((id) => id !== hit.id)
						: [...selectedIds, hit.id]
					this._cb.setSelection(newIds)
					this._mode = { mode: "select", sub: { name: "idle", hoveredId: hit.id } }
				} else {
					if (!selectedIds.includes(hit.id)) {
						this._cb.setSelection([hit.id])
					}
					this._mode = {
						mode: "select",
						sub: {
							name: "pointing-shape",
							origin: diag,
							id: hit.id,
							screenX: e.clientX,
							screenY: e.clientY,
						},
					}
				}
				break
			}

			case "edge": {
				this._cb.setEdgeSelected(hit.id)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "edge-segment": {
				this._cb.lockViewport(true)
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-edge-segment",
						edgeId: hit.id,
						segIdx: hit.segIdx,
						isHoriz: hit.isHoriz,
						projPt: hit.projPt,
						origin: diag,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				}
				break
			}

			case "edge-waypoint": {
				this._cb.lockViewport(true)
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-edge-waypoint",
						edgeId: hit.id,
						wpIdx: hit.wpIdx,
						pt: hit.pt,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				}
				break
			}

			case "edge-endpoint": {
				this._cb.lockViewport(true)
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-edge-endpoint",
						edgeId: hit.edgeId,
						isStart: hit.isStart,
						origin: diag,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				}
				break
			}

			case "canvas": {
				if (e.shiftKey) {
					this._cb.lockViewport(true)
					this._mode = {
						mode: "select",
						sub: { name: "rubber-band", origin: diag, current: diag },
					}
				} else {
					this._mode = {
						mode: "select",
						sub: {
							name: "pointing-canvas",
							origin: diag,
							screenX: e.clientX,
							screenY: e.clientY,
						},
					}
				}
				break
			}
		}
	}

	// ── Pointer move ─────────────────────────────────────────────────

	onPointerMove(e: PointerEvent, diag: DiagPoint, hit: HitResult): void {
		const mode = this._mode

		// Space mode drag
		if (mode.mode === "space" && mode.sub.name === "dragging") {
			const sub = mode.sub
			const absDx = Math.abs(diag.x - sub.origin.x)
			const absDy = Math.abs(diag.y - sub.origin.y)
			let axis = sub.axis
			if (axis === null && (absDx > 4 || absDy > 4)) {
				axis = absDx >= absDy ? "h" : "v"
			}
			this._mode = { mode: "space", sub: { ...sub, last: diag, axis } }
			this._cb.previewSpace(sub.origin, diag, axis)
			return
		}

		if (mode.mode !== "select") {
			if (mode.mode === "create") {
				// Ghost create: update overlay (editor reads state.mode to update ghost)
			}
			return
		}

		const sub = mode.sub

		switch (sub.name) {
			case "idle": {
				const hoveredId = hit.type === "shape" ? hit.id : null
				if (hoveredId !== sub.hoveredId) {
					this._cb.setHovered(hoveredId)
					this._mode = { mode: "select", sub: { name: "idle", hoveredId } }
				}
				if (hit.type === "edge-segment") {
					this._cb.showEdgeHoverDot(hit.projPt)
					this._cb.showEdgeWaypointBalls(hit.id)
				} else if (hit.type === "edge-waypoint") {
					this._cb.hideEdgeHoverDot()
					this._cb.showEdgeWaypointBalls(hit.id)
				} else {
					this._cb.hideEdgeHoverDot()
					this._cb.hideEdgeWaypointBalls()
				}
				break
			}

			case "pointing-shape": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY)
				if (dist > DRAG_THRESHOLD) {
					this._cb.lockViewport(true)
					this._mode = {
						mode: "select",
						sub: { name: "translating", origin: sub.origin, last: diag },
					}
					const dx = diag.x - sub.origin.x
					const dy = diag.y - sub.origin.y
					this._cb.previewTranslate(dx, dy)
				}
				break
			}

			case "translating": {
				const dx = diag.x - sub.origin.x
				const dy = diag.y - sub.origin.y
				this._mode = { mode: "select", sub: { ...sub, last: diag } }
				this._cb.previewTranslate(dx, dy)
				break
			}

			case "pointing-handle": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY)
				if (dist > DRAG_THRESHOLD) {
					const shapes = this._cb.getShapes()
					const shape = shapes.find((s) => s.id === sub.id)
					if (!shape) break
					const newBounds = applyResize(shape.shape.bounds, sub.handle, diag.x, diag.y)
					this._mode = {
						mode: "select",
						sub: {
							name: "resizing",
							id: sub.id,
							handle: sub.handle,
							original: shape.shape.bounds,
							current: diag,
						},
					}
					this._cb.previewResize(newBounds)
				}
				break
			}

			case "resizing": {
				const newBounds = applyResize(sub.original, sub.handle, diag.x, diag.y)
				this._mode = { mode: "select", sub: { ...sub, current: diag } }
				this._cb.previewResize(newBounds)
				break
			}

			case "pointing-port": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY)
				if (dist > DRAG_THRESHOLD) {
					this._mode = {
						mode: "select",
						sub: { name: "connecting", sourceId: sub.sourceId, ghostEnd: diag },
					}
					this._cb.previewConnect(diag)
				}
				break
			}

			case "connecting": {
				this._mode = { mode: "select", sub: { ...sub, ghostEnd: diag } }
				this._cb.previewConnect(diag)
				break
			}

			case "pointing-edge-endpoint": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY)
				if (dist > DRAG_THRESHOLD) {
					this._mode = {
						mode: "select",
						sub: {
							name: "dragging-edge-endpoint",
							edgeId: sub.edgeId,
							isStart: sub.isStart,
							origin: sub.origin,
						},
					}
					this._cb.previewEndpointMove(sub.edgeId, sub.isStart, diag)
				}
				break
			}

			case "dragging-edge-endpoint": {
				this._cb.previewEndpointMove(sub.edgeId, sub.isStart, diag)
				break
			}

			case "pointing-edge-segment": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY)
				if (dist > DRAG_THRESHOLD) {
					this._mode = {
						mode: "select",
						sub: {
							name: "dragging-edge-waypoint-new",
							edgeId: sub.edgeId,
							segIdx: sub.segIdx,
							origin: sub.origin,
						},
					}
					this._cb.previewWaypointInsert(sub.edgeId, sub.segIdx, diag)
				}
				break
			}

			case "dragging-edge-waypoint-new": {
				this._cb.previewWaypointInsert(sub.edgeId, sub.segIdx, diag)
				break
			}

			case "pointing-edge-waypoint": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY)
				if (dist > DRAG_THRESHOLD) {
					this._mode = {
						mode: "select",
						sub: {
							name: "dragging-edge-waypoint",
							edgeId: sub.edgeId,
							wpIdx: sub.wpIdx,
							origin: sub.pt,
						},
					}
					this._cb.previewWaypointMove(sub.edgeId, sub.wpIdx, diag)
				}
				break
			}

			case "dragging-edge-waypoint": {
				this._cb.previewWaypointMove(sub.edgeId, sub.wpIdx, diag)
				break
			}

			case "rubber-band": {
				this._mode = { mode: "select", sub: { ...sub, current: diag } }
				this._cb.previewRubberBand(sub.origin, diag)
				break
			}

			default:
				break
		}
	}

	// ── Pointer up ────────────────────────────────────────────────────

	onPointerUp(_e: PointerEvent, diag: DiagPoint, hit: HitResult): void {
		const mode = this._mode

		// Space mode commit
		if (mode.mode === "space") {
			if (mode.sub.name === "dragging") {
				this._cb.lockViewport(false)
				this._cb.commitSpace(mode.sub.origin, diag, mode.sub.axis)
				this._mode = { mode: "space", sub: { name: "idle" } }
			}
			return
		}

		if (mode.mode !== "select") return

		const sub = mode.sub

		switch (sub.name) {
			case "pointing-shape": {
				this._cb.setSelection([sub.id])
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: sub.id } }
				break
			}

			case "translating": {
				const dx = diag.x - sub.origin.x
				const dy = diag.y - sub.origin.y
				this._cb.lockViewport(false)
				this._cb.commitTranslate(dx, dy)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "pointing-handle": {
				this._cb.lockViewport(false)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "resizing": {
				const newBounds = applyResize(sub.original, sub.handle, diag.x, diag.y)
				this._cb.lockViewport(false)
				this._cb.commitResize(sub.id, newBounds)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "pointing-port": {
				this._cb.lockViewport(false)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "connecting": {
				this._cb.lockViewport(false)
				if (hit.type === "shape" && hit.id !== sub.sourceId) {
					this._cb.commitConnect(sub.sourceId, hit.id)
				} else {
					this._cb.cancelConnect()
				}
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "rubber-band": {
				this._cb.lockViewport(false)
				this._cb.cancelRubberBand()
				const minX = Math.min(sub.origin.x, sub.current.x)
				const maxX = Math.max(sub.origin.x, sub.current.x)
				const minY = Math.min(sub.origin.y, sub.current.y)
				const maxY = Math.max(sub.origin.y, sub.current.y)
				const shapes = this._cb.getShapes()
				const ids = shapes
					.filter((s) => {
						const b = s.shape.bounds
						return b.x + b.width > minX && b.x < maxX && b.y + b.height > minY && b.y < maxY
					})
					.map((s) => s.id)
				this._cb.setSelection(ids)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "pointing-edge-endpoint": {
				this._cb.lockViewport(false)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "dragging-edge-endpoint": {
				this._cb.lockViewport(false)
				this._cb.commitEndpointMove(sub.edgeId, sub.isStart, diag)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "pointing-edge-segment": {
				this._cb.lockViewport(false)
				// Tap without drag: select the edge
				this._cb.setEdgeSelected(sub.edgeId)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "dragging-edge-waypoint-new": {
				this._cb.lockViewport(false)
				this._cb.commitWaypointInsert(sub.edgeId, sub.segIdx, diag)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "pointing-edge-waypoint": {
				this._cb.lockViewport(false)
				this._cb.setEdgeSelected(sub.edgeId)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "dragging-edge-waypoint": {
				this._cb.lockViewport(false)
				this._cb.commitWaypointMove(sub.edgeId, sub.wpIdx, diag)
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			case "pointing-canvas": {
				if (!this._cb.viewportDidPan()) {
					this._cb.setSelection([])
				}
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
				break
			}

			default:
				break
		}
	}

	// ── Double-click ──────────────────────────────────────────────────

	onDblClick(_e: MouseEvent, _diag: DiagPoint, hit: HitResult): void {
		if (hit.type === "shape") {
			this._mode = { mode: "select", sub: { name: "editing-label", id: hit.id } }
			this._cb.startLabelEdit(hit.id)
		}
	}

	// ── Key down ──────────────────────────────────────────────────────

	onKeyDown(e: KeyboardEvent): void {
		const mode = this._mode

		if (mode.mode === "create" && e.key === "Escape") {
			e.preventDefault()
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
			this._cb.setTool("select")
			return
		}

		if (mode.mode === "space" && e.key === "Escape") {
			e.preventDefault()
			if (mode.sub.name === "dragging") {
				this._cb.lockViewport(false)
				this._cb.cancelSpace()
			}
			this._mode = { mode: "space", sub: { name: "idle" } }
			return
		}

		if (mode.mode !== "select") return

		const sub = mode.sub

		if (e.key === "Escape") {
			e.preventDefault()
			// Cancel in-progress operations
			if (sub.name === "translating") {
				this._cb.cancelTranslate()
				this._cb.lockViewport(false)
			} else if (
				sub.name === "rubber-band" ||
				sub.name === "pointing-handle" ||
				sub.name === "resizing" ||
				sub.name === "connecting" ||
				sub.name === "pointing-port"
			) {
				this._cb.lockViewport(false)
			} else if (sub.name === "pointing-edge-endpoint" || sub.name === "dragging-edge-endpoint") {
				this._cb.lockViewport(false)
				this._cb.cancelEndpointMove()
			} else if (sub.name === "pointing-edge-segment" || sub.name === "pointing-edge-waypoint") {
				this._cb.lockViewport(false)
			} else if (sub.name === "dragging-edge-waypoint-new") {
				this._cb.lockViewport(false)
				this._cb.cancelWaypointInsert()
			} else if (sub.name === "dragging-edge-waypoint") {
				this._cb.lockViewport(false)
				this._cb.cancelWaypointMove()
			}
			this._cb.setSelection([])
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } }
			return
		}

		if (e.key === "Delete" || e.key === "Backspace") {
			// Don't delete while label-editing
			if (sub.name === "editing-label") return
			e.preventDefault()
			const ids = this._cb.getSelectedIds()
			const edgeId = this._cb.getSelectedEdgeId()
			const allIds = edgeId ? [...ids, edgeId] : ids
			if (allIds.length > 0) {
				this._cb.executeDelete(allIds)
			}
			return
		}
	}
}

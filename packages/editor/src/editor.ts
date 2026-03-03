import {
	KeyboardHandler,
	ViewportController,
	computeDiagramBounds,
	createDefs,
	createGrid,
	injectStyles,
	render,
} from "@bpmn-sdk/canvas";
import type {
	CanvasApi,
	CanvasEvents,
	CanvasPlugin,
	FitMode,
	RenderedEdge,
	RenderedShape,
	Theme,
} from "@bpmn-sdk/canvas";
import { Bpmn } from "@bpmn-sdk/core";
import type { BpmnBounds, BpmnDefinitions, DiColor } from "@bpmn-sdk/core";
import { CommandStack } from "./command-stack.js";
import { injectEditorStyles } from "./css.js";
import {
	closestPort,
	computeWaypoints,
	computeWaypointsAvoiding,
	computeWaypointsWithPorts,
	diagramToScreen,
	labelBoundsForPosition,
	portFromWaypoint,
	screenToDiagram,
} from "./geometry.js";
import { LabelEditor } from "./label-editor.js";
import {
	changeElementType as changeElementTypeFn,
	copyElements,
	createAnnotation,
	createAnnotationWithLink,
	createBoundaryEvent,
	createConnection,
	createEmptyDefinitions,
	createShape,
	deleteElements,
	insertEdgeWaypoint,
	insertShapeOnEdge,
	moveEdgeWaypoint,
	moveShapes,
	pasteElements,
	removeCollinearWaypoints,
	resizeShape,
	updateEdgeEndpoint,
	updateLabel,
	updateLabelPosition,
	updateShapeColor,
} from "./modeling.js";
import type { Clipboard } from "./modeling.js";
import { OverlayRenderer } from "./overlay.js";
import { canConnect } from "./rules.js";
import { EditorStateMachine } from "./state-machine.js";
import type { Callbacks } from "./state-machine.js";
import { RESIZABLE_TYPES } from "./types.js";
import type {
	CreateShapeType,
	DiagPoint,
	EditorEvents,
	EditorOptions,
	HandleDir,
	HitResult,
	LabelPosition,
	PortDir,
	Tool,
} from "./types.js";

const NS = "http://www.w3.org/2000/svg";
let _instanceCounter = 0;

function defaultBounds(
	type: CreateShapeType,
	cx: number,
	cy: number,
): { x: number; y: number; width: number; height: number } {
	switch (type) {
		case "startEvent":
		case "messageStartEvent":
		case "timerStartEvent":
		case "conditionalStartEvent":
		case "signalStartEvent":
		case "endEvent":
		case "messageEndEvent":
		case "escalationEndEvent":
		case "errorEndEvent":
		case "compensationEndEvent":
		case "signalEndEvent":
		case "terminateEndEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
		case "messageCatchEvent":
		case "messageThrowEvent":
		case "timerCatchEvent":
		case "escalationThrowEvent":
		case "conditionalCatchEvent":
		case "linkCatchEvent":
		case "linkThrowEvent":
		case "compensationThrowEvent":
		case "signalCatchEvent":
		case "signalThrowEvent":
			return { x: cx - 18, y: cy - 18, width: 36, height: 36 };
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
		case "complexGateway":
			return { x: cx - 25, y: cy - 25, width: 50, height: 50 };
		case "subProcess":
		case "adHocSubProcess":
		case "transaction":
			return { x: cx - 100, y: cy - 60, width: 200, height: 120 };
		case "textAnnotation":
			return { x: cx - 50, y: cy - 25, width: 100, height: 50 };
		default:
			return { x: cx - 50, y: cy - 40, width: 100, height: 80 };
	}
}

function resolveEventPaletteType(bpmnType: string, defType: string): string {
	if (bpmnType === "startEvent") {
		if (defType === "message") return "messageStartEvent";
		if (defType === "timer") return "timerStartEvent";
		if (defType === "conditional") return "conditionalStartEvent";
		if (defType === "signal") return "signalStartEvent";
	}
	if (bpmnType === "endEvent") {
		if (defType === "message") return "messageEndEvent";
		if (defType === "escalation") return "escalationEndEvent";
		if (defType === "error") return "errorEndEvent";
		if (defType === "compensate") return "compensationEndEvent";
		if (defType === "signal") return "signalEndEvent";
		if (defType === "terminate") return "terminateEndEvent";
	}
	if (bpmnType === "intermediateCatchEvent") {
		if (defType === "message") return "messageCatchEvent";
		if (defType === "timer") return "timerCatchEvent";
		if (defType === "conditional") return "conditionalCatchEvent";
		if (defType === "link") return "linkCatchEvent";
		if (defType === "signal") return "signalCatchEvent";
	}
	if (bpmnType === "intermediateThrowEvent") {
		if (defType === "message") return "messageThrowEvent";
		if (defType === "escalation") return "escalationThrowEvent";
		if (defType === "link") return "linkThrowEvent";
		if (defType === "compensate") return "compensationThrowEvent";
		if (defType === "signal") return "signalThrowEvent";
	}
	return bpmnType;
}

const INTERMEDIATE_EVENT_TYPES = new Set<CreateShapeType>([
	"intermediateThrowEvent",
	"intermediateCatchEvent",
	"messageCatchEvent",
	"messageThrowEvent",
	"timerCatchEvent",
	"escalationThrowEvent",
	"conditionalCatchEvent",
	"linkCatchEvent",
	"linkThrowEvent",
	"compensationThrowEvent",
	"signalCatchEvent",
	"signalThrowEvent",
]);

const ACTIVITY_TYPES = new Set([
	"task",
	"serviceTask",
	"userTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
	"callActivity",
	"subProcess",
	"adHocSubProcess",
	"eventSubProcess",
	"transaction",
]);

function isIntermediateEventType(type: CreateShapeType): boolean {
	return INTERMEDIATE_EVENT_TYPES.has(type);
}

function isActivityType(type: string): boolean {
	return ACTIVITY_TYPES.has(type);
}

function snapToBoundary(
	center: DiagPoint,
	hostBounds: { x: number; y: number; width: number; height: number },
	r: number,
): { x: number; y: number; width: number; height: number } {
	// Clamp center to host boundary and return event bounds
	const left = hostBounds.x;
	const right = hostBounds.x + hostBounds.width;
	const top = hostBounds.y;
	const bottom = hostBounds.y + hostBounds.height;

	// Find the nearest point on the rect border
	const clampedX = Math.max(left, Math.min(right, center.x));
	const clampedY = Math.max(top, Math.min(bottom, center.y));

	// Determine which edge is closest
	const dLeft = Math.abs(center.x - left);
	const dRight = Math.abs(center.x - right);
	const dTop = Math.abs(center.y - top);
	const dBottom = Math.abs(center.y - bottom);
	const minD = Math.min(dLeft, dRight, dTop, dBottom);

	let snapX = clampedX;
	let snapY = clampedY;
	if (minD === dLeft) snapX = left;
	else if (minD === dRight) snapX = right;
	else if (minD === dTop) snapY = top;
	else snapY = bottom;

	// Clamp to host boundary so center is on the edge
	snapX = Math.max(left, Math.min(right, snapX));
	snapY = Math.max(top, Math.min(bottom, snapY));

	return { x: snapX - r, y: snapY - r, width: r * 2, height: r * 2 };
}

function intermediateEventDefType(type: CreateShapeType): string | null {
	switch (type) {
		case "messageCatchEvent":
		case "messageThrowEvent":
			return "message";
		case "timerCatchEvent":
			return "timer";
		case "escalationThrowEvent":
			return "escalation";
		case "conditionalCatchEvent":
			return "conditional";
		case "linkCatchEvent":
		case "linkThrowEvent":
			return "link";
		case "compensationThrowEvent":
			return "compensate";
		case "signalCatchEvent":
		case "signalThrowEvent":
			return "signal";
		default:
			return null;
	}
}

/**
 * BpmnEditor — a full BPMN 2.0 diagram editor with create, move, resize,
 * connect, delete, label-edit, undo/redo, and copy/paste.
 */
export class BpmnEditor {
	// ── DOM ────────────────────────────────────────────────────────────
	private readonly _id: string;
	private readonly _host: HTMLElement;
	private readonly _svg: SVGSVGElement;
	private readonly _viewportG: SVGGElement;
	private readonly _edgesG: SVGGElement;
	private readonly _shapesG: SVGGElement;
	private readonly _labelsG: SVGGElement;
	private readonly _overlayG: SVGGElement;
	private _gridPattern: SVGPatternElement | null = null;
	private _markerId = "";

	// ── Sub-systems ────────────────────────────────────────────────────
	private readonly _viewport: ViewportController;
	private readonly _keyboard: KeyboardHandler;
	private readonly _overlay: OverlayRenderer;
	private readonly _commandStack: CommandStack;
	private readonly _stateMachine: EditorStateMachine;
	private readonly _labelEditor: LabelEditor;
	private readonly _plugins: CanvasPlugin[] = [];

	// ── State ──────────────────────────────────────────────────────────
	private _shapes: RenderedShape[] = [];
	private _edges: RenderedEdge[] = [];
	private _defs: BpmnDefinitions | null = null;
	private _selectedIds: string[] = [];
	private _theme: Theme;
	private _fit: FitMode;
	private _clipboard: Clipboard | null = null;
	private _snapDelta: { dx: number; dy: number } | null = null;
	private _selectedEdgeId: string | null = null;
	private _edgeDropTarget: string | null = null;
	private _ghostSnapCenter: DiagPoint | null = null;
	private _createEdgeDropTarget: string | null = null;
	private _readOnly = false;
	private _boundaryHostId: string | null = null;

	// ── Events ─────────────────────────────────────────────────────────
	private readonly _listeners = new Map<string, Set<(...args: unknown[]) => void>>();

	// ── Resize observer ────────────────────────────────────────────────
	private readonly _ro: ResizeObserver;

	constructor(options: EditorOptions) {
		injectStyles();
		injectEditorStyles();

		this._id = String(_instanceCounter++);

		// Resolve initial theme — localStorage overrides the options.theme when persistTheme is on
		let initialTheme = options.theme ?? "auto";
		if (options.persistTheme) {
			try {
				const stored = localStorage.getItem("bpmn-theme");
				if (stored === "dark" || stored === "light" || stored === "auto") {
					initialTheme = stored;
				}
			} catch {
				// localStorage unavailable — fall back to options.theme
			}
		}
		this._theme = initialTheme;
		this._fit = options.fit ?? "contain";

		// ── DOM ──────────────────────────────────────────────────────
		const container = options.container;
		container.innerHTML = "";

		this._host = document.createElement("div");
		this._host.className = "bpmn-canvas-host";
		this._host.setAttribute("role", "application");
		this._host.setAttribute("aria-label", "BPMN Editor");
		this._host.setAttribute("tabindex", "0");
		this._applyTheme(this._theme);
		container.appendChild(this._host);

		this._svg = document.createElementNS(NS, "svg") as SVGSVGElement;
		this._svg.setAttribute("aria-hidden", "true");
		this._host.appendChild(this._svg);

		this._markerId = createDefs(this._svg, this._id);

		if (options.grid !== false) {
			this._gridPattern = createGrid(this._svg, this._id);
		}

		this._viewportG = document.createElementNS(NS, "g") as SVGGElement;
		this._svg.appendChild(this._viewportG);

		this._edgesG = document.createElementNS(NS, "g") as SVGGElement;
		this._shapesG = document.createElementNS(NS, "g") as SVGGElement;
		this._labelsG = document.createElementNS(NS, "g") as SVGGElement;
		this._overlayG = document.createElementNS(NS, "g") as SVGGElement;
		this._viewportG.appendChild(this._edgesG);
		this._viewportG.appendChild(this._shapesG);
		this._viewportG.appendChild(this._labelsG);
		this._viewportG.appendChild(this._overlayG);

		// ── Viewport controller ──────────────────────────────────────
		this._viewport = new ViewportController(
			this._host,
			this._svg,
			this._viewportG,
			this._gridPattern,
			(state) => this._emit("viewport:change", state),
		);

		// ── Overlay ──────────────────────────────────────────────────
		this._overlay = new OverlayRenderer(this._overlayG, this._markerId);

		// ── Command stack ────────────────────────────────────────────
		this._commandStack = new CommandStack();

		// ── State machine callbacks ──────────────────────────────────
		const callbacks: Callbacks = {
			getShapes: () => [...this._shapes],
			getSelectedIds: () => [...this._selectedIds],
			getViewport: () => this._viewport.state,
			viewportDidPan: () => this._viewport.didPan,
			isResizable: (id) => this._isResizable(id),
			lockViewport: (lock) => this._viewport.lock(lock),
			setSelection: (ids) => this._setSelection(ids),
			previewTranslate: (dx, dy) => this._previewTranslate(dx, dy),
			commitTranslate: (dx, dy) => this._commitTranslate(dx, dy),
			cancelTranslate: () => this._cancelTranslate(),
			previewResize: (bounds) => this._overlay.setResizePreview(bounds),
			commitResize: (id, bounds) => {
				this._overlay.setResizePreview(null);
				this._executeCommand((d) => resizeShape(d, id, bounds));
			},
			previewConnect: (ghostEnd) => {
				const src = this._connectSourceBounds();
				if (src) {
					const wps = computeWaypoints(src, {
						x: ghostEnd.x - 1,
						y: ghostEnd.y - 1,
						width: 2,
						height: 2,
					});
					this._overlay.setGhostConnection(wps);
				}
			},
			cancelConnect: () => this._overlay.setGhostConnection(null),
			commitConnect: (srcId, tgtId) => {
				this._overlay.setGhostConnection(null);
				this._doConnect(srcId, tgtId);
			},
			previewRubberBand: (origin, current) => this._overlay.setRubberBand(origin, current),
			cancelRubberBand: () => this._overlay.setRubberBand(null),
			commitCreate: (type, diagPoint) => this._doCreate(type, diagPoint),
			startLabelEdit: (id) => this._startLabelEdit(id),
			setHovered: (id) => this._overlay.setHovered(id, this._shapes),
			executeDelete: (ids) => {
				this._executeCommand((d) => deleteElements(d, ids));
				this._setSelection([]);
			},
			executeCopy: () => this._doCopy(),
			executePaste: () => this._doPaste(),
			setTool: (tool) => this.setTool(tool),
			getSelectedEdgeId: () => this._selectedEdgeId,
			setEdgeSelected: (edgeId) => this._setEdgeSelected(edgeId),
			previewEndpointMove: (edgeId, isStart, diagPoint) =>
				this._previewEndpointMove(edgeId, isStart, diagPoint),
			commitEndpointMove: (edgeId, isStart, diagPoint) =>
				this._commitEndpointMove(edgeId, isStart, diagPoint),
			cancelEndpointMove: () => {
				this._overlay.setEndpointDragGhost(null);
				if (this._selectedEdgeId) {
					const edge = this._edges.find((e) => e.id === this._selectedEdgeId);
					this._overlay.setEdgeEndpoints(edge?.edge.waypoints ?? null, this._selectedEdgeId);
				}
			},
			previewWaypointInsert: (edgeId, segIdx, pt) => {
				if (!this._defs) return;
				const snap = this._snapWaypoint(pt);
				const preview = insertEdgeWaypoint(this._defs, edgeId, segIdx, snap.pt);
				const edge = preview.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === edgeId);
				this._overlay.setEndpointDragGhost(edge?.waypoints ?? null);
				this._overlay.setAlignmentGuides(snap.guides);
			},
			commitWaypointInsert: (edgeId, segIdx, pt) => {
				this._overlay.setEndpointDragGhost(null);
				this._overlay.setAlignmentGuides([]);
				const snap = this._snapWaypoint(pt);
				this._executeCommand((d) =>
					removeCollinearWaypoints(insertEdgeWaypoint(d, edgeId, segIdx, snap.pt), edgeId),
				);
			},
			cancelWaypointInsert: () => {
				this._overlay.setEndpointDragGhost(null);
				this._overlay.setAlignmentGuides([]);
			},
			previewWaypointMove: (edgeId, wpIdx, pt) => {
				if (!this._defs) return;
				const snap = this._snapWaypoint(pt);
				const preview = moveEdgeWaypoint(this._defs, edgeId, wpIdx, snap.pt);
				const edge = preview.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === edgeId);
				this._overlay.setEndpointDragGhost(edge?.waypoints ?? null);
				this._overlay.setAlignmentGuides(snap.guides);
			},
			commitWaypointMove: (edgeId, wpIdx, pt) => {
				this._overlay.setEndpointDragGhost(null);
				this._overlay.setAlignmentGuides([]);
				const snap = this._snapWaypoint(pt);
				this._executeCommand((d) =>
					removeCollinearWaypoints(moveEdgeWaypoint(d, edgeId, wpIdx, snap.pt), edgeId),
				);
			},
			cancelWaypointMove: () => {
				this._overlay.setEndpointDragGhost(null);
				this._overlay.setAlignmentGuides([]);
			},
			showEdgeHoverDot: (pt) => {
				this._overlay.setEdgeHoverDot(pt);
			},
			hideEdgeHoverDot: () => {
				this._overlay.setEdgeHoverDot(null);
			},
			showEdgeWaypointBalls: (edgeId) => {
				const edge = this._edges.find((e) => e.id === edgeId);
				if (edge) this._overlay.setEdgeWaypointBalls(edge.edge.waypoints, edgeId);
			},
			hideEdgeWaypointBalls: () => {
				this._overlay.setEdgeWaypointBalls(null, null);
			},
			previewSpace: (origin, current, axis) => this._previewSpace(origin, current, axis),
			commitSpace: (origin, current, axis) => this._commitSpace(origin, current, axis),
			cancelSpace: () => this._cancelSpace(),
		};

		this._stateMachine = new EditorStateMachine(callbacks);

		// ── Label editor ─────────────────────────────────────────────
		this._labelEditor = new LabelEditor(
			this._host,
			(id, text) => {
				this._executeCommand((d) => updateLabel(d, id, text));
				this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
			},
			() => {
				this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
			},
		);

		// ── Keyboard ─────────────────────────────────────────────────
		this._keyboard = new KeyboardHandler(
			this._host,
			this._viewport,
			() => this.fitView(),
			(id) => {
				const shape = this._shapes.find((s) => s.id === id);
				if (shape) {
					this._emit("element:click", id, new PointerEvent("click"));
				}
			},
			(id) => this._emit("element:focus", id),
			() => this._emit("element:blur"),
		);

		this._host.addEventListener("keydown", this._onKeyDown);

		// ── Pointer events ────────────────────────────────────────────
		this._svg.addEventListener("pointerdown", this._onPointerDown);
		this._svg.addEventListener("pointermove", this._onPointerMove);
		this._svg.addEventListener("pointerup", this._onPointerUp);
		this._svg.addEventListener("dblclick", this._onDblClick);

		// ── Plugins ───────────────────────────────────────────────────
		if (options.plugins) {
			for (const plugin of options.plugins) {
				this._installPlugin(plugin);
			}
		}

		// ── Initial diagram ───────────────────────────────────────────
		if (options.xml) {
			this.load(options.xml);
		} else {
			this.loadDefinitions(createEmptyDefinitions());
		}

		this._ro = new ResizeObserver(() => {
			if (this._defs) this.fitView();
		});
		this._ro.observe(this._host);

		// Persist theme changes to localStorage when requested
		if (options.persistTheme) {
			new MutationObserver(() => {
				try {
					localStorage.setItem("bpmn-theme", this._host.getAttribute("data-theme") ?? "light");
				} catch {
					// ignore
				}
			}).observe(this._host, { attributes: true, attributeFilter: ["data-theme"] });
		}
	}

	// ── Public API ─────────────────────────────────────────────────────

	load(xml: string): void {
		const defs = Bpmn.parse(xml);
		this.loadDefinitions(defs);
	}

	loadDefinitions(defs: BpmnDefinitions): void {
		this._commandStack.clear();
		this._commandStack.push(defs);
		this._selectedIds = [];
		this._renderDefs(defs);
		if (this._fit !== "none") {
			requestAnimationFrame(() => this.fitView());
		}
	}

	exportXml(): string {
		return Bpmn.export(this._defs ?? createEmptyDefinitions());
	}

	/**
	 * Enables or disables read-only mode. In read-only mode the viewport
	 * (pan + zoom) still works but all editing actions are blocked.
	 */
	setReadOnly(enabled: boolean): void {
		this._readOnly = enabled;
		if (enabled) {
			this._setSelection([]);
			this._overlay.setGhostCreate(null);
			this._overlay.setAlignmentGuides([]);
			this._overlay.setDistanceGuides([]);
			this._setCreateEdgeDropHighlight(null);
			this._ghostSnapCenter = null;
			this._stateMachine.setMode({ mode: "pan" });
		} else {
			this.setTool("select");
		}
	}

	setTool(tool: Tool): void {
		if (this._readOnly) return;
		this._overlay.setGhostCreate(null);
		this._boundaryHostId = null;
		this._overlay.setBoundaryHostHighlight(null);
		this._overlay.setAlignmentGuides([]);
		this._setCreateEdgeDropHighlight(null);
		this._ghostSnapCenter = null;
		if (tool === "select") {
			this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
		} else if (tool === "pan") {
			this._stateMachine.setMode({ mode: "pan" });
		} else if (tool === "space") {
			this._stateMachine.setMode({ mode: "space", sub: { name: "idle" } });
		} else {
			const elementType = tool.slice(7) as CreateShapeType;
			this._stateMachine.setMode({ mode: "create", elementType });
		}
		if (tool.startsWith("create:")) {
			this._host.focus();
		}
		this._emit("editor:tool", tool);
	}

	setSelection(ids: string[]): void {
		this._setSelection(ids);
	}

	deleteSelected(): void {
		if (this._selectedIds.length === 0) return;
		const ids = [...this._selectedIds];
		this._executeCommand((d) => deleteElements(d, ids));
		this._setSelection([]);
	}

	undo(): void {
		const prev = this._commandStack.undo();
		if (prev) {
			this._renderDefs(prev);
			this._emit("diagram:change", prev);
		}
	}

	redo(): void {
		const next = this._commandStack.redo();
		if (next) {
			this._renderDefs(next);
			this._emit("diagram:change", next);
		}
	}

	canUndo(): boolean {
		return this._commandStack.canUndo();
	}

	canRedo(): boolean {
		return this._commandStack.canRedo();
	}

	getDefinitions(): BpmnDefinitions | null {
		return this._defs;
	}

	applyChange(fn: (defs: BpmnDefinitions) => BpmnDefinitions): void {
		this._executeCommand(fn);
	}

	fitView(padding = 40): void {
		if (!this._defs) return;
		const bounds = computeDiagramBounds(this._defs);
		if (!bounds) return;
		const svgW = this._svg.clientWidth;
		const svgH = this._svg.clientHeight;
		if (svgW === 0 || svgH === 0) return;
		const dW = bounds.maxX - bounds.minX;
		const dH = bounds.maxY - bounds.minY;
		if (dW === 0 || dH === 0) return;
		const scaleX = (svgW - padding * 2) / dW;
		const scaleY = (svgH - padding * 2) / dH;
		let scale = Math.min(scaleX, scaleY);
		if (this._fit === "center") scale = 1;
		const tx = (svgW - dW * scale) / 2 - bounds.minX * scale;
		const ty = (svgH - dH * scale) / 2 - bounds.minY * scale;
		this._viewport.set({ tx, ty, scale });
	}

	/** The host element that receives the `data-theme` attribute. */
	get container(): HTMLElement {
		return this._host;
	}

	getTheme(): "light" | "dark" {
		return this._host.getAttribute("data-theme") === "dark" ? "dark" : "light";
	}

	setTheme(theme: Theme): void {
		this._theme = theme;
		this._applyTheme(theme);
	}

	zoomIn(): void {
		const { width, height } = this._svg.getBoundingClientRect();
		this._viewport.zoomAt(width / 2, height / 2, 1.25);
	}

	zoomOut(): void {
		const { width, height } = this._svg.getBoundingClientRect();
		this._viewport.zoomAt(width / 2, height / 2, 0.8);
	}

	setZoom(scale: number): void {
		const { width, height } = this._svg.getBoundingClientRect();
		const vp = this._viewport.state;
		const cx = (width / 2 - vp.tx) / vp.scale;
		const cy = (height / 2 - vp.ty) / vp.scale;
		this._viewport.set({ tx: width / 2 - cx * scale, ty: height / 2 - cy * scale, scale });
	}

	selectAll(): void {
		this._setSelection(this._shapes.map((s) => s.id));
	}

	on<K extends keyof EditorEvents>(event: K, handler: EditorEvents[K]): () => void {
		let set = this._listeners.get(event);
		if (!set) {
			set = new Set();
			this._listeners.set(event, set);
		}
		set.add(handler as (...args: unknown[]) => void);
		return () => {
			const s = this._listeners.get(event);
			s?.delete(handler as (...args: unknown[]) => void);
		};
	}

	destroy(): void {
		this._ro.disconnect();
		this._viewport.destroy();
		this._keyboard.destroy();
		this._labelEditor.destroy();
		this._svg.removeEventListener("pointerdown", this._onPointerDown);
		this._svg.removeEventListener("pointermove", this._onPointerMove);
		this._svg.removeEventListener("pointerup", this._onPointerUp);
		this._svg.removeEventListener("dblclick", this._onDblClick);
		this._host.removeEventListener("keydown", this._onKeyDown);
		for (const plugin of this._plugins) plugin.uninstall?.();
		this._plugins.length = 0;
		this._listeners.clear();
		this._host.remove();
	}

	// ── Private helpers ────────────────────────────────────────────────

	private _renderDefs(defs: BpmnDefinitions): void {
		this._edgesG.innerHTML = "";
		this._shapesG.innerHTML = "";
		this._labelsG.innerHTML = "";
		const result = render(
			defs,
			this._edgesG,
			this._shapesG,
			this._labelsG,
			this._markerId,
			this._id,
		);
		this._shapes = result.shapes;
		this._edges = result.edges;
		this._defs = defs;

		// Add transparent hit-area polylines for edge clicking
		for (const edge of this._edges) {
			const waypoints = edge.edge.waypoints;
			if (waypoints.length < 2) continue;
			const points = waypoints.map((wp) => `${wp.x},${wp.y}`).join(" ");
			const hitArea = document.createElementNS(NS, "polyline") as SVGPolylineElement;
			hitArea.setAttribute("class", "bpmn-edge-hitarea");
			hitArea.setAttribute("data-bpmn-edge-hit", edge.id);
			hitArea.setAttribute("points", points);
			edge.element.appendChild(hitArea);
		}

		this._keyboard.setShapes(this._shapes);
		this._overlay.setSelection(this._selectedIds, this._shapes, this._getResizableIds());

		// Restore edge selection if the edge still exists after re-render
		if (this._selectedEdgeId) {
			const edge = this._edges.find((e) => e.id === this._selectedEdgeId);
			if (edge) {
				this._overlay.setEdgeEndpoints(edge.edge.waypoints, this._selectedEdgeId);
			} else {
				this._selectedEdgeId = null;
				this._overlay.setEdgeEndpoints(null, "");
			}
		}

		this._emit("diagram:load", defs);
	}

	private _executeCommand(fn: (d: BpmnDefinitions) => BpmnDefinitions): void {
		if (this._readOnly || !this._defs) return;
		const newDefs = fn(this._defs);
		this._commandStack.push(newDefs);
		this._renderDefs(newDefs);
		this._emit("diagram:change", newDefs);
	}

	private _setSelection(ids: string[]): void {
		this._selectedIds = ids;
		// Clear edge selection whenever shape selection changes
		if (this._selectedEdgeId) {
			this._selectedEdgeId = null;
			this._overlay.setEdgeEndpoints(null, "");
		}
		this._overlay.setSelection(ids, this._shapes, this._getResizableIds());
		this._emit("editor:select", ids);
	}

	private _previewTranslate(dx: number, dy: number): void {
		const alignSnap = this._computeSnap(dx, dy);
		const spacingResult = this._computeSpacingSnap(dx, dy);

		const alignAdjX = Math.abs(alignSnap.dx - dx);
		const alignAdjY = Math.abs(alignSnap.dy - dy);
		const spacingAdjX = Math.abs(spacingResult.dx - dx);
		const spacingAdjY = Math.abs(spacingResult.dy - dy);

		// Per axis: prefer spacing snap when it fires and is closer than alignment snap
		const useSpacingX = spacingAdjX > 0 && (!alignAdjX || spacingAdjX < alignAdjX);
		const useSpacingY = spacingAdjY > 0 && (!alignAdjY || spacingAdjY < alignAdjY);
		const finalDx = useSpacingX ? spacingResult.dx : alignSnap.dx;
		const finalDy = useSpacingY ? spacingResult.dy : alignSnap.dy;

		this._snapDelta = { dx: finalDx, dy: finalDy };
		for (const id of this._selectedIds) {
			const shape = this._shapes.find((s) => s.id === id);
			if (!shape) continue;
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x + finalDx} ${y + finalDy})`);
		}
		this._overlay.setAlignmentGuides(this._computeAlignGuides(finalDx, finalDy));
		this._overlay.setDistanceGuides(
			spacingResult.guides.filter((g) => {
				const isH = g.y1 === g.y2;
				return isH ? useSpacingX : useSpacingY;
			}),
		);
		this._setEdgeDropHighlight(this._findEdgeDropTarget(finalDx, finalDy));
	}

	private _cancelTranslate(): void {
		this._snapDelta = null;
		this._overlay.setAlignmentGuides([]);
		this._overlay.setDistanceGuides([]);
		this._setEdgeDropHighlight(null);
		for (const id of this._selectedIds) {
			const shape = this._shapes.find((s) => s.id === id);
			if (!shape) continue;
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
	}

	private _commitTranslate(dx: number, dy: number): void {
		const snap = this._snapDelta ?? { dx, dy };
		this._snapDelta = null;
		this._overlay.setAlignmentGuides([]);
		this._overlay.setDistanceGuides([]);
		const edgeDropId = this._edgeDropTarget;
		this._setEdgeDropHighlight(null);
		const moves = this._selectedIds.map((id) => ({ id, dx: snap.dx, dy: snap.dy }));
		const shapeId = this._selectedIds.length === 1 ? this._selectedIds[0] : undefined;
		if (edgeDropId && shapeId) {
			this._executeCommand((d) => insertShapeOnEdge(moveShapes(d, moves), edgeDropId, shapeId));
		} else {
			this._executeCommand((d) => moveShapes(d, moves));
		}
	}

	private _previewSpace(origin: DiagPoint, current: DiagPoint, axis: "h" | "v" | null): void {
		// Reset all shapes to their original positions first
		for (const shape of this._shapes) {
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
		if (!axis) return;

		const dx = current.x - origin.x;
		const dy = current.y - origin.y;

		for (const shape of this._shapes) {
			const b = shape.shape.bounds;
			const cx = b.x + b.width / 2;
			const cy = b.y + b.height / 2;
			let moveDx = 0;
			let moveDy = 0;
			if (axis === "h") {
				if (dx > 0 && cx > origin.x) moveDx = dx;
				else if (dx < 0 && cx < origin.x) moveDx = dx;
			} else {
				if (dy > 0 && cy > origin.y) moveDy = dy;
				else if (dy < 0 && cy < origin.y) moveDy = dy;
			}
			if (moveDx !== 0 || moveDy !== 0) {
				shape.element.setAttribute("transform", `translate(${b.x + moveDx} ${b.y + moveDy})`);
			}
		}

		const splitValue = axis === "h" ? origin.x : origin.y;
		this._overlay.setSpacePreview(axis, splitValue);
	}

	private _commitSpace(origin: DiagPoint, current: DiagPoint, axis: "h" | "v" | null): void {
		// Reset visual preview
		for (const shape of this._shapes) {
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
		this._overlay.setSpacePreview(null);

		if (!axis || !this._defs) return;

		const dx = current.x - origin.x;
		const dy = current.y - origin.y;
		if (dx === 0 && dy === 0) return;

		const moves: Array<{ id: string; dx: number; dy: number }> = [];
		for (const shape of this._shapes) {
			const b = shape.shape.bounds;
			const cx = b.x + b.width / 2;
			const cy = b.y + b.height / 2;
			if (axis === "h") {
				if (dx > 0 && cx > origin.x) moves.push({ id: shape.id, dx, dy: 0 });
				else if (dx < 0 && cx < origin.x) moves.push({ id: shape.id, dx, dy: 0 });
			} else {
				if (dy > 0 && cy > origin.y) moves.push({ id: shape.id, dx: 0, dy });
				else if (dy < 0 && cy < origin.y) moves.push({ id: shape.id, dx: 0, dy });
			}
		}

		if (moves.length > 0) {
			this._executeCommand((d) => moveShapes(d, moves));
		}
	}

	private _cancelSpace(): void {
		for (const shape of this._shapes) {
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
		this._overlay.setSpacePreview(null);
	}

	private _doCreate(type: CreateShapeType, diagPoint: DiagPoint): void {
		// Read edge drop target BEFORE clearing it — _setCreateEdgeDropHighlight(null) zeroes it out.
		const pendingEdgeDrop = this._createEdgeDropTarget;
		this._overlay.setGhostCreate(null);
		this._overlay.setAlignmentGuides([]);
		const actualCenter = this._ghostSnapCenter ?? diagPoint;
		this._ghostSnapCenter = null;
		this._setCreateEdgeDropHighlight(null);
		if (!this._defs) return;
		const bounds = defaultBounds(type, actualCenter.x, actualCenter.y);

		if (type === "textAnnotation") {
			const result = createAnnotation(this._defs, bounds);
			this._selectedIds = [result.id];
			this._commandStack.push(result.defs);
			this._renderDefs(result.defs);
			this._emit("diagram:change", result.defs);
			this._emit("editor:select", [result.id]);
			this._startLabelEdit(result.id);
			return;
		}

		// If hovering over an activity, create a boundary event
		const boundaryHostId = this._boundaryHostId;
		this._setBoundaryHost(null);

		if (boundaryHostId && isIntermediateEventType(type) && this._defs) {
			const hostShape = this._shapes.find((s) => s.id === boundaryHostId);
			if (hostShape) {
				const hostBounds = hostShape.shape.bounds;
				// Snap the event center to the nearest point on the host boundary
				const eventBounds = snapToBoundary(actualCenter, hostBounds, 18);
				// Map palette type to event definition type
				const eventDefType = intermediateEventDefType(type);
				const result = createBoundaryEvent(this._defs, boundaryHostId, eventDefType, eventBounds);
				this._selectedIds = [result.id];
				this._commandStack.push(result.defs);
				this._renderDefs(result.defs);
				this._emit("diagram:change", result.defs);
				this._emit("editor:select", [result.id]);
				return;
			}
		}

		const result = createShape(this._defs, type, bounds);
		this._selectedIds = [result.id];
		const finalDefs = pendingEdgeDrop
			? insertShapeOnEdge(result.defs, pendingEdgeDrop, result.id)
			: result.defs;
		this._commandStack.push(finalDefs);
		this._renderDefs(finalDefs);
		this._emit("diagram:change", finalDefs);
		this._emit("editor:select", [result.id]);
	}

	private _doConnect(srcId: string, tgtId: string): void {
		const srcShape = this._shapes.find((s) => s.id === srcId);
		const tgtShape = this._shapes.find((s) => s.id === tgtId);
		if (!srcShape || !tgtShape) return;
		const srcType = srcShape.flowElement?.type;
		const tgtType = tgtShape.flowElement?.type;
		if (srcType && tgtType && !canConnect(srcType, tgtType)) return;
		const obstacles = this._shapes
			.filter((s) => s.id !== srcId && s.id !== tgtId)
			.map((s) => s.shape.bounds);
		const waypoints = computeWaypointsAvoiding(
			srcShape.shape.bounds,
			tgtShape.shape.bounds,
			obstacles,
		);
		this._executeCommand((d) => createConnection(d, srcId, tgtId, waypoints).defs);
	}

	private _doCopy(): void {
		if (!this._defs || this._selectedIds.length === 0) return;
		this._clipboard = copyElements(this._defs, this._selectedIds);
	}

	private _doPaste(): void {
		if (!this._clipboard) return;
		const base = this._defs ?? createEmptyDefinitions();
		const result = pasteElements(base, this._clipboard, 20, 20);
		const newIds = [...result.newIds.values()];
		this._selectedIds = newIds;
		this._commandStack.push(result.defs);
		this._renderDefs(result.defs);
		this._emit("diagram:change", result.defs);
		this._emit("editor:select", newIds);
	}

	private _startLabelEdit(id: string): void {
		if (this._readOnly || !id) return;
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return;
		const defs = this._defs;
		if (!defs) return;
		const process = defs.processes[0];
		const currentText =
			process?.flowElements.find((el) => el.id === id)?.name ??
			process?.sequenceFlows.find((sf) => sf.id === id)?.name ??
			process?.textAnnotations.find((ta) => ta.id === id)?.text ??
			"";
		this._labelEditor.start(
			id,
			currentText,
			shape.shape.bounds,
			this._viewport.state,
			this._svg.getBoundingClientRect(),
		);
	}

	private _connectSourceBounds(): { x: number; y: number; width: number; height: number } | null {
		const mode = this._stateMachine.mode;
		if (mode.mode !== "select") return null;
		const sub = mode.sub;
		const sourceId =
			sub.name === "connecting" ? sub.sourceId : sub.name === "pointing-port" ? sub.sourceId : null;
		if (!sourceId) return null;
		const shape = this._shapes.find((s) => s.id === sourceId);
		return shape ? shape.shape.bounds : null;
	}

	// ── New public helpers ─────────────────────────────────────────────

	/** Returns screen-space bounds of a shape (for positioning overlays). */
	getShapeBounds(id: string): { x: number; y: number; width: number; height: number } | null {
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return null;
		const b = shape.shape.bounds;
		const vp = this._viewport.state;
		const svgRect = this._svg.getBoundingClientRect();
		const { x, y } = diagramToScreen(b.x, b.y, vp, svgRect);
		return { x, y, width: b.width * vp.scale, height: b.height * vp.scale };
	}

	/** Returns the BPMN element type for a given id, or null if not found. */
	getElementType(id: string): string | null {
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) {
			if (this._edges.some((e) => e.id === id)) return "sequenceFlow";
			return null;
		}
		if (shape.annotation !== undefined) return "textAnnotation";
		const bpmnType = shape.flowElement?.type ?? null;
		if (!bpmnType) return null;
		// For events, resolve to specific palette type based on event definition
		const el = shape.flowElement;
		if (
			el &&
			(el.type === "startEvent" ||
				el.type === "endEvent" ||
				el.type === "intermediateCatchEvent" ||
				el.type === "intermediateThrowEvent")
		) {
			const def = el.eventDefinitions[0];
			if (def) {
				return resolveEventPaletteType(el.type, def.type);
			}
		}
		return bpmnType;
	}

	/**
	 * Creates a new element of the given type connected to the source shape,
	 * using smart placement (right → bottom → top, avoids overlaps).
	 * Returns the new element's id.
	 */
	addConnectedElement(sourceId: string, type: CreateShapeType): string | null {
		if (!this._defs) return null;
		const srcShape = this._shapes.find((s) => s.id === sourceId);
		if (!srcShape) return null;
		const srcBounds = srcShape.shape.bounds;

		let w = 100;
		let h = 80;
		if (type === "startEvent" || type === "endEvent") {
			w = 36;
			h = 36;
		} else if (
			type === "exclusiveGateway" ||
			type === "parallelGateway" ||
			type === "inclusiveGateway" ||
			type === "eventBasedGateway"
		) {
			w = 50;
			h = 50;
		}

		const newBounds = this._smartPlaceBounds(srcBounds, sourceId, w, h);
		const obstacles = this._shapes.filter((s) => s.id !== sourceId).map((s) => s.shape.bounds);
		const r1 = createShape(this._defs, type, newBounds);
		const waypoints = computeWaypointsAvoiding(srcBounds, newBounds, obstacles);
		const r2 = createConnection(r1.defs, sourceId, r1.id, waypoints);

		this._selectedIds = [r1.id];
		this._commandStack.push(r2.defs);
		this._renderDefs(r2.defs);
		this._emit("diagram:change", r2.defs);
		this._emit("editor:select", [r1.id]);
		return r1.id;
	}

	private _smartPlaceBounds(
		srcBounds: BpmnBounds,
		sourceId: string,
		w: number,
		h: number,
	): BpmnBounds {
		const GAP = 60;
		const srcCx = srcBounds.x + srcBounds.width / 2;
		const srcCy = srcBounds.y + srcBounds.height / 2;

		// Find directions already occupied by outgoing connections
		const takenDirs = new Set<string>();
		const process = this._defs?.processes[0];
		if (process) {
			for (const flow of process.sequenceFlows) {
				if (flow.sourceRef !== sourceId) continue;
				const tgt = this._shapes.find((s) => s.id === flow.targetRef);
				if (!tgt) continue;
				const tCx = tgt.shape.bounds.x + tgt.shape.bounds.width / 2;
				const tCy = tgt.shape.bounds.y + tgt.shape.bounds.height / 2;
				const ddx = tCx - srcCx;
				const ddy = tCy - srcCy;
				const dir =
					Math.abs(ddx) >= Math.abs(ddy)
						? ddx >= 0
							? "right"
							: "left"
						: ddy >= 0
							? "bottom"
							: "top";
				takenDirs.add(dir);
			}
		}

		// Try primary candidates: right → bottom → top
		const candidates: Array<{ dir: string; bounds: BpmnBounds }> = [
			{
				dir: "right",
				bounds: { x: srcBounds.x + srcBounds.width + GAP, y: srcCy - h / 2, width: w, height: h },
			},
			{
				dir: "bottom",
				bounds: {
					x: srcCx - w / 2,
					y: srcBounds.y + srcBounds.height + GAP,
					width: w,
					height: h,
				},
			},
			{
				dir: "top",
				bounds: { x: srcCx - w / 2, y: srcBounds.y - GAP - h, width: w, height: h },
			},
		];

		for (const { dir, bounds } of candidates) {
			if (!takenDirs.has(dir) && !this._overlapsAny(bounds)) return bounds;
		}

		// All primary positions blocked — increase gap for bottom/top
		for (let extra = GAP * 2; extra <= GAP * 6; extra += GAP) {
			const bot: BpmnBounds = {
				x: srcCx - w / 2,
				y: srcBounds.y + srcBounds.height + extra,
				width: w,
				height: h,
			};
			if (!this._overlapsAny(bot)) return bot;
			const top: BpmnBounds = {
				x: srcCx - w / 2,
				y: srcBounds.y - extra - h,
				width: w,
				height: h,
			};
			if (!this._overlapsAny(top)) return top;
		}

		// Absolute fallback
		return { x: srcBounds.x + srcBounds.width + GAP * 5, y: srcCy - h / 2, width: w, height: h };
	}

	private _overlapsAny(bounds: BpmnBounds): boolean {
		const MARGIN = 10;
		for (const shape of this._shapes) {
			const b = shape.shape.bounds;
			if (
				bounds.x < b.x + b.width + MARGIN &&
				bounds.x + bounds.width + MARGIN > b.x &&
				bounds.y < b.y + b.height + MARGIN &&
				bounds.y + bounds.height + MARGIN > b.y
			) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Sets the external label position for an event or gateway shape.
	 */
	setLabelPosition(shapeId: string, position: LabelPosition): void {
		const shape = this._shapes.find((s) => s.id === shapeId);
		if (!shape) return;
		const labelBounds = labelBoundsForPosition(shape.shape.bounds, position);
		this._executeCommand((d) => updateLabelPosition(d, shapeId, labelBounds));
	}

	/** Copies then pastes the current selection with a small offset. */
	duplicate(): void {
		this._doCopy();
		this._doPaste();
	}

	/**
	 * Enters connection-drawing mode with the given shape as source.
	 * The user then moves the mouse and clicks a target shape to complete the connection.
	 */
	startConnectionFrom(sourceId: string): void {
		const shape = this._shapes.find((s) => s.id === sourceId);
		if (!shape) return;
		this._viewport.lock(true);
		this._stateMachine.setMode({
			mode: "select",
			sub: { name: "connecting", sourceId, ghostEnd: { x: 0, y: 0 } },
		});
	}

	/** Creates a text annotation linked to the given source shape via an association. */
	createAnnotationFor(sourceId: string): void {
		if (!this._defs) return;
		const srcShape = this._shapes.find((s) => s.id === sourceId);
		if (!srcShape) return;
		const srcBounds = srcShape.shape.bounds;

		// Place annotation above-right of source
		const annW = 100;
		const annH = 50;
		const annBounds = {
			x: srcBounds.x + srcBounds.width + 30,
			y: srcBounds.y - annH - 10,
			width: annW,
			height: annH,
		};

		const result = createAnnotationWithLink(this._defs, annBounds, sourceId, srcBounds);
		this._selectedIds = [result.annotationId];
		this._commandStack.push(result.defs);
		this._renderDefs(result.defs);
		this._emit("diagram:change", result.defs);
		this._emit("editor:select", [result.annotationId]);
		this._startLabelEdit(result.annotationId);
	}

	/** Updates the color of a shape in the diagram. Pass `{}` to clear colors. */
	updateColor(id: string, color: DiColor): void {
		this._executeCommand((d) => updateShapeColor(d, id, color));
	}

	// ── Private helpers ────────────────────────────────────────────────

	private _setEdgeSelected(edgeId: string | null): void {
		// Clear shape selection when edge is selected
		if (edgeId && this._selectedIds.length > 0) {
			this._selectedIds = [];
			this._overlay.setSelection([], this._shapes);
		}
		this._selectedEdgeId = edgeId;
		if (edgeId) {
			const edge = this._edges.find((e) => e.id === edgeId);
			this._overlay.setEdgeEndpoints(edge?.edge.waypoints ?? null, edgeId);
			this._emit("editor:select", [edgeId]);
		} else {
			this._overlay.setEdgeEndpoints(null, "");
			this._emit("editor:select", []);
		}
	}

	/** Changes a flow element's type (e.g. exclusiveGateway → parallelGateway). */
	changeElementType(id: string, newType: CreateShapeType): void {
		this._executeCommand((d) => changeElementTypeFn(d, id, newType));
	}

	private _findEdgeDropTarget(dx: number, dy: number): string | null {
		if (this._selectedIds.length !== 1) return null;
		const id = this._selectedIds[0];
		if (!id || !this._defs) return null;
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return null;

		const b = shape.shape.bounds;
		const cx = b.x + dx + b.width / 2;
		const cy = b.y + dy + b.height / 2;

		const process = this._defs.processes[0];
		if (!process) return null;

		const TOLERANCE = 20;

		for (const edge of this._edges) {
			const flow = process.sequenceFlows.find((sf) => sf.id === edge.id);
			if (!flow) continue;
			// Skip edges that are already connected to the shape being moved
			if (flow.sourceRef === id || flow.targetRef === id) continue;

			const wps = edge.edge.waypoints;
			for (let i = 0; i < wps.length - 1; i++) {
				const a = wps[i];
				const b2 = wps[i + 1];
				if (!a || !b2) continue;

				const minX = Math.min(a.x, b2.x) - TOLERANCE;
				const maxX = Math.max(a.x, b2.x) + TOLERANCE;
				const minY = Math.min(a.y, b2.y) - TOLERANCE;
				const maxY = Math.max(a.y, b2.y) + TOLERANCE;

				if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
					return edge.id;
				}
			}
		}
		return null;
	}

	private _setEdgeDropHighlight(edgeId: string | null): void {
		if (this._edgeDropTarget) {
			const prev = this._edges.find((e) => e.id === this._edgeDropTarget);
			prev?.element.classList.remove("bpmn-edge-split-highlight");
		}
		this._edgeDropTarget = edgeId;
		if (edgeId) {
			const edge = this._edges.find((e) => e.id === edgeId);
			edge?.element.classList.add("bpmn-edge-split-highlight");
		}
	}

	private _previewEndpointMove(edgeId: string, isStart: boolean, diagPoint: DiagPoint): void {
		if (!this._defs) return;
		const edge = this._edges.find((e) => e.id === edgeId);
		if (!edge) return;
		const flow = this._defs.processes[0]?.sequenceFlows.find((sf) => sf.id === edgeId);
		if (!flow) return;
		const plane = this._defs.diagrams[0]?.plane;
		if (!plane) return;
		const srcDi = plane.shapes.find((s) => s.bpmnElement === flow.sourceRef);
		const tgtDi = plane.shapes.find((s) => s.bpmnElement === flow.targetRef);
		if (!srcDi || !tgtDi) return;
		const waypoints = edge.edge.waypoints;
		let srcPort: PortDir;
		let tgtPort: PortDir;
		if (isStart) {
			srcPort = closestPort(diagPoint, srcDi.bounds);
			const lastWp = waypoints[waypoints.length - 1];
			tgtPort = lastWp ? portFromWaypoint(lastWp, tgtDi.bounds) : "left";
		} else {
			const firstWp = waypoints[0];
			srcPort = firstWp ? portFromWaypoint(firstWp, srcDi.bounds) : "right";
			tgtPort = closestPort(diagPoint, tgtDi.bounds);
		}
		const newWaypoints = computeWaypointsWithPorts(srcDi.bounds, srcPort, tgtDi.bounds, tgtPort);
		this._overlay.setEndpointDragGhost(newWaypoints);
	}

	private _commitEndpointMove(edgeId: string, isStart: boolean, diagPoint: DiagPoint): void {
		if (!this._defs) return;
		this._overlay.setEndpointDragGhost(null);
		const edge = this._edges.find((e) => e.id === edgeId);
		if (!edge) return;
		const flow = this._defs.processes[0]?.sequenceFlows.find((sf) => sf.id === edgeId);
		if (!flow) return;
		const plane = this._defs.diagrams[0]?.plane;
		if (!plane) return;
		const srcDi = plane.shapes.find((s) => s.bpmnElement === flow.sourceRef);
		const tgtDi = plane.shapes.find((s) => s.bpmnElement === flow.targetRef);
		if (!srcDi || !tgtDi) return;
		const newPort = isStart
			? closestPort(diagPoint, srcDi.bounds)
			: closestPort(diagPoint, tgtDi.bounds);
		this._executeCommand((d) => updateEdgeEndpoint(d, edgeId, isStart, newPort));
	}

	private _isResizable(id: string): boolean {
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return false;
		if (shape.annotation !== undefined) return true;
		return shape.flowElement !== undefined && RESIZABLE_TYPES.has(shape.flowElement.type);
	}

	private _getResizableIds(): Set<string> {
		const ids = new Set<string>();
		for (const shape of this._shapes) {
			if (
				shape.annotation !== undefined ||
				(shape.flowElement && RESIZABLE_TYPES.has(shape.flowElement.type))
			) {
				ids.add(shape.id);
			}
		}
		return ids;
	}

	// ── Snap / alignment guides ───────────────────────────────────────

	private _computeSnap(dx: number, dy: number): { dx: number; dy: number } {
		const selectedSet = new Set(this._selectedIds);
		const movingShapes = this._shapes.filter((s) => selectedSet.has(s.id));
		const staticShapes = this._shapes.filter((s) => !selectedSet.has(s.id));
		if (movingShapes.length === 0) return { dx, dy };

		const scale = this._viewport.state.scale;
		const threshold = 8 / scale;

		const movingXVals: number[] = [];
		const movingYVals: number[] = [];
		for (const s of movingShapes) {
			const b = s.shape.bounds;
			movingXVals.push(b.x + dx, b.x + dx + b.width / 2, b.x + dx + b.width);
			movingYVals.push(b.y + dy, b.y + dy + b.height / 2, b.y + dy + b.height);
		}

		const staticXVals: number[] = [];
		const staticYVals: number[] = [];
		for (const s of staticShapes) {
			const b = s.shape.bounds;
			staticXVals.push(b.x, b.x + b.width / 2, b.x + b.width);
			staticYVals.push(b.y, b.y + b.height / 2, b.y + b.height);
		}
		// Include original positions of moving shapes as virtual snap targets
		for (const s of movingShapes) {
			const b = s.shape.bounds;
			staticXVals.push(b.x, b.x + b.width / 2, b.x + b.width);
			staticYVals.push(b.y, b.y + b.height / 2, b.y + b.height);
		}

		let bestDx = dx;
		let bestDy = dy;
		let minDistX = threshold;
		let minDistY = threshold;

		for (const mx of movingXVals) {
			for (const sx of staticXVals) {
				const dist = Math.abs(mx - sx);
				if (dist < minDistX) {
					minDistX = dist;
					bestDx = dx + (sx - mx);
				}
			}
		}

		for (const my of movingYVals) {
			for (const sy of staticYVals) {
				const dist = Math.abs(my - sy);
				if (dist < minDistY) {
					minDistY = dist;
					bestDy = dy + (sy - my);
				}
			}
		}

		return { dx: bestDx, dy: bestDy };
	}

	private _computeAlignGuides(
		dx: number,
		dy: number,
	): Array<{ x1: number; y1: number; x2: number; y2: number }> {
		const selectedSet = new Set(this._selectedIds);
		const movingShapes = this._shapes.filter((s) => selectedSet.has(s.id));
		const staticShapes = this._shapes.filter((s) => !selectedSet.has(s.id));
		if (movingShapes.length === 0) return [];

		const guides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		const EXT = 2000;
		// Include original positions of moving shapes as virtual reference points
		const allStaticRef = [...staticShapes, ...movingShapes];

		for (const ms of movingShapes) {
			const mb = ms.shape.bounds;
			const mxVals = [mb.x + dx, mb.x + dx + mb.width / 2, mb.x + dx + mb.width];
			const myVals = [mb.y + dy, mb.y + dy + mb.height / 2, mb.y + dy + mb.height];

			for (const ss of allStaticRef) {
				const sb = ss.shape.bounds;
				const sxVals = [sb.x, sb.x + sb.width / 2, sb.x + sb.width];
				const syVals = [sb.y, sb.y + sb.height / 2, sb.y + sb.height];

				for (const mx of mxVals) {
					for (const sx of sxVals) {
						if (Math.abs(mx - sx) < 1) {
							guides.push({ x1: mx, y1: -EXT, x2: mx, y2: EXT });
						}
					}
				}
				for (const my of myVals) {
					for (const sy of syVals) {
						if (Math.abs(my - sy) < 1) {
							guides.push({ x1: -EXT, y1: my, x2: EXT, y2: my });
						}
					}
				}
			}
		}

		return guides;
	}

	// ── Spacing snap (equal-distance guides) ──────────────────────────

	private _computeSpacingSnap(
		dx: number,
		dy: number,
	): { dx: number; dy: number; guides: Array<{ x1: number; y1: number; x2: number; y2: number }> } {
		const selectedSet = new Set(this._selectedIds);
		const movingShapes = this._shapes.filter((s) => selectedSet.has(s.id));
		const staticShapes = this._shapes.filter((s) => !selectedSet.has(s.id));
		if (movingShapes.length !== 1 || staticShapes.length < 2) {
			return { dx, dy, guides: [] };
		}

		const movingShape = movingShapes[0];
		if (!movingShape) return { dx, dy, guides: [] };
		const moving = movingShape.shape.bounds;
		const scale = this._viewport.state.scale;
		const threshold = 8 / scale;

		let bestDx = dx;
		let bestDy = dy;
		let minDistX = threshold;
		let minDistY = threshold;
		const hGuides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		const vGuides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

		const mCy = moving.y + dy + moving.height / 2;
		const mCx = moving.x + dx + moving.width / 2;

		// Horizontal spacing: for each pair (A, B) where B is to the right of A
		for (const A of staticShapes) {
			const aRight = A.shape.bounds.x + A.shape.bounds.width;
			for (const B of staticShapes) {
				if (A.id === B.id) continue;
				const bLeft = B.shape.bounds.x;
				if (bLeft <= aRight) continue;
				const gap = bLeft - aRight;

				// Candidate: moving is to the right of B by the same gap
				const bRight = B.shape.bounds.x + B.shape.bounds.width;
				const candLeft = bRight + gap;
				const distX = Math.abs(moving.x + dx - candLeft);
				if (distX < minDistX) {
					minDistX = distX;
					bestDx = dx + (candLeft - (moving.x + dx));
					hGuides.length = 0;
					hGuides.push(
						{ x1: aRight, y1: mCy, x2: bLeft, y2: mCy },
						{ x1: bRight, y1: mCy, x2: candLeft, y2: mCy },
					);
				}

				// Candidate: moving is to the left of A by the same gap
				const aLeft = A.shape.bounds.x;
				const candRight = aLeft - gap;
				const movRight = moving.x + dx + moving.width;
				const distX2 = Math.abs(movRight - candRight);
				if (distX2 < minDistX) {
					minDistX = distX2;
					bestDx = dx + (candRight - movRight);
					hGuides.length = 0;
					hGuides.push(
						{ x1: candRight, y1: mCy, x2: aLeft, y2: mCy },
						{ x1: aRight, y1: mCy, x2: bLeft, y2: mCy },
					);
				}
			}
		}

		// Vertical spacing: for each pair (A, B) where B is below A
		for (const A of staticShapes) {
			const aBottom = A.shape.bounds.y + A.shape.bounds.height;
			for (const B of staticShapes) {
				if (A.id === B.id) continue;
				const bTop = B.shape.bounds.y;
				if (bTop <= aBottom) continue;
				const gap = bTop - aBottom;

				// Candidate: moving is below B by the same gap
				const bBottom = B.shape.bounds.y + B.shape.bounds.height;
				const candTop = bBottom + gap;
				const distY = Math.abs(moving.y + dy - candTop);
				if (distY < minDistY) {
					minDistY = distY;
					bestDy = dy + (candTop - (moving.y + dy));
					vGuides.length = 0;
					vGuides.push(
						{ x1: mCx, y1: aBottom, x2: mCx, y2: bTop },
						{ x1: mCx, y1: bBottom, x2: mCx, y2: candTop },
					);
				}

				// Candidate: moving is above A by the same gap
				const aTop = A.shape.bounds.y;
				const candBottom = aTop - gap;
				const movBottom = moving.y + dy + moving.height;
				const distY2 = Math.abs(movBottom - candBottom);
				if (distY2 < minDistY) {
					minDistY = distY2;
					bestDy = dy + (candBottom - movBottom);
					vGuides.length = 0;
					vGuides.push(
						{ x1: mCx, y1: candBottom, x2: mCx, y2: aTop },
						{ x1: mCx, y1: aBottom, x2: mCx, y2: bTop },
					);
				}
			}
		}

		return { dx: bestDx, dy: bestDy, guides: [...hGuides, ...vGuides] };
	}

	// ── Create-mode helpers ────────────────────────────────────────────

	private _computeCreateSnap(bounds: BpmnBounds): BpmnBounds {
		if (this._shapes.length === 0) return bounds;
		const scale = this._viewport.state.scale;
		const threshold = 8 / scale;

		const bxVals = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
		const byVals = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

		const sxVals: number[] = [];
		const syVals: number[] = [];
		for (const s of this._shapes) {
			const b = s.shape.bounds;
			sxVals.push(b.x, b.x + b.width / 2, b.x + b.width);
			syVals.push(b.y, b.y + b.height / 2, b.y + b.height);
		}

		let bestDx = 0;
		let bestDy = 0;
		let minDistX = threshold;
		let minDistY = threshold;

		for (const bx of bxVals) {
			for (const sx of sxVals) {
				const dist = Math.abs(bx - sx);
				if (dist < minDistX) {
					minDistX = dist;
					bestDx = sx - bx;
				}
			}
		}
		for (const by of byVals) {
			for (const sy of syVals) {
				const dist = Math.abs(by - sy);
				if (dist < minDistY) {
					minDistY = dist;
					bestDy = sy - by;
				}
			}
		}

		return { ...bounds, x: bounds.x + bestDx, y: bounds.y + bestDy };
	}

	private _computeCreateGuides(
		bounds: BpmnBounds,
	): Array<{ x1: number; y1: number; x2: number; y2: number }> {
		const guides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		const EXT = 2000;
		const bxVals = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
		const byVals = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

		for (const s of this._shapes) {
			const sb = s.shape.bounds;
			const sxVals = [sb.x, sb.x + sb.width / 2, sb.x + sb.width];
			const syVals = [sb.y, sb.y + sb.height / 2, sb.y + sb.height];
			for (const bx of bxVals) {
				for (const sx of sxVals) {
					if (Math.abs(bx - sx) < 1) guides.push({ x1: bx, y1: -EXT, x2: bx, y2: EXT });
				}
			}
			for (const by of byVals) {
				for (const sy of syVals) {
					if (Math.abs(by - sy) < 1) guides.push({ x1: -EXT, y1: by, x2: EXT, y2: by });
				}
			}
		}

		return guides;
	}

	private _findCreateEdgeDrop(bounds: BpmnBounds): string | null {
		if (!this._defs) return null;
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		const process = this._defs.processes[0];
		if (!process) return null;
		const TOLERANCE = 20;
		for (const edge of this._edges) {
			const flow = process.sequenceFlows.find((sf) => sf.id === edge.id);
			if (!flow) continue;
			const wps = edge.edge.waypoints;
			for (let i = 0; i < wps.length - 1; i++) {
				const a = wps[i];
				const b = wps[i + 1];
				if (!a || !b) continue;
				const minX = Math.min(a.x, b.x) - TOLERANCE;
				const maxX = Math.max(a.x, b.x) + TOLERANCE;
				const minY = Math.min(a.y, b.y) - TOLERANCE;
				const maxY = Math.max(a.y, b.y) + TOLERANCE;
				if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) return edge.id;
			}
		}
		return null;
	}

	private _setBoundaryHost(shapeId: string | null): void {
		if (this._boundaryHostId === shapeId) return;
		this._boundaryHostId = shapeId;
		if (shapeId) {
			const shape = this._shapes.find((s) => s.id === shapeId);
			this._overlay.setBoundaryHostHighlight(shape ? shape.shape.bounds : null);
		} else {
			this._overlay.setBoundaryHostHighlight(null);
		}
	}

	private _setCreateEdgeDropHighlight(edgeId: string | null): void {
		if (this._createEdgeDropTarget === edgeId) return;
		if (this._createEdgeDropTarget) {
			const prev = this._edges.find((e) => e.id === this._createEdgeDropTarget);
			prev?.element.classList.remove("bpmn-edge-split-highlight");
		}
		this._createEdgeDropTarget = edgeId;
		if (edgeId) {
			const edge = this._edges.find((e) => e.id === edgeId);
			edge?.element.classList.add("bpmn-edge-split-highlight");
		}
	}

	// ── Pointer event handlers ─────────────────────────────────────────

	private readonly _onPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onPointerDown(e, diag, hit);
	};

	private readonly _onPointerMove = (e: PointerEvent): void => {
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onPointerMove(e, diag, hit);
		const mode = this._stateMachine.mode;
		if (mode.mode === "create") {
			const rawBounds = defaultBounds(mode.elementType, diag.x, diag.y);
			const snapped = this._computeCreateSnap(rawBounds);
			const snappedCenter: DiagPoint = {
				x: snapped.x + snapped.width / 2,
				y: snapped.y + snapped.height / 2,
			};
			this._ghostSnapCenter = snappedCenter;
			this._overlay.setGhostCreate(mode.elementType, snappedCenter);
			this._overlay.setAlignmentGuides(this._computeCreateGuides(snapped));
			this._setCreateEdgeDropHighlight(this._findCreateEdgeDrop(snapped));

			// Detect boundary event attachment target for intermediate event types
			if (isIntermediateEventType(mode.elementType) && hit.type === "shape") {
				const shape = this._shapes.find((s) => s.id === hit.id);
				if (shape?.flowElement && isActivityType(shape.flowElement.type)) {
					this._setBoundaryHost(hit.id);
				} else {
					this._setBoundaryHost(null);
				}
			} else {
				this._setBoundaryHost(null);
			}
		}
	};

	private readonly _onPointerUp = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onPointerUp(e, diag, hit);
	};

	private readonly _onDblClick = (e: MouseEvent): void => {
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onDblClick(e, diag, hit);
	};

	private readonly _onKeyDown = (e: KeyboardEvent): void => {
		// Don't intercept keys typed into form controls or editable elements
		const _kbTarget = e.target as HTMLElement;
		if (
			_kbTarget.tagName === "INPUT" ||
			_kbTarget.tagName === "TEXTAREA" ||
			_kbTarget.isContentEditable
		)
			return;
		if (this._readOnly) return;
		this._stateMachine.onKeyDown(e);

		if (e.ctrlKey || e.metaKey) {
			switch (e.key) {
				case "z":
					if (e.shiftKey) {
						e.preventDefault();
						this.redo();
					} else {
						e.preventDefault();
						this.undo();
					}
					break;
				case "y":
					e.preventDefault();
					this.redo();
					break;
				case "a":
					e.preventDefault();
					this._setSelection(this._shapes.map((s) => s.id));
					break;
				case "c":
					e.preventDefault();
					this._doCopy();
					break;
				case "v":
					e.preventDefault();
					this._doPaste();
					break;
			}
		}
	};

	// ── Hit testing ───────────────────────────────────────────────────

	private _hitTest(clientX: number, clientY: number): HitResult {
		const el = document.elementFromPoint(clientX, clientY);
		if (!el) return { type: "canvas" };

		const handleEl = el.closest("[data-bpmn-handle]");
		if (handleEl) {
			const shapeId = handleEl.getAttribute("data-bpmn-id");
			const handle = handleEl.getAttribute("data-bpmn-handle") as HandleDir | null;
			if (shapeId && handle) return { type: "handle", shapeId, handle };
		}

		const portEl = el.closest("[data-bpmn-port]");
		if (portEl) {
			const shapeId = portEl.getAttribute("data-bpmn-id");
			const port = portEl.getAttribute("data-bpmn-port") as PortDir | null;
			if (shapeId && port) return { type: "port", shapeId, port };
		}

		const endpointEl = el.closest("[data-bpmn-endpoint]");
		if (endpointEl) {
			const edgeId = endpointEl.getAttribute("data-bpmn-id");
			const ep = endpointEl.getAttribute("data-bpmn-endpoint");
			if (edgeId && ep) return { type: "edge-endpoint", edgeId, isStart: ep === "start" };
		}

		const waypointEl = el.closest("[data-bpmn-waypoint]");
		if (waypointEl) {
			const id = waypointEl.getAttribute("data-bpmn-id");
			const wpIdxStr = waypointEl.getAttribute("data-bpmn-waypoint-idx");
			if (id && wpIdxStr !== null) {
				const wpIdx = Number(wpIdxStr);
				const rect = this._svg.getBoundingClientRect();
				const pt = screenToDiagram(clientX, clientY, this._viewport.state, rect);
				return { type: "edge-waypoint", id, wpIdx, pt };
			}
		}

		const edgeHitEl = el.closest("[data-bpmn-edge-hit]");
		if (edgeHitEl) {
			const id = edgeHitEl.getAttribute("data-bpmn-edge-hit");
			if (id) {
				const rect = this._svg.getBoundingClientRect();
				const diag = screenToDiagram(clientX, clientY, this._viewport.state, rect);
				const seg = this._nearestSegment(id, diag);
				if (seg) return { type: "edge-segment", id, ...seg };
				return { type: "edge", id };
			}
		}

		const shapeEl = el.closest("[data-bpmn-id]");
		if (shapeEl && this._shapesG.contains(shapeEl)) {
			const id = shapeEl.getAttribute("data-bpmn-id");
			if (id) return { type: "shape", id };
		}

		return { type: "canvas" };
	}

	/** Returns the nearest segment info for the given edge and diagram point. */
	private _nearestSegment(
		edgeId: string,
		diag: DiagPoint,
	): { segIdx: number; isHoriz: boolean; projPt: DiagPoint } | null {
		const edge = this._edges.find((e) => e.id === edgeId);
		if (!edge) return null;
		const wps = edge.edge.waypoints;
		if (wps.length < 2) return null;

		let bestIdx = 0;
		let bestDist = Number.POSITIVE_INFINITY;
		let bestProj: DiagPoint = { x: 0, y: 0 };
		let bestHoriz = true;

		for (let i = 0; i < wps.length - 1; i++) {
			const a = wps[i];
			const b = wps[i + 1];
			if (!a || !b) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const lenSq = dx * dx + dy * dy;
			let proj: DiagPoint;
			if (lenSq < 0.001) {
				proj = { x: a.x, y: a.y };
			} else {
				const t = Math.max(0, Math.min(1, ((diag.x - a.x) * dx + (diag.y - a.y) * dy) / lenSq));
				proj = { x: a.x + t * dx, y: a.y + t * dy };
			}
			const dist = Math.hypot(diag.x - proj.x, diag.y - proj.y);
			if (dist < bestDist) {
				bestDist = dist;
				bestIdx = i;
				bestProj = proj;
				bestHoriz = Math.abs(dy) <= Math.abs(dx);
			}
		}

		return { segIdx: bestIdx, isHoriz: bestHoriz, projPt: bestProj };
	}

	/** Snaps a diagram point to nearby shape/waypoint positions and returns guide lines. */
	private _snapWaypoint(pt: DiagPoint): {
		pt: DiagPoint;
		guides: Array<{ x1: number; y1: number; x2: number; y2: number }>;
	} {
		const scale = this._viewport.state.scale;
		const threshold = 8 / scale;
		const EXT = 10000;

		const xTargets: number[] = [];
		const yTargets: number[] = [];

		for (const shape of this._shapes) {
			const b = shape.shape.bounds;
			xTargets.push(b.x, b.x + b.width / 2, b.x + b.width);
			yTargets.push(b.y, b.y + b.height / 2, b.y + b.height);
		}
		for (const edge of this._edges) {
			for (const wp of edge.edge.waypoints) {
				xTargets.push(wp.x);
				yTargets.push(wp.y);
			}
		}

		let snapX = pt.x;
		let snapY = pt.y;
		let minDx = threshold;
		let minDy = threshold;

		for (const tx of xTargets) {
			if (Math.abs(pt.x - tx) < minDx) {
				minDx = Math.abs(pt.x - tx);
				snapX = tx;
			}
		}
		for (const ty of yTargets) {
			if (Math.abs(pt.y - ty) < minDy) {
				minDy = Math.abs(pt.y - ty);
				snapY = ty;
			}
		}

		const guides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		if (minDx < threshold) guides.push({ x1: snapX, y1: -EXT, x2: snapX, y2: EXT });
		if (minDy < threshold) guides.push({ x1: -EXT, y1: snapY, x2: EXT, y2: snapY });

		return { pt: { x: snapX, y: snapY }, guides };
	}

	// ── Theme + controls ──────────────────────────────────────────────

	private _applyTheme(theme: Theme): void {
		const resolved =
			theme === "auto"
				? window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light"
				: theme;
		if (resolved === "dark") {
			this._host.setAttribute("data-theme", "dark");
		} else {
			this._host.removeAttribute("data-theme");
		}
	}

	private _installPlugin(plugin: CanvasPlugin): void {
		this._plugins.push(plugin);
		const self = this;
		const api: CanvasApi = {
			container: this._host,
			svg: this._svg,
			viewportEl: this._viewportG,
			getViewport: () => this._viewport.state,
			setViewport: (s) => this._viewport.set(s),
			getShapes: () => [...this._shapes],
			getEdges: () => [...this._edges],
			getTheme: () => this._theme,
			setTheme: (theme) => this.setTheme(theme),
			on<K extends keyof CanvasEvents>(event: K, handler: CanvasEvents[K]) {
				return self.on(event as keyof EditorEvents, handler as EditorEvents[keyof EditorEvents]);
			},
			emit<K extends keyof CanvasEvents>(event: K, ...args: Parameters<CanvasEvents[K]>) {
				self._emit(
					event as keyof EditorEvents,
					...(args as Parameters<EditorEvents[keyof EditorEvents]>),
				);
			},
		};
		plugin.install(api);
	}

	private _emit<K extends keyof EditorEvents>(
		event: K,
		...args: Parameters<EditorEvents[K]>
	): void {
		const handlers = this._listeners.get(event);
		if (!handlers) return;
		for (const h of handlers) {
			(h as (...a: typeof args) => void)(...args);
		}
	}
}

import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { injectTokenHighlightStyles } from "./css";

// ── Structural type — no hard dep on @bpmn-sdk/engine ─────────────────────────

/**
 * Minimal interface satisfied by `ProcessInstance` from `@bpmn-sdk/engine`.
 * Using structural typing keeps this plugin free of an engine dependency.
 */
export interface InstanceLike {
	onChange(callback: (event: Record<string, unknown>) => void): () => void;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface TokenHighlightApi {
	/**
	 * Subscribe to a `ProcessInstance` and automatically update highlights as
	 * the engine emits events. Returns an unsubscribe function.
	 *
	 * @example
	 * ```typescript
	 * const highlight = createTokenHighlightPlugin();
	 * const canvas = new BpmnCanvas({ container, plugins: [highlight] });
	 * canvas.load(xml);
	 *
	 * const instance = engine.start("Process_1", { amount: 100 });
	 * const stop = highlight.api.trackInstance(instance);
	 * // later: stop() to detach
	 * ```
	 */
	trackInstance(instance: InstanceLike): () => void;

	/**
	 * Manually set the full list of element IDs that currently hold a token.
	 * Replaces any previously active set.
	 */
	setActive(elementIds: string[]): void;

	/**
	 * Mark additional element IDs as visited (token has passed through).
	 * Additive — does not clear previously visited elements.
	 */
	addVisited(elementIds: string[]): void;

	/** Mark an element as failed (e.g. exclusive gateway with no matching condition). Shown in red. */
	setError(elementId: string): void;

	/** Remove all token highlights from the canvas. */
	clear(): void;
}

// ── Plugin factory ─────────────────────────────────────────────────────────────

export function createTokenHighlightPlugin(): CanvasPlugin & { api: TokenHighlightApi } {
	let canvasApi: CanvasApi | null = null;

	/** Element IDs that currently hold a live token. */
	const activeIds = new Set<string>();
	/** Element IDs that a token has already passed through. */
	const visitedIds = new Set<string>();
	/** Element IDs that have failed (e.g. unmatched gateway condition). */
	const errorIds = new Set<string>();
	/** flowId → { sourceRef, targetRef } — populated from diagram:load/change. */
	const flowIndex = new Map<string, { sourceRef: string; targetRef: string }>();

	const unsubs: Array<() => void> = [];

	// ── Helpers ──────────────────────────────────────────────────────────────

	function shapeEl(id: string): SVGGElement | undefined {
		return canvasApi?.getShapes().find((s) => s.id === id)?.element;
	}

	function edgeEl(id: string): SVGGElement | undefined {
		return canvasApi?.getEdges().find((e) => e.id === id)?.element;
	}

	function applyHighlights(): void {
		const api = canvasApi;
		if (api === null) return;

		// Strip all plugin classes
		for (const s of api.getShapes()) {
			s.element.classList.remove("bpmn-token-active", "bpmn-token-visited", "bpmn-token-error");
		}
		for (const e of api.getEdges()) {
			e.element.classList.remove("bpmn-token-edge-active", "bpmn-token-edge-visited");
		}

		// Visited shapes
		for (const id of visitedIds) {
			shapeEl(id)?.classList.add("bpmn-token-visited");
		}

		// Active shapes (added after visited so they override on the same element)
		for (const id of activeIds) {
			const el = shapeEl(id);
			if (el !== undefined) {
				el.classList.remove("bpmn-token-visited");
				el.classList.add("bpmn-token-active");
			}
		}

		// Error shapes (highest priority — override active/visited)
		for (const id of errorIds) {
			const el = shapeEl(id);
			if (el !== undefined) {
				el.classList.remove("bpmn-token-active", "bpmn-token-visited");
				el.classList.add("bpmn-token-error");
			}
		}

		// Edge highlights
		// • active edge  : source visited, target active  (token just left source, entering target)
		// • visited edge : source visited, target visited (token has fully traversed this edge)
		// This correctly handles exclusive gateways: only the taken branch's target enters
		// visited/active, so only the taken edge is highlighted.
		for (const [flowId, { sourceRef, targetRef }] of flowIndex) {
			const el = edgeEl(flowId);
			if (el === undefined) continue;
			const srcVisited = visitedIds.has(sourceRef);
			if (!srcVisited) continue;
			if (activeIds.has(targetRef)) {
				el.classList.add("bpmn-token-edge-active");
			} else if (visitedIds.has(targetRef)) {
				el.classList.add("bpmn-token-edge-visited");
			}
		}
	}

	function indexFlows(defs: BpmnDefinitions): void {
		flowIndex.clear();
		for (const proc of defs.processes) {
			for (const flow of proc.sequenceFlows) {
				flowIndex.set(flow.id, { sourceRef: flow.sourceRef, targetRef: flow.targetRef });
			}
			// Sub-processes
			for (const el of proc.flowElements) {
				if (
					el.type === "subProcess" ||
					el.type === "transaction" ||
					el.type === "adHocSubProcess" ||
					el.type === "eventSubProcess"
				) {
					for (const flow of el.sequenceFlows) {
						flowIndex.set(flow.id, { sourceRef: flow.sourceRef, targetRef: flow.targetRef });
					}
				}
			}
		}
	}

	// ── TokenHighlightApi ─────────────────────────────────────────────────────

	const api: TokenHighlightApi = {
		trackInstance(instance) {
			return instance.onChange((evt) => {
				const type = evt.type;
				const elementId = evt.elementId;
				if (typeof type !== "string") return;

				if (type === "element:entering" && typeof elementId === "string") {
					activeIds.add(elementId);
					applyHighlights();
				} else if (type === "element:left" && typeof elementId === "string") {
					activeIds.delete(elementId);
					visitedIds.add(elementId);
					applyHighlights();
				} else if (type === "process:completed" || type === "process:failed") {
					activeIds.clear();
					applyHighlights();
				}
			});
		},

		setActive(elementIds) {
			activeIds.clear();
			for (const id of elementIds) activeIds.add(id);
			applyHighlights();
		},

		addVisited(elementIds) {
			for (const id of elementIds) visitedIds.add(id);
			applyHighlights();
		},

		setError(elementId) {
			errorIds.add(elementId);
			applyHighlights();
		},

		clear() {
			activeIds.clear();
			visitedIds.clear();
			errorIds.clear();
			applyHighlights();
		},
	};

	// ── CanvasPlugin ──────────────────────────────────────────────────────────

	return {
		name: "token-highlight",
		api,

		install(canvasApiArg: CanvasApi) {
			canvasApi = canvasApiArg;
			injectTokenHighlightStyles();

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void;
			const onAny = canvasApiArg.on as unknown as AnyOn;

			unsubs.push(
				canvasApiArg.on("diagram:load", (defs: BpmnDefinitions) => {
					indexFlows(defs);
					api.clear();
				}),
				canvasApiArg.on("diagram:clear", () => {
					flowIndex.clear();
					api.clear();
				}),
				onAny("diagram:change", (defs: unknown) => {
					indexFlows(defs as BpmnDefinitions);
				}),
			);
		},

		uninstall() {
			for (const off of unsubs) off();
			canvasApi = null;
		},
	};
}

/**
 * @bpmnkit/canvas-plugin-diff — visual BPMN diff for `@bpmnkit/canvas`.
 *
 * Renders two versions of a diagram side by side as two canvases, marks every
 * element that was added, removed, changed or moved, and keeps both viewports in
 * sync so panning one pans the other.
 *
 * One factory produces the pair, because a diff needs both models before it can
 * say anything: each plugin publishes the model its canvas loaded, and the diff
 * is computed and painted once both sides have arrived — in whichever order
 * they do.
 *
 * ## Usage
 * ```typescript
 * import { BpmnCanvas } from "@bpmnkit/canvas";
 * import { createBpmnDiff } from "@bpmnkit/plugins/diff";
 *
 * const diff = createBpmnDiff();
 *
 * new BpmnCanvas({ container: leftEl,  xml: oldXml, plugins: [diff.before] });
 * new BpmnCanvas({ container: rightEl, xml: newXml, plugins: [diff.after] });
 *
 * diff.api.getResult(); // { added, removed, changed, moved, total, planes }
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasApi, CanvasPlugin, ViewportState } from "@bpmnkit/canvas"
import type { BpmnDefinitions, BpmnDiffCategory, BpmnDiffResult } from "@bpmnkit/core"
import { diffDiagram } from "@bpmnkit/core"
import { injectDiffStyles } from "./css.js"

export { diffDiagram } from "@bpmnkit/core"
export type { BpmnDiffCategory, BpmnDiffPlaneSummary, BpmnDiffResult } from "@bpmnkit/core"
export { DIFF_CSS, DIFF_STYLE_ID, injectDiffStyles } from "./css.js"

/** Which version of the diagram a canvas holds. */
export type BpmnDiffSide = "before" | "after"

export interface BpmnDiffOptions {
	/** Show the colour legend in the top-right corner. Default `true`. */
	legend?: boolean
	/** Mirror pan and zoom between the two canvases. Default `true`. */
	syncViewports?: boolean
	/** Called whenever the diff is recomputed, i.e. when either side loads. */
	onDiff?: (result: BpmnDiffResult) => void
}

export interface BpmnDiffApi {
	/** The current diff, or `null` until both sides have loaded a diagram. */
	getResult(): BpmnDiffResult | null
	/** Drops the diff and removes every marker, leaving two plain canvases. */
	clear(): void
}

export interface BpmnDiffPair {
	/** Install on the canvas showing the earlier version. */
	readonly before: CanvasPlugin
	/** Install on the canvas showing the later version. */
	readonly after: CanvasPlugin
	readonly api: BpmnDiffApi
}

const CATEGORIES: readonly BpmnDiffCategory[] = ["added", "removed", "changed", "moved"]

/** The classes this plugin owns, stripped wholesale before every repaint. */
const MARKER_CLASSES = CATEGORIES.map((category) => `bpmnkit-diff-${category}`)

/** Which categories each side can show — a removed element only exists in `before`. */
const CATEGORIES_BY_SIDE: Record<BpmnDiffSide, readonly BpmnDiffCategory[]> = {
	before: ["removed", "changed", "moved"],
	after: ["added", "changed", "moved"],
}

const LEGEND_LABELS: Record<BpmnDiffCategory, string> = {
	added: "added",
	removed: "removed",
	changed: "changed",
	moved: "moved",
}

interface Side {
	kind: BpmnDiffSide
	api: CanvasApi | null
	definitions: BpmnDefinitions | null
	legendEl: HTMLDivElement | null
	/** The plane this canvas is currently showing, as a DI `bpmnElement`. */
	plane: string | null
	unsubs: Array<() => void>
}

/**
 * Creates a pair of canvas plugins that render a visual diff of two diagrams.
 *
 * Each call returns a fresh pair — use one pair per diff view.
 *
 * @param options - Legend, viewport sync, and a change callback.
 *
 * @example
 * ```typescript
 * const diff = createBpmnDiff({
 *   onDiff: (result) => console.log(`${result.total} differences`),
 * });
 * new BpmnCanvas({ container: leftEl,  xml: oldXml, plugins: [diff.before] });
 * new BpmnCanvas({ container: rightEl, xml: newXml, plugins: [diff.after] });
 * ```
 */
export function createBpmnDiff(options: BpmnDiffOptions = {}): BpmnDiffPair {
	const showLegend = options.legend ?? true
	const syncViewports = options.syncViewports ?? true

	const sides: Record<BpmnDiffSide, Side> = {
		before: {
			kind: "before",
			api: null,
			definitions: null,
			legendEl: null,
			plane: null,
			unsubs: [],
		},
		after: { kind: "after", api: null, definitions: null, legendEl: null, plane: null, unsubs: [] },
	}

	let result: BpmnDiffResult | null = null

	// ── Painting ─────────────────────────────────────────────────────────────

	function stripMarkers(side: Side): void {
		const viewport = side.api?.viewportEl
		if (viewport === undefined) return
		for (const el of viewport.querySelectorAll(MARKER_CLASSES.map((c) => `.${c}`).join(","))) {
			el.classList.remove(...MARKER_CLASSES)
		}
	}

	/**
	 * Marks the elements this side can show. Rendered elements are looked up
	 * through the canvas rather than by an attribute selector built from the
	 * element id — ids come from a parsed file and are not ours to trust.
	 */
	function paint(side: Side): void {
		const api = side.api
		if (api === null) return
		stripMarkers(side)
		if (result === null) return

		const elements = new Map<string, SVGGElement>()
		for (const shape of api.getShapes()) elements.set(shape.id, shape.element)
		for (const edge of api.getEdges()) elements.set(edge.id, edge.element)

		for (const category of CATEGORIES_BY_SIDE[side.kind]) {
			for (const id of result[category]) {
				elements.get(id)?.classList.add(`bpmnkit-diff-${category}`)
			}
		}
	}

	// ── Legend ───────────────────────────────────────────────────────────────

	function renderLegend(side: Side): void {
		const el = side.legendEl
		if (el === null) return
		el.textContent = ""
		el.hidden = result === null
		if (result === null) return

		if (result.total === 0) {
			const title = document.createElement("div")
			title.className = "bpmnkit-diff-legend-title"
			title.textContent = "No changes"
			el.appendChild(title)
			return
		}

		for (const category of CATEGORIES) {
			const count = result[category].length
			if (count === 0) continue
			const row = document.createElement("div")
			row.className = "bpmnkit-diff-legend-row"
			const swatch = document.createElement("span")
			swatch.className = "bpmnkit-diff-legend-swatch"
			swatch.dataset.category = category
			const label = document.createElement("span")
			label.textContent = `${count} ${LEGEND_LABELS[category]}`
			row.append(swatch, label)
			el.appendChild(row)
		}

		// A canvas draws one plane at a time, so a change inside a collapsed
		// sub-process is invisible until the reader drills in. Say it is there.
		const elsewhere = offPlaneCount(side)
		if (elsewhere > 0) {
			const note = document.createElement("div")
			note.className = "bpmnkit-diff-legend-note"
			note.textContent = `${elsewhere} on other planes`
			el.appendChild(note)
		}
	}

	/** Differences that fall on a plane this canvas is not currently showing. */
	function offPlaneCount(side: Side): number {
		if (result === null || side.plane === null) return 0
		return result.planes
			.filter((plane) => plane.id !== side.plane)
			.reduce((sum, plane) => sum + plane.total, 0)
	}

	// ── Diff lifecycle ───────────────────────────────────────────────────────

	function recompute(): void {
		const before = sides.before.definitions
		const after = sides.after.definitions
		result = before !== null && after !== null ? diffDiagram(before, after) : null

		for (const side of [sides.before, sides.after]) {
			paint(side)
			renderLegend(side)
		}

		if (result !== null) {
			alignViewports()
			options.onDiff?.(result)
		}
	}

	/**
	 * Copies the later version's viewport onto the earlier one, so a diff that has
	 * just loaded opens with both panes showing the same region — each canvas fits
	 * itself independently on load.
	 */
	function alignViewports(): void {
		if (!syncViewports) return
		const from = sides.after.api
		const to = sides.before.api
		if (from === null || to === null) return
		push(sides.before, from.getViewport())
	}

	function sameViewport(a: ViewportState, b: ViewportState): boolean {
		return a.tx === b.tx && a.ty === b.ty && a.scale === b.scale
	}

	/**
	 * Sets a side's viewport, unless it already holds it.
	 *
	 * That condition is what keeps the two canvases from echoing each other. A
	 * canvas applies a viewport on the next animation frame and fires
	 * `viewport:change` only then, so a re-entrancy flag around `setViewport`
	 * would be long cleared by the time the echo arrives and would guard nothing.
	 * Skipping a write that changes nothing ends every exchange after one hop —
	 * and keeps a no-op push from scheduling a frame whose event would carry
	 * whatever the user did in the meantime back the other way, undoing it.
	 */
	function push(side: Side, state: ViewportState): void {
		const api = side.api
		if (api === null) return
		if (sameViewport(api.getViewport(), state)) return
		api.setViewport(state)
	}

	/** Mirrors a viewport change the user made on one canvas onto the other. */
	function mirrorViewport(from: Side, state: ViewportState): void {
		if (!syncViewports) return
		push(from.kind === "before" ? sides.after : sides.before, state)
	}

	// ── Plugin construction ──────────────────────────────────────────────────

	function createSidePlugin(side: Side): CanvasPlugin {
		return {
			name: `bpmn-diff-${side.kind}`,

			install(api: CanvasApi) {
				side.api = api
				injectDiffStyles()

				if (showLegend) {
					const legend = document.createElement("div")
					legend.className = "bpmnkit-diff-legend"
					legend.hidden = true
					api.container.appendChild(legend)
					side.legendEl = legend
				}

				side.unsubs.push(
					api.on("diagram:load", (defs: BpmnDefinitions) => {
						side.definitions = defs
						side.plane = defs.diagrams[0]?.plane.bpmnElement ?? null
						recompute()
					}),
					api.on("diagram:clear", () => {
						side.definitions = null
						side.plane = null
						recompute()
					}),
					// The canvas re-renders when drilling into a sub-process, which drops
					// the markers along with the old DOM.
					api.on("plane:change", (_from: string, to: string) => {
						side.plane = to
						paint(side)
						renderLegend(side)
					}),
					api.on("viewport:change", (state: ViewportState) => {
						mirrorViewport(side, state)
					}),
				)
			},

			uninstall() {
				for (const off of side.unsubs) off()
				side.unsubs.length = 0
				stripMarkers(side)
				side.legendEl?.remove()
				side.legendEl = null
				side.api = null
				side.definitions = null
				side.plane = null
				// One pane gone means there is no diff left to show on the other.
				recompute()
			},
		}
	}

	const api: BpmnDiffApi = {
		getResult() {
			return result
		},
		clear() {
			result = null
			for (const side of [sides.before, sides.after]) {
				stripMarkers(side)
				renderLegend(side)
			}
		},
	}

	return { before: createSidePlugin(sides.before), after: createSidePlugin(sides.after), api }
}

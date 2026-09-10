/**
 * @bpmnkit/canvas-plugin-lint — static analysis on the canvas.
 *
 * `casen lint` has had five categories of rules for a while; none of them were
 * visible while modelling. This puts them on the diagram: a marker on every
 * offending element, a control that counts them and steps through them, and a
 * report a host can forward to its own problem list.
 *
 * The rules come from `lintDiagram` in `@bpmnkit/core`, so a model that names
 * no execution platform is not judged against Camunda 8 deployability, and the
 * report is plain data that survives a `postMessage`.
 *
 * ## Usage
 * ```typescript
 * import { BpmnCanvas } from "@bpmnkit/canvas";
 * import { createLintPlugin } from "@bpmnkit/plugins/lint";
 *
 * const lint = createLintPlugin({
 *   onReport: (report) => console.log(`${report.total} findings`),
 * });
 * const canvas = new BpmnCanvas({ container, xml, plugins: [lint] });
 *
 * lint.api.next(); // step to the next offending element
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { lintDiagram } from "@bpmnkit/core"
import type { BpmnDefinitions, LintOptions, LintReport } from "@bpmnkit/core"
import { injectLintStyles } from "./css.js"

export { LINT_CSS, LINT_STYLE_ID, injectLintStyles } from "./css.js"

type Severity = "error" | "warning" | "info"

/** Worst first — the order markers and the control both use. */
const SEVERITIES: readonly Severity[] = ["error", "warning", "info"]

const MARKER_CLASSES = SEVERITIES.map((s) => `bpmnkit-lint-${s}`)
const FOCUS_CLASS = "bpmnkit-lint-focus"

const SEVERITY_SYMBOL: Record<Severity, string> = { error: "✖", warning: "⚠", info: "ℹ" }

/** How long the stepped-to element keeps its pulse. Matches the CSS animation. */
const FOCUS_MS = 1300

export interface LintPluginOptions extends LintOptions {
	/** Show the counting control in the top-left corner. Default `true`. */
	control?: boolean
	/**
	 * How long to wait after an edit before re-linting, in milliseconds.
	 * Default 300 — long enough that typing a name does not re-run the analysis
	 * on every keystroke.
	 */
	debounceMs?: number
	/**
	 * Called after every run, with plain data. This is the seam a host uses to
	 * put findings somewhere the canvas cannot reach — an editor's problem list,
	 * a CI annotation, a panel of its own.
	 */
	onReport?: (report: LintReport) => void
}

export interface LintApi {
	/** The most recent report, or `null` before a diagram has loaded. */
	getReport(): LintReport | null
	/**
	 * Centres the next offending element on the current plane and pulses it.
	 * Wraps around; returns the element id, or `null` when there is nothing to
	 * step to.
	 */
	next(): string | null
	/** Turns markers and the control off, or back on. */
	setEnabled(enabled: boolean): void
}

/**
 * Creates the lint plugin.
 *
 * @param options - Lint options, plus the control, debounce and report hook.
 */
export function createLintPlugin(options: LintPluginOptions = {}): CanvasPlugin & { api: LintApi } {
	const { control: showControl = true, debounceMs = 300, onReport, ...lintOptions } = options

	let canvasApi: CanvasApi | null = null
	let definitions: BpmnDefinitions | null = null
	let report: LintReport | null = null
	let controlEl: HTMLButtonElement | null = null
	let plane: string | null = null
	let enabled = true
	let cursor = -1
	let debounceTimer: ReturnType<typeof setTimeout> | null = null
	let focusTimer: ReturnType<typeof setTimeout> | null = null
	const unsubs: Array<() => void> = []

	// ── Markers ──────────────────────────────────────────────────────────────

	function stripMarkers(): void {
		const viewport = canvasApi?.viewportEl
		if (viewport === undefined) return
		for (const el of viewport.querySelectorAll(
			[...MARKER_CLASSES, FOCUS_CLASS].map((c) => `.${c}`).join(","),
		)) {
			el.classList.remove(...MARKER_CLASSES, FOCUS_CLASS)
		}
	}

	/** Rendered elements by id — looked up through the canvas, never by selector. */
	function renderedElements(): Map<string, SVGGElement> {
		const api = canvasApi
		const elements = new Map<string, SVGGElement>()
		if (api === null) return elements
		for (const shape of api.getShapes()) elements.set(shape.id, shape.element)
		for (const edge of api.getEdges()) elements.set(edge.id, edge.element)
		return elements
	}

	function paint(): void {
		stripMarkers()
		if (!enabled || report === null) return

		const elements = renderedElements()

		// One marker per element, worst severity winning: a task with an error and
		// three warnings is an error, and drawing both would say neither.
		const worst = new Map<string, Severity>()
		for (const diagnostic of report.diagnostics) {
			for (const id of diagnostic.elementIds) {
				const current = worst.get(id)
				if (current === undefined || rank(diagnostic.severity) < rank(current)) {
					worst.set(id, diagnostic.severity)
				}
			}
		}

		for (const [id, severity] of worst) {
			elements.get(id)?.classList.add(`bpmnkit-lint-${severity}`)
		}
	}

	function rank(severity: Severity): number {
		return SEVERITIES.indexOf(severity)
	}

	// ── Control ──────────────────────────────────────────────────────────────

	function renderControl(): void {
		const el = controlEl
		if (el === null) return
		el.textContent = ""
		el.hidden = !enabled || report === null
		if (!enabled || report === null) return

		if (report.total === 0) {
			const clean = document.createElement("span")
			clean.className = "bpmnkit-lint-clean"
			clean.textContent = "No findings"
			el.appendChild(clean)
		} else {
			for (const severity of SEVERITIES) {
				const count = report.counts[severity]
				if (count === 0) continue
				const chip = document.createElement("span")
				chip.className = "bpmnkit-lint-count"
				chip.dataset.severity = severity
				chip.textContent = `${SEVERITY_SYMBOL[severity]} ${count}`
				el.appendChild(chip)
			}

			// A canvas draws one plane at a time; say when findings sit elsewhere.
			const elsewhere = offPlaneCount()
			if (elsewhere > 0) {
				const note = document.createElement("span")
				note.className = "bpmnkit-lint-note"
				note.textContent = `${elsewhere} on other planes`
				el.appendChild(note)
			}
		}

		// Which rules ran is not a detail when a neutral model is deliberately
		// spared the deployability rules — otherwise their absence looks like a bug.
		if (report.platform.id === "none") {
			const platform = document.createElement("span")
			platform.className = "bpmnkit-lint-platform"
			platform.textContent = "no engine — structural rules only"
			el.appendChild(platform)
		}

		el.title =
			report.total === 0
				? "No findings"
				: `${report.total} finding${report.total === 1 ? "" : "s"} — click to step through them`
	}

	function offPlaneCount(): number {
		if (report === null || plane === null) return 0
		return report.diagnostics.filter((d) => d.plane !== undefined && d.plane !== plane).length
	}

	// ── Stepping ─────────────────────────────────────────────────────────────

	/** Offending elements on the visible plane, worst first, each listed once. */
	function steppableIds(): string[] {
		if (report === null) return []
		const rendered = renderedElements()
		const seen = new Set<string>()
		const ids: string[] = []
		for (const severity of SEVERITIES) {
			for (const diagnostic of report.diagnostics) {
				if (diagnostic.severity !== severity) continue
				for (const id of diagnostic.elementIds) {
					if (seen.has(id) || !rendered.has(id)) continue
					seen.add(id)
					ids.push(id)
				}
			}
		}
		return ids
	}

	function step(): string | null {
		const api = canvasApi
		const ids = steppableIds()
		if (api === null || ids.length === 0) return null

		cursor = (cursor + 1) % ids.length
		const id = ids[cursor]
		if (id === undefined) return null

		api.scrollToElement(id)

		const element = renderedElements().get(id)
		if (element !== undefined) {
			if (focusTimer !== null) clearTimeout(focusTimer)
			for (const el of api.viewportEl.querySelectorAll(`.${FOCUS_CLASS}`)) {
				el.classList.remove(FOCUS_CLASS)
			}
			element.classList.add(FOCUS_CLASS)
			focusTimer = setTimeout(() => {
				element.classList.remove(FOCUS_CLASS)
				focusTimer = null
			}, FOCUS_MS)
		}
		return id
	}

	// ── Running ──────────────────────────────────────────────────────────────

	function run(): void {
		if (definitions === null) {
			report = null
		} else {
			report = lintDiagram(definitions, lintOptions)
			cursor = -1
		}
		paint()
		renderControl()
		if (report !== null) onReport?.(report)
	}

	/**
	 * Re-lints after an edit, once the edits stop.
	 *
	 * The analysis walks the whole model, and `diagram:change` fires per
	 * keystroke while a name is being typed; without this the editor would run
	 * it dozens of times to show the same result.
	 */
	function scheduleRun(): void {
		if (debounceTimer !== null) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => {
			debounceTimer = null
			run()
		}, debounceMs)
	}

	// ── Plugin ───────────────────────────────────────────────────────────────

	const api: LintApi = {
		getReport() {
			return report
		},
		next() {
			return enabled ? step() : null
		},
		setEnabled(value: boolean) {
			enabled = value
			paint()
			renderControl()
		},
	}

	return {
		name: "lint",
		api,

		install(canvas: CanvasApi) {
			canvasApi = canvas
			injectLintStyles()

			if (showControl) {
				const button = document.createElement("button")
				button.type = "button"
				button.className = "bpmnkit-lint-summary"
				button.hidden = true
				button.setAttribute("aria-label", "Lint findings — step to the next one")
				button.addEventListener("click", () => {
					step()
				})
				canvas.container.appendChild(button)
				controlEl = button
			}

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void
			const onAny = canvas.on as unknown as AnyOn

			unsubs.push(
				canvas.on("diagram:load", (defs: BpmnDefinitions) => {
					definitions = defs
					plane = defs.diagrams[0]?.plane.bpmnElement ?? null
					run()
				}),
				canvas.on("diagram:clear", () => {
					definitions = null
					plane = null
					run()
				}),
				// Re-render markers with the new DOM after a drill-in, and recount
				// what is now off-plane.
				canvas.on("plane:change", (_from: string, to: string) => {
					plane = to
					cursor = -1
					paint()
					renderControl()
				}),
				onAny("diagram:change", (defs: unknown) => {
					definitions = defs as BpmnDefinitions
					scheduleRun()
				}),
			)
		},

		uninstall() {
			for (const off of unsubs) off()
			unsubs.length = 0
			if (debounceTimer !== null) clearTimeout(debounceTimer)
			if (focusTimer !== null) clearTimeout(focusTimer)
			debounceTimer = null
			focusTimer = null
			stripMarkers()
			controlEl?.remove()
			controlEl = null
			canvasApi = null
			definitions = null
			report = null
			plane = null
		},
	}
}

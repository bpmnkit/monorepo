import { Bpmn, optimize } from "@bpmnkit/core"

export type Severity = "info" | "warning" | "error"

/** One review item — deterministic or AI-produced. Strings are rendered as text nodes. */
export interface Suggestion {
	title: string
	why: string
	severity: Severity
	/** First referenced BPMN element id, for click/hover-to-highlight on the canvas. */
	elementId?: string
	category?: string
}

/** A full review payload sent to the panel. */
export interface ReviewResult {
	/** AI model name, or null when only the deterministic pass ran. */
	model: string | null
	/** AI executive summary, or null. */
	summary: string | null
	/** AI narrative suggestions (empty until the LLM pass runs). */
	suggestions: Suggestion[]
	/** Deterministic findings from `@bpmnkit/core`'s optimizer. */
	deterministic: Suggestion[]
	/** True when the AI portion was served from cache. */
	cached: boolean
	/** Optional status note shown in the panel (e.g. budget exhausted). */
	note?: string
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

/**
 * Run the deterministic analysis (`optimize` = pattern advisor + variable flow +
 * FEEL + naming + flow checks) and map its findings to {@link Suggestion}s,
 * most-severe first. Throws if the XML does not parse.
 */
export function deterministicSuggestions(bpmnXml: string, limit = 24): Suggestion[] {
	const report = optimize(Bpmn.parse(bpmnXml))
	return report.findings
		.map((f): Suggestion => {
			const s: Suggestion = {
				title: f.message,
				why: f.suggestion,
				severity: f.severity,
				category: f.category,
			}
			if (f.elementIds[0]) s.elementId = f.elementIds[0]
			return s
		})
		.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
		.slice(0, limit)
}

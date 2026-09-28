/**
 * Turning a {@link LintReport} into things the Problems panel can show.
 *
 * Kept free of `vscode` on purpose: the interesting decisions here — which
 * element a finding points at, what to do when it points at nothing, how a
 * suggestion is presented — are testable only if nothing in this file needs an
 * extension host to exist. `lint-provider.ts` does the `vscode` half.
 *
 * @packageDocumentation
 */

import type { LintDiagnostic, LintReport, UnsupportedBpmnlintRule } from "@bpmnkit/core"
import type { BpmnlintReport } from "@bpmnkit/core/node"
import { type SourceSpan, indexElementIds } from "./locate.js"

/** The whole file rather than a place in it — used when nothing can be located. */
const WHOLE_FILE: SourceSpan = { offset: 0, length: 0 }

/** A finding placed in a source file, with no `vscode` types involved. */
export interface PlacedDiagnostic {
	readonly span: SourceSpan
	readonly severity: LintDiagnostic["severity"]
	readonly message: string
	/** What to do about it. Shown as a child row, not folded into the message. */
	readonly suggestion: string
	/** The rule that fired, e.g. `pattern/user-task-no-timer`. */
	readonly code: string
	/** Who reported it: BPMN Kit's analysis, or the project's own bpmnlint. */
	readonly source: "bpmnkit" | "bpmnlint"
}

/**
 * Places every diagnostic in a report against the source it came from.
 *
 * One row per offending element, not one per finding: a rule that fires on four
 * user tasks is four problems, because the reader navigates to elements. A
 * finding that names no element — or names one this file does not contain —
 * falls back to its process, and then to the file itself.
 *
 * @param xml - The source the report was produced from.
 * @param report - The result of `lintDiagram()`.
 */
export function placeDiagnostics(xml: string, report: LintReport): PlacedDiagnostic[] {
	const index = indexElementIds(xml)
	const placed: PlacedDiagnostic[] = []
	const seen = new Set<string>()

	for (const diagnostic of report.diagnostics) {
		const targets =
			diagnostic.elementIds.length > 0 ? diagnostic.elementIds : [diagnostic.processId]

		for (const elementId of targets) {
			const span = index.get(elementId) ?? index.get(diagnostic.processId) ?? WHOLE_FILE
			// Two element ids can collapse onto the same fallback span; one row is
			// enough, and a duplicated message in the panel reads as a bug.
			const key = `${diagnostic.id}|${span.offset}|${span.length}|${diagnostic.message}`
			if (seen.has(key)) continue
			seen.add(key)

			placed.push({
				span,
				severity: diagnostic.severity,
				// A finding a .bpmnlintrc governs says which of its rules did so.
				message:
					diagnostic.bpmnlintRule === undefined
						? diagnostic.message
						: `${diagnostic.message} (${diagnostic.bpmnlintRule})`,
				suggestion: diagnostic.suggestion,
				code: diagnostic.id,
				source: "bpmnkit",
			})
		}
	}

	return placed
}

/**
 * Places the findings of the project's own bpmnlint, the same way.
 *
 * @param xml - The source bpmnlint linted.
 * @param reports - `BpmnlintSetup.reports`.
 */
export function placeBpmnlintReports(
	xml: string,
	reports: readonly BpmnlintReport[],
): PlacedDiagnostic[] {
	const index = indexElementIds(xml)
	return reports.map((report) => ({
		span: (report.elementId !== undefined ? index.get(report.elementId) : undefined) ?? WHOLE_FILE,
		severity: report.severity,
		message: report.message,
		suggestion: report.documentationUrl ?? `Reported by the bpmnlint rule "${report.rule}".`,
		code: report.rule,
		source: "bpmnlint",
	}))
}

/**
 * The file-level notice for what a `.bpmnlintrc` asked for that BPMN Kit could
 * not do — shown once per file rather than dropped, so a team is not left
 * believing a rule ran.
 *
 * @param configPath - The `.bpmnlintrc` that applied.
 * @param unsupported - `LintReport.bpmnlintUnsupported`.
 * @param failure - Why the project's bpmnlint could not run, if it could not.
 */
export function bpmnlintNotice(
	configPath: string,
	unsupported: readonly UnsupportedBpmnlintRule[],
	failure: string | undefined,
): PlacedDiagnostic | undefined {
	const parts = [
		...(failure !== undefined ? [`the project's bpmnlint could not run (${failure})`] : []),
		...(unsupported.length > 0
			? [`no BPMN Kit equivalent for ${unsupported.map((rule) => rule.name).join(", ")}`]
			: []),
	]
	if (parts.length === 0) return undefined
	return {
		span: WHOLE_FILE,
		severity: "info",
		message: `${configPath}: ${parts.join("; ")}.`,
		suggestion:
			"Install bpmnlint and bpmn-moddle in the project to run plugin rules with bpmnlint itself.",
		code: "bpmnlintrc",
		source: "bpmnkit",
	}
}

/**
 * A one-line summary of what the analysis did, for the status bar.
 *
 * Says which engine's rules ran, because "no problems" means something
 * different on an engine-neutral diagram than on a Camunda 8 one — the
 * deployability rules were never applied.
 */
export function summarise(report: LintReport): string {
	const { error, warning, info } = report.counts
	const counts = [
		error > 0 ? `${error} error${error === 1 ? "" : "s"}` : null,
		warning > 0 ? `${warning} warning${warning === 1 ? "" : "s"}` : null,
		info > 0 ? `${info} info` : null,
	].filter((part): part is string => part !== null)

	const platform = report.platform.name ?? "no execution platform"
	return counts.length === 0 ? `No findings (${platform})` : `${counts.join(", ")} (${platform})`
}

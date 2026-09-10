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

import type { LintDiagnostic, LintReport } from "@bpmnkit/core"
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
				message: diagnostic.message,
				suggestion: diagnostic.suggestion,
				code: diagnostic.id,
			})
		}
	}

	return placed
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

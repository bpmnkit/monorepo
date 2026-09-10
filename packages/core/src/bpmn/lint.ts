import type { BpmnDefinitions } from "./bpmn-model.js"
import { optimize } from "./optimize/index.js"
import type {
	OptimizationCategory,
	OptimizationSeverity,
	OptimizeOptions,
} from "./optimize/types.js"

/**
 * The engine a model says it targets, read from `modeler:executionPlatform`.
 *
 * `none` is a real answer, not a failure: a diagram authored in a
 * vendor-neutral tool names no engine, and judging it against one produces
 * findings its author cannot act on.
 */
export type ExecutionPlatform = "camunda-cloud" | "camunda-platform" | "none"

export interface DetectedPlatform {
	id: ExecutionPlatform
	/** The raw attribute value, when there was one. */
	name?: string
	version?: string
}

/**
 * Categories whose findings only mean something against a Camunda 8 engine.
 *
 * Measured rather than assumed: on a model with no execution platform and no
 * Zeebe extensions, every other category either stays quiet or reports
 * something structural that holds regardless, while `deploy` reports
 * "serviceTask has no zeebe:taskDefinition type" as an **error** — a demand the
 * author never signed up for. `connector` and `agentic` are the same kind of
 * claim about the same engine.
 */
const ENGINE_CATEGORIES: readonly OptimizationCategory[] = ["deploy", "connector", "agentic"]

/** A finding as plain data — no functions, so a host can forward it anywhere. */
export interface LintDiagnostic {
	id: string
	severity: OptimizationSeverity
	category: OptimizationCategory
	message: string
	suggestion: string
	processId: string
	elementIds: string[]
	/**
	 * The diagram plane the elements are drawn on, when they are drawn at all.
	 * A viewer shows one plane at a time, so a host needs this to say where to
	 * look rather than only what is wrong.
	 */
	plane?: string
	/** Whether the live report carries an automatic fix for this finding. */
	fixable: boolean
}

export interface LintReport {
	diagnostics: LintDiagnostic[]
	/** The engine the model claims, and therefore which rules were applied. */
	platform: DetectedPlatform
	/** Categories that were run — engine rules are dropped on a neutral model. */
	categories: OptimizationCategory[]
	counts: Record<OptimizationSeverity, number>
	total: number
}

export interface LintOptions extends OptimizeOptions {
	/**
	 * Run engine rules even when the model names no platform. Off by default:
	 * an engine-neutral diagram should not be told it is undeployable.
	 */
	forceEngineRules?: boolean
}

/**
 * Reads the execution platform a model declares.
 *
 * @param definitions - The model to inspect.
 */
export function detectExecutionPlatform(definitions: BpmnDefinitions): DetectedPlatform {
	const name = definitions.unknownAttributes["modeler:executionPlatform"]
	const version = definitions.unknownAttributes["modeler:executionPlatformVersion"]
	if (name === undefined || name === "") return { id: "none" }

	const normalised = name.toLowerCase()
	const id: ExecutionPlatform = normalised.includes("cloud")
		? "camunda-cloud"
		: normalised.includes("camunda")
			? "camunda-platform"
			: "none"

	return version === undefined ? { id, name } : { id, name, version }
}

/** Maps every element that carries diagram interchange to the plane drawing it. */
function planeIndex(definitions: BpmnDefinitions): Map<string, string> {
	const index = new Map<string, string>()
	for (const diagram of definitions.diagrams) {
		const plane = diagram.plane.bpmnElement
		for (const shape of diagram.plane.shapes) index.set(shape.bpmnElement, plane)
		for (const edge of diagram.plane.edges) index.set(edge.bpmnElement, plane)
	}
	return index
}

/**
 * Runs the static analysis and returns it as plain, forwardable data.
 *
 * Two things this adds over calling {@link optimize} directly, both of them
 * about handing findings to something that is not this process:
 *
 * - **The result is serialisable.** An `OptimizationFinding` carries an
 *   `applyFix` function, so it cannot cross a `postMessage` or a JSON boundary;
 *   a `LintDiagnostic` says `fixable: true` instead and leaves the fix where it
 *   can still be called.
 * - **The rules match the model.** A diagram that names no execution platform
 *   is not judged against Camunda 8 deployability, so an engine-neutral file
 *   does not open covered in errors about extensions it was never going to
 *   have.
 *
 * @param definitions - The model to lint.
 * @param options - Optimizer options, plus `forceEngineRules`.
 *
 * @example
 * ```typescript
 * const report = lintDiagram(Bpmn.parse(xml));
 * for (const d of report.diagnostics) {
 *   console.log(`${d.severity} ${d.elementIds.join(",")}: ${d.message}`);
 * }
 * ```
 */
export function lintDiagram(definitions: BpmnDefinitions, options: LintOptions = {}): LintReport {
	const platform = detectExecutionPlatform(definitions)
	const engineRules = options.forceEngineRules === true || platform.id !== "none"

	const { forceEngineRules: _ignored, ...optimizeOptions } = options
	const report = optimize(definitions, optimizeOptions)

	const requested = optimizeOptions.categories
	const findings = engineRules
		? report.findings
		: report.findings.filter((f) => !ENGINE_CATEGORIES.includes(f.category))

	const planes = planeIndex(definitions)
	const diagnostics: LintDiagnostic[] = findings.map((finding) => {
		const plane = finding.elementIds.map((id) => planes.get(id)).find((p) => p !== undefined)
		const base = {
			id: finding.id,
			severity: finding.severity,
			category: finding.category,
			message: finding.message,
			suggestion: finding.suggestion,
			processId: finding.processId,
			elementIds: finding.elementIds,
			fixable: finding.applyFix !== undefined,
		}
		return plane === undefined ? base : { ...base, plane }
	})

	const counts: Record<OptimizationSeverity, number> = { error: 0, warning: 0, info: 0 }
	for (const diagnostic of diagnostics) counts[diagnostic.severity] += 1

	return {
		diagnostics,
		platform,
		categories: lintCategories(definitions, options),
		counts,
		total: diagnostics.length,
	}
}

/** Every category the optimizer knows, in the order it runs them. */
const ALL_CATEGORIES: readonly OptimizationCategory[] = [
	"feel",
	"feel-syntax",
	"flow",
	"naming",
	"task-reuse",
	"extract",
	"pattern",
	"data-flow",
	"deploy",
	"agentic",
	"connector",
]

/**
 * The categories that should run against a given model.
 *
 * Exported because more than one surface needs the same answer and they must
 * not disagree: the canvas plugin lints through {@link lintDiagram}, while
 * `casen lint` calls `optimize` directly so it can keep the `applyFix` closures
 * that `LintDiagnostic` deliberately drops. Both ask here which rules apply.
 *
 * @param definitions - The model whose execution platform decides.
 * @param options - `categories` to narrow to, and `forceEngineRules` to keep
 *   the engine layer on a model that names no platform.
 */
export function lintCategories(
	definitions: BpmnDefinitions,
	options: Pick<LintOptions, "categories" | "forceEngineRules"> = {},
): OptimizationCategory[] {
	const base = options.categories ?? ALL_CATEGORIES
	const engineRules =
		options.forceEngineRules === true || detectExecutionPlatform(definitions).id !== "none"
	return engineRules ? [...base] : base.filter((c) => !ENGINE_CATEGORIES.includes(c))
}

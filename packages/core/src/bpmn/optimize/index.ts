import type { BpmnDefinitions } from "../bpmn-model.js"
import { analyzeAgentic } from "./agentic.js"
import { analyzeDeploy } from "./deploy.js"
import { analyzeFeelSyntax } from "./feel-syntax.js"
import { analyzeFeel } from "./feel.js"
import { analyzeFlow } from "./flow.js"
import { analyzeNaming } from "./naming.js"
import { analyzePatterns } from "./patterns.js"
import { analyzeTasks } from "./tasks.js"
import type {
	OptimizationCategory,
	OptimizationFinding,
	OptimizationReport,
	OptimizationSeverity,
	OptimizeOptions,
	ResolvedOptions,
} from "./types.js"
import { analyzeVariableFlow } from "./variable-flow.js"

const ALL_CATEGORIES: OptimizationCategory[] = [
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

function resolveOptions(opts?: OptimizeOptions): ResolvedOptions {
	return {
		feelLengthThreshold: opts?.feelLengthThreshold ?? 80,
		feelNestingThreshold: opts?.feelNestingThreshold ?? 3,
		feelOperatorThreshold: opts?.feelOperatorThreshold ?? 5,
		feelVariableThreshold: opts?.feelVariableThreshold ?? 4,
		reuseThreshold: opts?.reuseThreshold ?? 2,
		categories: opts?.categories ?? [...ALL_CATEGORIES],
		resolveConnectorRequirements: opts?.resolveConnectorRequirements,
	}
}

/** Run static analysis on a BPMN definitions object. */
export function optimize(defs: BpmnDefinitions, options?: OptimizeOptions): OptimizationReport {
	const resolved = resolveOptions(options)
	const findings: OptimizationFinding[] = []

	for (const process of defs.processes) {
		if (resolved.categories.includes("feel")) {
			findings.push(...analyzeFeel(process, resolved))
		}
		if (resolved.categories.includes("feel-syntax")) {
			findings.push(...analyzeFeelSyntax(process))
		}
		if (resolved.categories.includes("flow")) {
			findings.push(...analyzeFlow(process, resolved))
		}
		if (resolved.categories.includes("naming")) {
			findings.push(...analyzeNaming(process, resolved))
		}
		if (resolved.categories.includes("task-reuse")) {
			findings.push(...analyzeTasks(process, resolved))
		}
		if (resolved.categories.includes("pattern")) {
			findings.push(...analyzePatterns(process))
		}
		if (resolved.categories.includes("data-flow")) {
			findings.push(...analyzeVariableFlow(process))
		}
		if (resolved.categories.includes("deploy") || resolved.categories.includes("connector")) {
			const deployFindings = analyzeDeploy(process, resolved.resolveConnectorRequirements)
			findings.push(
				...deployFindings.filter(
					(f) =>
						(f.category === "deploy" && resolved.categories.includes("deploy")) ||
						(f.category === "connector" && resolved.categories.includes("connector")),
				),
			)
		}
		if (resolved.categories.includes("agentic")) {
			findings.push(...analyzeAgentic(process))
		}
	}

	const byCategory = Object.fromEntries(
		ALL_CATEGORIES.map((c) => [c, findings.filter((f) => f.category === c).length]),
	) as Record<OptimizationCategory, number>

	const bySeverity = Object.fromEntries(
		(["info", "warning", "error"] as OptimizationSeverity[]).map((s) => [
			s,
			findings.filter((f) => f.severity === s).length,
		]),
	) as Record<OptimizationSeverity, number>

	return {
		findings,
		summary: {
			total: findings.length,
			byCategory,
			bySeverity,
		},
	}
}

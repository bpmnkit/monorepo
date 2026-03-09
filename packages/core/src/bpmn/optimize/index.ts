import type { BpmnDefinitions } from "../bpmn-model.js"
import { analyzeFeel } from "./feel.js"
import { analyzeFlow } from "./flow.js"
import { analyzeNaming } from "./naming.js"
import { analyzeTasks } from "./tasks.js"
import type {
	OptimizationCategory,
	OptimizationFinding,
	OptimizationReport,
	OptimizationSeverity,
	OptimizeOptions,
	ResolvedOptions,
} from "./types.js"

const ALL_CATEGORIES: OptimizationCategory[] = ["feel", "flow", "naming", "task-reuse", "extract"]

function resolveOptions(opts?: OptimizeOptions): ResolvedOptions {
	return {
		feelLengthThreshold: opts?.feelLengthThreshold ?? 80,
		feelNestingThreshold: opts?.feelNestingThreshold ?? 3,
		feelOperatorThreshold: opts?.feelOperatorThreshold ?? 5,
		feelVariableThreshold: opts?.feelVariableThreshold ?? 4,
		reuseThreshold: opts?.reuseThreshold ?? 2,
		categories: opts?.categories ?? [...ALL_CATEGORIES],
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
		if (resolved.categories.includes("flow")) {
			findings.push(...analyzeFlow(process, resolved))
		}
		if (resolved.categories.includes("naming")) {
			findings.push(...analyzeNaming(process, resolved))
		}
		if (resolved.categories.includes("task-reuse")) {
			findings.push(...analyzeTasks(process, resolved))
		}
	}

	const byCategory = Object.fromEntries(
		(["feel", "flow", "naming", "task-reuse", "extract"] as OptimizationCategory[]).map((c) => [
			c,
			findings.filter((f) => f.category === c).length,
		]),
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

/**
 * What `casen dev` runs after every save: the file's lint, and the scenarios in
 * its `.bpmn.tests.json` sidecar — the same checks as `casen lint` and
 * `casen test`, reduced to plain data the terminal and the browser both show.
 */

import { readFile, readdir } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { Engine, runScenario } from "@bpmnkit/engine"
import type { ProcessScenario } from "@bpmnkit/engine"
import { lintBpmn } from "../commands/lint.js"
import { type ModelKind, TESTS_SUFFIX } from "./project.js"
import type { CheckResult, LintSummary, ScenarioEngine, ScenarioOutcome } from "./protocol.js"

export type { CheckResult, LintSummary, ScenarioEngine, ScenarioOutcome }

/** A result is "red" when anything in it would make `casen lint` or `casen test` exit non-zero. */
export function isFailing(result: CheckResult): boolean {
	return (
		result.parseError !== undefined ||
		result.testsError !== undefined ||
		(result.lint?.errors ?? 0) > 0 ||
		(result.tests?.failed ?? 0) > 0
	)
}

function reason(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** Every `<decision id>` in the `.dmn` files beside a BPMN, the way `casen test` finds them. */
async function decisionsBeside(bpmnFile: string): Promise<Map<string, string>> {
	const dir = dirname(bpmnFile)
	const map = new Map<string, string>()
	const names = await readdir(dir).catch(() => [] as string[])
	for (const name of names) {
		if (extname(name).toLowerCase() !== ".dmn") continue
		const xml = await readFile(join(dir, name), "utf8").catch(() => null)
		if (xml === null) continue
		for (const [, id] of xml.matchAll(/<decision[^>]+\bid="([^"]+)"/g)) {
			if (id !== undefined) map.set(id, xml)
		}
	}
	return map
}

async function runScenarios(
	bpmnFile: string,
	xml: string,
	scenarios: ProcessScenario[],
	engine: ScenarioEngine,
): Promise<ScenarioOutcome[]> {
	const decisions = await decisionsBeside(bpmnFile)
	const outcomes: ScenarioOutcome[] = []
	for (const scenario of scenarios) {
		let result: Awaited<ReturnType<typeof runScenario>>
		if (engine === "wasm") {
			// Loaded on demand: the WASM engine is an optional dependency, and the
			// default engine should not pay for initialising it.
			const { runScenarioWasm } = await import("@bpmnkit/engine/wasm-runner")
			result = await runScenarioWasm(xml, scenario, (id) => decisions.get(id) ?? null)
		} else {
			const sim = new Engine()
			const dmnTexts = new Set(decisions.values())
			for (const dmn of dmnTexts) {
				try {
					sim.deploy({ decisions: Dmn.parse(dmn) })
				} catch {
					// A broken DMN beside the process is reported on its own row; the
					// scenario then fails on the missing decision, which says why.
				}
			}
			result = await runScenario(sim, Bpmn.parse(xml), scenario)
		}
		outcomes.push({
			name: scenario.name,
			passed: result.passed,
			durationMs: result.durationMs,
			problems: [
				...result.failures.map(
					(f) =>
						`${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`,
				),
				...result.errors.map(
					(e) => `error${e.elementId !== undefined ? ` (${e.elementId})` : ""}: ${e.message}`,
				),
			],
		})
	}
	return outcomes
}

/**
 * Checks one model file.
 *
 * @param absolute - The file on disk.
 * @param path - Its project-relative path, echoed into the result.
 * @param kind - What the file is.
 * @param engine - Which engine runs the scenarios.
 */
export async function checkFile(
	absolute: string,
	path: string,
	kind: ModelKind,
	engine: ScenarioEngine,
): Promise<CheckResult> {
	const base: CheckResult = { path, kind, at: new Date().toISOString() }
	let text: string
	try {
		text = await readFile(absolute, "utf8")
	} catch (error) {
		return { ...base, parseError: `Cannot read: ${reason(error)}` }
	}

	if (kind === "dmn" || kind === "form") {
		try {
			if (kind === "dmn") Dmn.parse(text)
			else Form.parse(text)
			return base
		} catch (error) {
			return { ...base, parseError: reason(error) }
		}
	}

	let lint: LintSummary
	try {
		const { findings } = await lintBpmn(absolute, text)
		lint = {
			errors: findings.filter((f) => f.severity === "error").length,
			warnings: findings.filter((f) => f.severity === "warning").length,
			infos: findings.filter((f) => f.severity === "info").length,
			findings: findings.map((f) => ({
				severity: f.severity,
				category: f.category,
				message: f.message,
				elementIds: f.elementIds,
			})),
		}
	} catch (error) {
		return { ...base, parseError: reason(error) }
	}

	const sidecar = await readFile(`${absolute}${TESTS_SUFFIX}`, "utf8").catch(() => null)
	if (sidecar === null) return { ...base, lint }

	let scenarios: unknown
	try {
		scenarios = JSON.parse(sidecar)
	} catch (error) {
		return { ...base, lint, testsError: `Invalid JSON in ${path}${TESTS_SUFFIX}: ${reason(error)}` }
	}
	if (!Array.isArray(scenarios)) {
		return { ...base, lint, testsError: `${path}${TESTS_SUFFIX} must hold an array of scenarios.` }
	}
	try {
		const outcomes = await runScenarios(absolute, text, scenarios as ProcessScenario[], engine)
		const passed = outcomes.filter((o) => o.passed).length
		return {
			...base,
			lint,
			tests: { engine, passed, failed: outcomes.length - passed, scenarios: outcomes },
		}
	} catch (error) {
		return { ...base, lint, testsError: reason(error) }
	}
}

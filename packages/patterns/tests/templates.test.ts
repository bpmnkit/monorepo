import { Bpmn, Dmn, Form, analyzeCamundaCompat, optimize, semanticHash } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnFlowElement } from "@bpmnkit/core"
import { Engine, runScenario } from "@bpmnkit/engine"
import { runScenarioWasm } from "@bpmnkit/engine/wasm-runner"
import { describe, expect, it } from "vitest"
import {
	ALL_TEMPLATES,
	TEMPLATE_CATEGORIES,
	getTemplate,
	listJobTypes,
	templateFiles,
} from "../src/templates/index.js"
import type { ProcessTemplate } from "../src/templates/index.js"

function elementIds(defs: BpmnDefinitions): Set<string> {
	const ids = new Set<string>()
	const visit = (elements: BpmnFlowElement[]): void => {
		for (const el of elements) {
			ids.add(el.id)
			if ("flowElements" in el) visit(el.flowElements)
		}
	}
	for (const p of defs.processes) visit(p.flowElements)
	return ids
}

/** What `casen template use` writes, read back the way `casen test` and a deploy would. */
function loadWritten(template: ProcessTemplate) {
	const files = templateFiles(template)
	const content = (suffix: string) =>
		files.filter((f) => f.path.endsWith(suffix)).map((f) => f.content)
	const [bpmnXml] = content(".bpmn")
	if (bpmnXml === undefined) throw new Error(`${template.id}: no .bpmn file`)
	const decisionXml = new Map<string, string>()
	for (const xml of content(".dmn")) {
		for (const [, id] of xml.matchAll(/<decision[^>]+\bid="([^"]+)"/g)) {
			if (id !== undefined) decisionXml.set(id, xml)
		}
	}
	return {
		bpmnXml,
		scenarios: content(".bpmn.tests.json").map((json) => JSON.parse(json) as unknown),
		decisions: content(".dmn").map((xml) => Dmn.parse(xml)),
		/** DMN XML by decision id, the way `casen test` finds it next to the BPMN file. */
		decisionXml,
		forms: content(".form").map((json) => Form.parse(json)),
	}
}

describe("template gallery", () => {
	it("has 20–30 templates with unique slug ids", () => {
		expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(20)
		expect(ALL_TEMPLATES.length).toBeLessThanOrEqual(30)
		const ids = ALL_TEMPLATES.map((t) => t.id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
		expect(getTemplate("order-to-cash")?.title).toBe("Order to Cash")
		expect(getTemplate("nope")).toBeUndefined()
	})

	it("fills every category, and every template has a happy path and an alternative", () => {
		for (const category of TEMPLATE_CATEGORIES) {
			expect(
				ALL_TEMPLATES.some((t) => t.category === category.id),
				category.id,
			).toBe(true)
		}
		for (const t of ALL_TEMPLATES) {
			expect(t.scenarios.length, t.id).toBeGreaterThanOrEqual(2)
			expect(t.description.length, t.id).toBeGreaterThan(120)
			expect(t.tags.length, t.id).toBeGreaterThanOrEqual(3)
		}
	})

	it("covers the seven agent patterns", () => {
		const ids = ALL_TEMPLATES.filter((t) => t.category === "ai-agents").map((t) => t.id)
		expect(ids).toEqual([
			"ai-prompt-chaining",
			"ai-routing",
			"ai-parallelization",
			"ai-orchestrator-workers",
			"ai-evaluator-optimizer",
			"ai-human-approval-gate",
			"ai-agent-tool-loop",
		])
	})
})

describe.each(ALL_TEMPLATES.map((t) => [t.id, t] as const))("%s", (_id, template) => {
	it("builds an executable process with no error-severity lint findings", () => {
		const defs = template.build()
		expect(defs.processes).toHaveLength(1)
		expect(defs.processes[0]?.id).toBe(template.id)
		expect(defs.processes[0]?.isExecutable).toBe(true)
		// Every category, not only deploy: `casen lint` fails on any error, and a
		// template should be something you can lint clean before changing it.
		const errors = optimize(defs).findings.filter((f) => f.severity === "error")
		expect(errors.map((f) => `${f.id}: ${f.message}`)).toEqual([])
	})

	it("runs on the Camunda version it targets", () => {
		// What the Camunda version check leaves is what bpmnlint-plugin-camunda-compat
		// 2.61 reports on these templates too: user tasks without a form (a warning
		// in Modeler as well), and a correlation key carried on the catch element
		// rather than on its message. Nothing the target version cannot run.
		const found = analyzeCamundaCompat(template.build())
		const unexpected = found.filter(
			(f) =>
				f.id !== "compat/user-task-definition" &&
				!(f.id === "compat/subscription" && f.severity === "warning"),
		)
		expect(unexpected.map((f) => `${f.id}: ${f.message}`)).toEqual([])
		expect(found.every((f) => f.severity === "warning")).toBe(true)
	})

	it("round-trips through XML unchanged", () => {
		const { bpmnXml } = loadWritten(template)
		const parsed = Bpmn.parse(bpmnXml)
		expect(Bpmn.export(parsed)).toBe(bpmnXml)
		expect(semanticHash(parsed)).toBe(semanticHash(template.build()))
		expect(bpmnXml).toContain("<bpmndi:BPMNShape")
	})

	it("scenarios name real elements and job types", () => {
		const defs = template.build()
		const ids = elementIds(defs)
		const jobTypes = new Set(listJobTypes(defs).map((j) => j.type))
		for (const scenario of template.scenarios) {
			for (const step of scenario.expect?.path ?? [])
				expect(ids, `${scenario.id}: ${step}`).toContain(step)
			for (const type of Object.keys(scenario.mocks ?? {})) {
				if (type !== "userTask") expect(jobTypes, `${scenario.id}: ${type}`).toContain(type)
			}
		}
	})

	it("writes decisions and forms the process references", () => {
		const { bpmnXml, decisions, forms, scenarios } = loadWritten(template)
		expect(scenarios).toEqual([template.scenarios])
		for (const [, id] of bpmnXml.matchAll(/decisionId="([^"]+)"/g)) {
			expect(decisions.flatMap((d) => d.decisions.map((x) => x.id))).toContain(id)
		}
		for (const [, id] of bpmnXml.matchAll(/formId="([^"]+)"/g)) {
			expect(forms.map((f) => f.id)).toContain(id)
		}
	})

	it.each(template.scenarios.map((s) => [s.name, s] as const))(
		"scenario passes: %s",
		async (_name, scenario) => {
			const { bpmnXml, decisions, forms } = loadWritten(template)
			const engine = new Engine()
			engine.deploy({ decisions, forms })
			const result = await runScenario(engine, Bpmn.parse(bpmnXml), scenario)
			expect({ failures: result.failures, errors: result.errors }).toEqual({
				failures: [],
				errors: [],
			})
			expect(result.passed).toBe(true)
		},
	)

	// `casen test` runs the same sidecar on Reebe (WebAssembly), which has Zeebe's
	// semantics; the gallery promises the scenarios pass there too.
	it.each(template.scenarios.map((s) => [s.name, s] as const))(
		"scenario passes on Reebe: %s",
		async (_name, scenario) => {
			const { bpmnXml, decisionXml } = loadWritten(template)
			const result = await runScenarioWasm(bpmnXml, scenario, (id) => decisionXml.get(id) ?? null)
			expect({ failures: result.failures, errors: result.errors }).toEqual({
				failures: [],
				errors: [],
			})
			expect(result.passed).toBe(true)
		},
	)
})

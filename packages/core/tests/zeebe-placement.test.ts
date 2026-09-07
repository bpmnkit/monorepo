import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { BpmnDefinitions, BpmnFlowElement, BpmnProcess } from "../src/bpmn/bpmn-model.js"
import { OperationError, applyBpmnOperations } from "../src/bpmn/full-operations.js"
import {
	ZeebePlacementError,
	assertZeebePlacement,
	bpmnElementName,
	ensureZeebeExtension,
	isZeebePlacementAllowed,
} from "../src/bpmn/zeebe-extensions.js"
import { Bpmn } from "../src/index.js"
import type { XmlElement } from "../src/types/xml-element.js"

/**
 * Zeebe extensions written to owners the schema forbids deploy fine and fail in
 * Camunda, far from the code that wrote them. The placement table is generated
 * from `zeebe.json`'s `meta.allowedIn`, so these tests are really two claims:
 * the table says what the descriptor says, and the writes go through it.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

function serviceTask(): BpmnFlowElement {
	return {
		type: "serviceTask",
		id: "T",
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
	}
}

function businessRuleTask(): BpmnFlowElement {
	return {
		type: "businessRuleTask",
		id: "B",
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
	}
}

describe("zeebe placement", () => {
	it("allows what the schema allows", () => {
		expect(isZeebePlacementAllowed("bpmn:serviceTask", "zeebe:taskDefinition")).toBe(true)
		expect(isZeebePlacementAllowed("bpmn:businessRuleTask", "zeebe:calledDecision")).toBe(true)
		expect(isZeebePlacementAllowed("bpmn:userTask", "zeebe:formDefinition")).toBe(true)
		expect(isZeebePlacementAllowed("bpmn:startEvent", "zeebe:formDefinition")).toBe(true)
		expect(isZeebePlacementAllowed("bpmn:callActivity", "zeebe:calledElement")).toBe(true)
	})

	it("rejects what the schema forbids", () => {
		expect(isZeebePlacementAllowed("bpmn:serviceTask", "zeebe:calledDecision")).toBe(false)
		expect(isZeebePlacementAllowed("bpmn:serviceTask", "zeebe:formDefinition")).toBe(false)
		expect(isZeebePlacementAllowed("bpmn:serviceTask", "zeebe:assignmentDefinition")).toBe(false)
		expect(isZeebePlacementAllowed("bpmn:userTask", "zeebe:taskDefinition")).toBe(false)
		expect(isZeebePlacementAllowed("bpmn:exclusiveGateway", "zeebe:ioMapping")).toBe(false)
	})

	it("names the allowed owners when it refuses", () => {
		expect(() => assertZeebePlacement("bpmn:serviceTask", "zeebe:calledDecision")).toThrow(
			ZeebePlacementError,
		)
		try {
			assertZeebePlacement("bpmn:serviceTask", "zeebe:calledDecision")
			expect.unreachable()
		} catch (error) {
			expect((error as ZeebePlacementError).allowedOn).toEqual(["bpmn:businessRuleTask"])
			expect((error as Error).message).toContain("bpmn:businessRuleTask")
		}
	})

	/**
	 * The descriptor declares no `allowedIn` for `zeebe:subscription` or
	 * `zeebe:properties`. Rejecting them would mean inventing a rule the schema
	 * does not state — and `zeebe:subscription` on a `bpmn:message` is the
	 * correlation key that A3 went to some trouble to stop losing.
	 */
	it("allows extensions the descriptor says nothing about", () => {
		expect(isZeebePlacementAllowed("bpmn:message", "zeebe:subscription")).toBe(true)
		expect(isZeebePlacementAllowed("bpmn:serviceTask", "zeebe:properties")).toBe(true)
		expect(isZeebePlacementAllowed("bpmn:serviceTask", "camunda:whatever")).toBe(true)
	})

	it("treats an event sub-process as the sub-process it is written as", () => {
		expect(bpmnElementName({ type: "eventSubProcess" })).toBe("bpmn:subProcess")
		expect(bpmnElementName({ type: "serviceTask" })).toBe("bpmn:serviceTask")
	})
})

describe("ensureZeebeExtension", () => {
	it("creates an extension the schema allows", () => {
		const task = serviceTask()
		const created = ensureZeebeExtension(task, "zeebe:taskDefinition")
		created.attributes.type = "worker"
		expect(task.extensionElements).toEqual([
			{ name: "zeebe:taskDefinition", attributes: { type: "worker" }, children: [] },
		])
	})

	it("returns the existing extension rather than a second one", () => {
		const task = serviceTask()
		ensureZeebeExtension(task, "zeebe:taskDefinition").attributes.retries = "5"
		ensureZeebeExtension(task, "zeebe:taskDefinition").attributes.type = "worker"
		expect(task.extensionElements).toHaveLength(1)
		expect(task.extensionElements[0]?.attributes).toEqual({ retries: "5", type: "worker" })
	})

	it("refuses without touching the element", () => {
		const task = serviceTask()
		expect(() => ensureZeebeExtension(task, "zeebe:calledDecision")).toThrow(ZeebePlacementError)
		expect(task.extensionElements).toEqual([])
	})

	it("allows on the owner the schema names", () => {
		const rule = businessRuleTask()
		expect(() => ensureZeebeExtension(rule, "zeebe:calledDecision")).not.toThrow()
	})
})

/**
 * The table is only worth having if it agrees with the code that already writes
 * these extensions. Every `zeebe:` element the builder and the corpus produce is
 * checked against it — a wrong entry shows up here as an existing, working
 * document being declared invalid.
 */
describe("everything we write is placeable where we write it", () => {
	function bags(definitions: BpmnDefinitions): Array<{ owner: string; elements: XmlElement[] }> {
		const found: Array<{ owner: string; elements: XmlElement[] }> = []

		const walkFlowElements = (elements: BpmnFlowElement[]): void => {
			for (const element of elements) {
				found.push({ owner: bpmnElementName(element), elements: element.extensionElements })
				if ("flowElements" in element && Array.isArray(element.flowElements)) {
					walkFlowElements(element.flowElements)
				}
			}
		}

		const walkProcess = (process: BpmnProcess): void => {
			found.push({ owner: "bpmn:process", elements: process.extensionElements })
			walkFlowElements(process.flowElements)
		}

		for (const process of definitions.processes) walkProcess(process)
		return found
	}

	function offences(definitions: BpmnDefinitions): string[] {
		return bags(definitions).flatMap(({ owner, elements }) =>
			elements
				.filter((element) => element.name.startsWith("zeebe:"))
				.filter((element) => !isZeebePlacementAllowed(owner, element.name))
				.map((element) => `${element.name} on ${owner}`),
		)
	}

	const corpus = join(HERE, "fixtures", "roundtrip")
	for (const file of readdirSync(corpus).filter((name) => name.endsWith(".bpmn"))) {
		it(`accepts every extension in ${file}`, () => {
			expect(offences(Bpmn.parse(readFileSync(join(corpus, file), "utf-8")))).toEqual([])
		})
	}

	it("accepts every extension the builder produces", () => {
		const built = Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("svc", { name: "Call", taskType: "call", retries: "5" })
			.userTask("user", { name: "Approve", assignee: "kim" })
			.businessRuleTask("rule", { name: "Decide", decisionId: "d", resultVariable: "r" })
			.scriptTask("script", { name: "Compute", expression: "= 1 + 1", resultVariable: "n" })
			.callActivity("call", { name: "Sub", processId: "child" })
			.endEvent("end")
			.build()
		expect(offences(built)).toEqual([])
	})
})

/**
 * A descriptor bump that moves the surface must fail the build rather than leave
 * the table quietly describing the previous release.
 */
describe("the generated table", () => {
	it("still matches the descriptors", () => {
		const script = join(HERE, "..", "scripts", "generate-zeebe-placement.ts")
		expect(() =>
			execFileSync("npx", ["tsx", script, "--check"], {
				cwd: join(HERE, ".."),
				encoding: "utf-8",
				stdio: "pipe",
			}),
		).not.toThrow()
	})
})

/**
 * The path that matters: operations arrive from a model, not from a programmer,
 * so a patch that puts an extension on the wrong element is a thing that will
 * happen. It has to be reported the way every other bad operation is — as a
 * problem the caller can show — not as an exception that abandons the batch.
 */
describe("operations report a misplaced extension", () => {
	function twoTasks(): BpmnDefinitions {
		return Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("svc", { name: "Call", taskType: "call" })
			.businessRuleTask("rule", { name: "Decide", decisionId: "d" })
			.endEvent("end")
			.build()
	}

	it("refuses a decision on a service task", () => {
		const { problems, applied } = applyBpmnOperations(
			twoTasks(),
			[{ op: "update", id: "svc", patch: { decisionId: "nope" } }],
			{ strict: false },
		)
		expect(applied).toBe(0)
		expect(problems).toHaveLength(1)
		expect(problems[0]?.reason).toContain("zeebe:calledDecision")
		expect(problems[0]?.reason).toContain("bpmn:serviceTask")
	})

	it("leaves the element untouched when it refuses", () => {
		const { definitions } = applyBpmnOperations(
			twoTasks(),
			[{ op: "update", id: "svc", patch: { name: "Renamed", decisionId: "nope" } }],
			{ strict: false },
		)
		const task = definitions.processes[0]?.flowElements.find((e) => e.id === "svc")
		expect(task?.name).toBe("Call")
		expect(task?.extensionElements.map((e) => e.name)).toEqual(["zeebe:taskDefinition"])
	})

	it("applies the rest of the batch", () => {
		const { applied, problems, definitions } = applyBpmnOperations(
			twoTasks(),
			[
				{ op: "update", id: "svc", patch: { decisionId: "nope" } },
				{ op: "rename", id: "rule", name: "Decide twice" },
			],
			{ strict: false },
		)
		expect(applied).toBe(1)
		expect(problems).toHaveLength(1)
		expect(definitions.processes[0]?.flowElements.find((e) => e.id === "rule")?.name).toBe(
			"Decide twice",
		)
	})

	it("throws in strict mode, changing nothing", () => {
		const before = twoTasks()
		expect(() =>
			applyBpmnOperations(before, [{ op: "update", id: "svc", patch: { decisionId: "nope" } }]),
		).toThrow(OperationError)
		expect(
			before.processes[0]?.flowElements.find((e) => e.id === "svc")?.extensionElements,
		).toEqual([{ name: "zeebe:taskDefinition", attributes: { type: "call" }, children: [] }])
	})

	it("still allows the same field on the element that may carry it", () => {
		const { applied, problems } = applyBpmnOperations(
			twoTasks(),
			[{ op: "update", id: "rule", patch: { decisionId: "other" } }],
			{ strict: false },
		)
		expect(problems).toEqual([])
		expect(applied).toBe(1)
	})
})

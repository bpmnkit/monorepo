import { describe, expect, it } from "vitest"
import type {
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnSubProcess,
} from "../src/bpmn/bpmn-model.js"
import { extractFeelIdentifiers } from "../src/bpmn/optimize/variable-flow.js"
import { analyzeVariableFlow } from "../src/bpmn/optimize/variable-flow.js"
import type { XmlElement } from "../src/types/xml-element.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProcess(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[] = []): BpmnProcess {
	return {
		id: "Process_1",
		extensionElements: [],
		flowElements: elements,
		sequenceFlows: flows,
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}
}

function ioMapping(
	inputs: { source: string; target: string }[] = [],
	outputs: { source: string; target: string }[] = [],
): XmlElement {
	return {
		name: "zeebe:ioMapping",
		attributes: {},
		children: [
			...inputs.map((i) => ({
				name: "zeebe:input",
				attributes: { source: i.source, target: i.target },
				children: [],
			})),
			...outputs.map((o) => ({
				name: "zeebe:output",
				attributes: { source: o.source, target: o.target },
				children: [],
			})),
		],
	}
}

function makeTask(id: string, extensionElements: XmlElement[]): BpmnFlowElement {
	return {
		id,
		type: "serviceTask",
		name: id,
		extensionElements,
		unknownAttributes: {},
	}
}

function makeFlow(
	id: string,
	sourceRef: string,
	targetRef: string,
	condition?: string,
): BpmnSequenceFlow {
	return {
		id,
		type: "sequenceFlow",
		sourceRef,
		targetRef,
		name: "",
		extensionElements: [],
		unknownAttributes: {},
		conditionExpression: condition !== undefined ? { text: condition } : undefined,
	}
}

// ---------------------------------------------------------------------------
// extractFeelIdentifiers
// ---------------------------------------------------------------------------

describe("extractFeelIdentifiers", () => {
	it("returns empty for empty string", () => {
		expect(extractFeelIdentifiers("")).toEqual([])
	})

	it("does not mistake a FEEL built-in for a variable", () => {
		expect(
			extractFeelIdentifiers("is empty(items) and partition(xs, 2) != null and fromAi(toolCall.a)"),
		).toEqual(["items", "xs", "toolCall"])
	})

	it("extracts a simple name", () => {
		expect(extractFeelIdentifiers("myVar")).toContain("myVar")
	})

	it("strips leading = prefix", () => {
		expect(extractFeelIdentifiers("= foo")).toContain("foo")
	})

	it("extracts both sides of binary expression", () => {
		const names = extractFeelIdentifiers("a + b")
		expect(names).toContain("a")
		expect(names).toContain("b")
	})

	it("extracts root of path expression only", () => {
		const names = extractFeelIdentifiers("order.status")
		expect(names).toContain("order")
		expect(names).not.toContain("status")
	})

	it("excludes FEEL built-in names", () => {
		const names = extractFeelIdentifiers("count(items)")
		expect(names).not.toContain("count")
		expect(names).toContain("items")
	})

	it("excludes true/false/null literals", () => {
		const names = extractFeelIdentifiers("true")
		expect(names).not.toContain("true")
	})
})

// ---------------------------------------------------------------------------
// analyzeVariableFlow — undefined variable
// ---------------------------------------------------------------------------

describe("analyzeVariableFlow — undefined variable", () => {
	it("flags a variable consumed but never produced", () => {
		const task = makeTask("Task_1", [ioMapping([], [{ source: "result", target: "result" }])])
		// downstream task reads 'unknownVar' which is never produced
		const consumer = makeTask("Task_2", [
			ioMapping([{ source: "unknownVar", target: "localVar" }], []),
		])
		const p = makeProcess([task, consumer])
		const findings = analyzeVariableFlow(p)

		const undef = findings.filter((f) => f.id.startsWith("data-flow/undefined-variable:unknownVar"))
		expect(undef.length).toBe(1)
		expect(undef[0]?.severity).toBe("warning")
		expect(undef[0]?.consumes).toContain("unknownVar")
	})

	it("suggests a typo correction when edit distance ≤ 2", () => {
		// Produces 'orderId', consumes 'ordrId' (1 edit away)
		const producer = makeTask("Task_1", [ioMapping([], [{ source: "=result", target: "orderId" }])])
		const consumer = makeTask("Task_2", [ioMapping([{ source: "ordrId", target: "local" }], [])])
		const p = makeProcess([producer, consumer])
		const findings = analyzeVariableFlow(p)

		const undef = findings.find((f) => f.id === "data-flow/undefined-variable:ordrId")
		expect(undef).toBeDefined()
		expect(undef?.suggestion).toContain("orderId")
	})

	it("does not flag a variable that is both produced and consumed", () => {
		const producer = makeTask("Task_1", [ioMapping([], [{ source: "=42", target: "price" }])])
		const consumer = makeTask("Task_2", [
			ioMapping([{ source: "price", target: "localPrice" }], []),
		])
		const p = makeProcess([producer, consumer])
		const findings = analyzeVariableFlow(p)

		const undef = findings.filter((f) => f.id.startsWith("data-flow/undefined-variable:price"))
		expect(undef.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// analyzeVariableFlow — dead output
// ---------------------------------------------------------------------------

describe("analyzeVariableFlow — dead output", () => {
	it("flags a variable produced but never consumed", () => {
		const task = makeTask("Task_1", [ioMapping([], [{ source: "=result", target: "unusedVar" }])])
		const p = makeProcess([task])
		const findings = analyzeVariableFlow(p)

		const dead = findings.filter((f) => f.id === "data-flow/dead-output:unusedVar")
		expect(dead.length).toBe(1)
		expect(dead[0]?.severity).toBe("info")
		expect(dead[0]?.produces).toContain("unusedVar")
	})

	it("does not flag a variable that is consumed downstream", () => {
		const producer = makeTask("Task_1", [ioMapping([], [{ source: "=result", target: "data" }])])
		const consumer = makeTask("Task_2", [ioMapping([{ source: "data", target: "local" }], [])])
		const p = makeProcess([producer, consumer])
		const findings = analyzeVariableFlow(p)

		const dead = findings.filter((f) => f.id === "data-flow/dead-output:data")
		expect(dead.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// analyzeVariableFlow — sequence flow conditions
// ---------------------------------------------------------------------------

describe("analyzeVariableFlow — sequence flow conditions", () => {
	it("records condition variable as consumed on gateway", () => {
		const gw = makeTask("Gateway_1", [])
		const p = makeProcess(
			[gw],
			[makeFlow("Flow_1", "Gateway_1", "Task_A", '= status == "approved"')],
		)
		const findings = analyzeVariableFlow(p)

		const role = findings.find((f) => f.id === "data-flow/role:Gateway_1")
		expect(role?.consumes).toContain("status")
	})
})

// ---------------------------------------------------------------------------
// analyzeVariableFlow — role findings
// ---------------------------------------------------------------------------

describe("analyzeVariableFlow — role findings", () => {
	it("emits role findings for elements with variable activity", () => {
		const task = makeTask("Task_1", [ioMapping([], [{ source: "=x", target: "out" }])])
		const p = makeProcess([task])
		const findings = analyzeVariableFlow(p)

		const role = findings.find((f) => f.id === "data-flow/role:Task_1")
		expect(role).toBeDefined()
		expect(role?.produces).toContain("out")
	})

	it("includes consumed variables in role finding", () => {
		const task = makeTask("Task_1", [ioMapping([{ source: "inputVar", target: "local" }], [])])
		const p = makeProcess([task])
		const findings = analyzeVariableFlow(p)

		const role = findings.find((f) => f.id === "data-flow/role:Task_1")
		expect(role?.consumes).toContain("inputVar")
	})
})

// ---------------------------------------------------------------------------
// analyzeVariableFlow — multi-instance sub-process inner scopes
// ---------------------------------------------------------------------------

function makeSubProcess(
	id: string,
	inputElement: string,
	innerElements: BpmnFlowElement[],
	innerFlows: BpmnSequenceFlow[],
): BpmnSubProcess {
	return {
		id,
		type: "subProcess",
		name: id,
		extensionElements: [],
		unknownAttributes: {},
		loopCharacteristics: {
			extensionElements: [
				{
					name: "zeebe:loopCharacteristics",
					attributes: { inputCollection: "= items", inputElement },
					children: [],
				},
			],
		},
		flowElements: innerElements,
		sequenceFlows: innerFlows,
		textAnnotations: [],
		associations: [],
	}
}

describe("analyzeVariableFlow — multi-instance sub-process inner scopes", () => {
	it("emits edge-scope finding with inputElement for inner flows", () => {
		const innerTask = makeTask("InnerTask", [])
		const innerFlow = makeFlow("InnerFlow_1", "Start_1", "InnerTask")
		const sp = makeSubProcess("SP_1", "email", [innerTask], [innerFlow])
		const p = makeProcess([sp as unknown as BpmnFlowElement])
		const findings = analyzeVariableFlow(p)

		const scope = findings.find((f) => f.id === "data-flow/edge-scope:InnerFlow_1")
		expect(scope).toBeDefined()
		expect(scope?.produces).toContain("email")
	})

	it("includes variables produced by inner elements in inner scope", () => {
		const innerTask = makeTask("InnerTask", [
			ioMapping([], [{ source: "= email.subject", target: "subject" }]),
		])
		const flow1 = makeFlow("InnerFlow_1", "Start_1", "InnerTask")
		const flow2 = makeFlow("InnerFlow_2", "InnerTask", "End_1")
		const sp = makeSubProcess("SP_1", "email", [innerTask], [flow1, flow2])
		const p = makeProcess([sp as unknown as BpmnFlowElement])
		const findings = analyzeVariableFlow(p)

		const scope2 = findings.find((f) => f.id === "data-flow/edge-scope:InnerFlow_2")
		expect(scope2).toBeDefined()
		expect(scope2?.produces).toContain("email")
		expect(scope2?.produces).toContain("subject")
	})

	it("does not emit inner scopes for sub-processes without loopCharacteristics", () => {
		const sp: BpmnFlowElement = {
			id: "SP_plain",
			type: "subProcess",
			name: "Plain",
			extensionElements: [],
			unknownAttributes: {},
			flowElements: [makeTask("InnerTask", [])],
			sequenceFlows: [makeFlow("InnerFlow_plain", "Start", "InnerTask")],
			textAnnotations: [],
			associations: [],
		} as unknown as BpmnFlowElement
		const p = makeProcess([sp])
		const findings = analyzeVariableFlow(p)

		const scope = findings.find((f) => f.id === "data-flow/edge-scope:InnerFlow_plain")
		expect(scope).toBeUndefined()
	})

	it("does not emit inner scopes when inputElement is missing", () => {
		const innerFlow = makeFlow("InnerFlow_noelement", "Start", "End")
		const sp: BpmnFlowElement = {
			id: "SP_2",
			type: "subProcess",
			name: "SP_2",
			extensionElements: [],
			unknownAttributes: {},
			loopCharacteristics: {
				extensionElements: [
					{
						name: "zeebe:loopCharacteristics",
						attributes: { inputCollection: "= items" }, // no inputElement
						children: [],
					},
				],
			},
			flowElements: [],
			sequenceFlows: [innerFlow],
			textAnnotations: [],
			associations: [],
		} as unknown as BpmnFlowElement
		const p = makeProcess([sp])
		const findings = analyzeVariableFlow(p)

		const scope = findings.find((f) => f.id === "data-flow/edge-scope:InnerFlow_noelement")
		expect(scope).toBeUndefined()
	})
})

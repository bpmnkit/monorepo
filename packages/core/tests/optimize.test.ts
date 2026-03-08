import { beforeEach, describe, expect, it } from "vitest";
import type {
	BpmnDefinitions,
	BpmnDiagram,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../src/bpmn/bpmn-model.js";
import { optimize } from "../src/bpmn/optimize/index.js";
import { resetIdCounter } from "../src/index.js";
import type { XmlElement } from "../src/types/xml-element.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProcess(
	id: string,
	elements: BpmnFlowElement[],
	flows: BpmnSequenceFlow[],
	overrides?: Partial<BpmnProcess>,
): BpmnProcess {
	return {
		id,
		extensionElements: [],
		flowElements: elements,
		sequenceFlows: flows,
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
		...overrides,
	};
}

function makeDefs(process: BpmnProcess, diagrams?: BpmnDiagram[]): BpmnDefinitions {
	return {
		id: "Definitions_1",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes: [process],
		diagrams: diagrams ?? [],
	};
}

function taskDefExt(type: string): XmlElement {
	return { name: "zeebe:taskDefinition", attributes: { type }, children: [] };
}

function headerExt(headers: { key: string; value: string }[]): XmlElement {
	return {
		name: "zeebe:taskHeaders",
		attributes: {},
		children: headers.map((h) => ({
			name: "zeebe:header",
			attributes: { key: h.key, value: h.value },
			children: [],
		})),
	};
}

function ioExt(
	inputs: { source: string; target: string }[],
	outputs: { source: string; target: string }[],
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
	};
}

function startEl(id: string): BpmnFlowElement {
	return {
		type: "startEvent",
		id,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
	};
}

function endEl(id: string, incoming: string[] = []): BpmnFlowElement {
	return {
		type: "endEvent",
		id,
		incoming,
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
	};
}

function taskEl(
	id: string,
	incoming: string[] = [],
	outgoing: string[] = [],
	ext: XmlElement[] = [],
): BpmnFlowElement {
	return {
		type: "serviceTask",
		id,
		incoming,
		outgoing,
		extensionElements: ext,
		unknownAttributes: {},
	};
}

function flow(id: string, src: string, tgt: string, condition?: string): BpmnSequenceFlow {
	return {
		id,
		sourceRef: src,
		targetRef: tgt,
		extensionElements: [],
		unknownAttributes: {},
		...(condition !== undefined
			? { conditionExpression: { text: condition, attributes: {} } }
			: {}),
	};
}

function xgwEl(
	id: string,
	incoming: string[],
	outgoing: string[],
	defaultFlow?: string,
): BpmnFlowElement {
	return {
		type: "exclusiveGateway",
		id,
		incoming,
		outgoing,
		extensionElements: [],
		unknownAttributes: {},
		...(defaultFlow !== undefined ? { default: defaultFlow } : {}),
	};
}

function gwEl(id: string, incoming: string[], outgoing: string[]): BpmnFlowElement {
	return {
		type: "exclusiveGateway",
		id,
		incoming,
		outgoing,
		extensionElements: [],
		unknownAttributes: {},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("optimize()", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	// -----------------------------------------------------------------------
	// FEEL analysis
	// -----------------------------------------------------------------------

	describe("FEEL analysis", () => {
		it("reports feel/empty-condition for ungated exclusive gateway branch", () => {
			const gw = xgwEl("gw1", ["f0"], ["f1", "f2"], "f1");
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f1"]), endEl("e2", ["f2"])],
				[
					flow("f0", "s", "gw1"),
					flow("f1", "gw1", "e"), // has no condition but IS default → ok
					flow("f2", "gw1", "e2"), // no condition, not default → error
				],
			);
			const report = optimize(makeDefs(proc));
			const finding = report.findings.find((f) => f.id === "feel/empty-condition");
			expect(finding).toBeDefined();
			expect(finding?.elementIds).toContain("f2");
		});

		it("reports feel/missing-default-flow when no default set", () => {
			const gw = gwEl("gw1", ["f0"], ["f1", "f2"]);
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f1"]), endEl("e2", ["f2"])],
				[
					flow("f0", "s", "gw1"),
					flow("f1", "gw1", "e", "= x > 0"),
					flow("f2", "gw1", "e2", "= x <= 0"),
				],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "feel/missing-default-flow")).toBe(true);
		});

		it("applyFix for feel/missing-default-flow sets default attribute", () => {
			const gw = gwEl("gw1", ["f0"], ["f1", "f2"]);
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f1"]), endEl("e2", ["f2"])],
				[
					flow("f0", "s", "gw1"),
					flow("f1", "gw1", "e", "= x > 0"),
					flow("f2", "gw1", "e2", "= x <= 0"),
				],
			);
			const defs = makeDefs(proc);
			const report = optimize(defs);
			const finding = report.findings.find((f) => f.id === "feel/missing-default-flow");
			if (!finding || !finding.applyFix) throw new Error("Missing applyFix");

			finding.applyFix(defs);

			const updatedGw = defs.processes[0]?.flowElements.find((e) => e.id === "gw1");
			if (!updatedGw) throw new Error("Gateway not found");
			expect(updatedGw.type === "exclusiveGateway" ? updatedGw.default : undefined).toBeDefined();
		});

		it("reports feel/complex-condition for expression over length threshold", () => {
			const gw = gwEl("gw1", ["f0"], ["f1", "f2"]);
			// >80 char expression
			const longExpr =
				"= someVariable > anotherLongVariableName and thirdVar != fourthVar or fifthVar <= sixthValue";
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f1"]), endEl("e2", ["f2"])],
				[
					flow("f0", "s", "gw1"),
					flow("f1", "gw1", "e", longExpr),
					flow("f2", "gw1", "e2", "= true"),
				],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "feel/complex-condition")).toBe(true);
		});

		it("reports feel/duplicate-expression for reused FEEL text", () => {
			const gw1 = gwEl("gw1", ["f0"], ["f1", "f2"]);
			const gw2 = gwEl("gw2", ["f3"], ["f4", "f5"]);
			const proc = makeProcess(
				"proc",
				[
					startEl("s"),
					gw1,
					endEl("e1", ["f1"]),
					endEl("e2", ["f2"]),
					gw2,
					endEl("e3", ["f4"]),
					endEl("e4", ["f5"]),
				],
				[
					flow("f0", "s", "gw1"),
					flow("f1", "gw1", "e1", "= x > 0"),
					flow("f2", "gw1", "e2", "= x <= 0"),
					flow("f3", "s", "gw2"),
					flow("f4", "gw2", "e3", "= x > 0"), // duplicate
					flow("f5", "gw2", "e4", "= x <= 0"), // duplicate
				],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "feel/duplicate-expression")).toBe(true);
		});

		it("does not flag when expression is below all thresholds", () => {
			const gw = xgwEl("gw1", ["f0"], ["f1", "f2"], "f2");
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f1"]), endEl("e2", ["f2"])],
				[flow("f0", "s", "gw1"), flow("f1", "gw1", "e", "= x > 0"), flow("f2", "gw1", "e2")],
			);
			const report = optimize(makeDefs(proc));
			const feelFindings = report.findings.filter((f) => f.category === "feel");
			expect(feelFindings.every((f) => f.id !== "feel/complex-condition")).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Flow analysis
	// -----------------------------------------------------------------------

	describe("flow analysis", () => {
		it("reports flow/unreachable for isolated element", () => {
			const isolated = taskEl("isolated");
			const proc = makeProcess(
				"proc",
				[startEl("s"), endEl("e", ["f1"]), isolated],
				[flow("f1", "s", "e")],
			);
			const report = optimize(makeDefs(proc));
			const finding = report.findings.find(
				(f) => f.id === "flow/unreachable" && f.elementIds.includes("isolated"),
			);
			expect(finding).toBeDefined();
		});

		it("reports flow/dead-end for task with no outgoing flow", () => {
			const deadEnd = taskEl("t1", ["f1"]);
			const proc = makeProcess("proc", [startEl("s"), deadEnd], [flow("f1", "s", "t1")]);
			const report = optimize(makeDefs(proc));
			expect(
				report.findings.some((f) => f.id === "flow/dead-end" && f.elementIds.includes("t1")),
			).toBe(true);
		});

		it("applyFix for flow/dead-end inserts end event and sequence flow", () => {
			const deadEnd = taskEl("t1", ["f1"]);
			const proc = makeProcess("proc", [startEl("s"), deadEnd], [flow("f1", "s", "t1")]);
			const defs = makeDefs(proc);
			const report = optimize(defs);
			const finding = report.findings.find((f) => f.id === "flow/dead-end");
			if (!finding || !finding.applyFix) throw new Error("Missing applyFix");

			finding.applyFix(defs);

			const updatedProc = defs.processes[0];
			if (!updatedProc) throw new Error("Process not found");
			expect(updatedProc.flowElements.some((e) => e.type === "endEvent")).toBe(true);
			expect(updatedProc.sequenceFlows.some((f) => f.sourceRef === "t1")).toBe(true);
		});

		it("reports flow/no-end-event for process without end event", () => {
			const proc = makeProcess(
				"proc",
				[startEl("s"), taskEl("t1", ["f1"])],
				[flow("f1", "s", "t1")],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "flow/no-end-event")).toBe(true);
		});

		it("reports flow/redundant-gateway for pass-through gateway", () => {
			const gw = gwEl("gw1", ["f1"], ["f2"]);
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f2"])],
				[flow("f1", "s", "gw1"), flow("f2", "gw1", "e")],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "flow/redundant-gateway")).toBe(true);
		});

		it("applyFix for flow/redundant-gateway removes gateway and rewires", () => {
			const gw = gwEl("gw1", ["f1"], ["f2"]);
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f2"])],
				[flow("f1", "s", "gw1"), flow("f2", "gw1", "e")],
			);
			const defs = makeDefs(proc);
			const report = optimize(defs);
			const finding = report.findings.find((f) => f.id === "flow/redundant-gateway");
			if (!finding || !finding.applyFix) throw new Error("Missing applyFix");

			finding.applyFix(defs);

			const updatedProc = defs.processes[0];
			if (!updatedProc) throw new Error("Process not found");
			expect(updatedProc.flowElements.some((e) => e.id === "gw1")).toBe(false);
			expect(updatedProc.sequenceFlows.some((f) => f.id === "f1")).toBe(false);
			expect(updatedProc.sequenceFlows.some((f) => f.id === "f2")).toBe(false);
			// New direct flow from s → e
			expect(
				updatedProc.sequenceFlows.some((f) => f.sourceRef === "s" && f.targetRef === "e"),
			).toBe(true);
		});

		it("reports flow/empty-subprocess", () => {
			const sub: BpmnFlowElement = {
				type: "subProcess",
				id: "sub1",
				incoming: ["f1"],
				outgoing: ["f2"],
				extensionElements: [],
				unknownAttributes: {},
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
			const proc = makeProcess(
				"proc",
				[startEl("s"), sub, endEl("e", ["f2"])],
				[flow("f1", "s", "sub1"), flow("f2", "sub1", "e")],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "flow/empty-subprocess")).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Task reuse analysis
	// -----------------------------------------------------------------------

	describe("task reuse analysis", () => {
		function makeIdenticalTasks(id1: string, id2: string): BpmnFlowElement[] {
			const ext = [taskDefExt("my-connector"), headerExt([{ key: "apiKey", value: "123" }])];
			return [taskEl(id1, ["f1"], ["f2"], ext), taskEl(id2, ["f3"], ["f4"], ext)];
		}

		it("reports task/reusable-group for 2 identical service tasks", () => {
			const [t1, t2] = makeIdenticalTasks("t1", "t2");
			if (!t1 || !t2) throw new Error("Tasks not created");
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, t2, endEl("e")],
				[
					flow("f1", "s", "t1"),
					flow("f2", "t1", "e"),
					flow("f3", "s", "t2"),
					flow("f4", "t2", "e"),
				],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "task/reusable-group")).toBe(true);
		});

		it("applyFix replaces both service tasks with callActivities", () => {
			const [t1, t2] = makeIdenticalTasks("t1", "t2");
			if (!t1 || !t2) throw new Error("Tasks not created");
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, t2, endEl("e")],
				[
					flow("f1", "s", "t1"),
					flow("f2", "t1", "e"),
					flow("f3", "s", "t2"),
					flow("f4", "t2", "e"),
				],
			);
			const defs = makeDefs(proc);
			const report = optimize(defs);
			const finding = report.findings.find((f) => f.id === "task/reusable-group");
			if (!finding || !finding.applyFix) throw new Error("Missing applyFix");

			finding.applyFix(defs);

			const updatedProc = defs.processes[0];
			if (!updatedProc) throw new Error("Process not found");
			const t1Updated = updatedProc.flowElements.find((e) => e.id === "t1");
			const t2Updated = updatedProc.flowElements.find((e) => e.id === "t2");
			expect(t1Updated?.type).toBe("callActivity");
			expect(t2Updated?.type).toBe("callActivity");
		});

		it("applyFix generated field is valid BpmnDefinitions with one process", () => {
			const [t1, t2] = makeIdenticalTasks("t1", "t2");
			if (!t1 || !t2) throw new Error("Tasks not created");
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, t2, endEl("e")],
				[
					flow("f1", "s", "t1"),
					flow("f2", "t1", "e"),
					flow("f3", "s", "t2"),
					flow("f4", "t2", "e"),
				],
			);
			const defs = makeDefs(proc);
			const report = optimize(defs);
			const finding = report.findings.find((f) => f.id === "task/reusable-group");
			if (!finding || !finding.applyFix) throw new Error("Missing applyFix");

			const result = finding.applyFix(defs);
			expect(result.generated).toBeDefined();
			expect(result.generated?.processes).toHaveLength(1);
		});

		it("generated process contains the original taskType", () => {
			const [t1, t2] = makeIdenticalTasks("t1", "t2");
			if (!t1 || !t2) throw new Error("Tasks not created");
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, t2, endEl("e")],
				[
					flow("f1", "s", "t1"),
					flow("f2", "t1", "e"),
					flow("f3", "s", "t2"),
					flow("f4", "t2", "e"),
				],
			);
			const defs = makeDefs(proc);
			const report = optimize(defs);
			const finding = report.findings.find((f) => f.id === "task/reusable-group");
			if (!finding || !finding.applyFix) throw new Error("Missing applyFix");

			const result = finding.applyFix(defs);
			const genProc = result.generated?.processes[0];
			if (!genProc) throw new Error("No generated process");
			const hasTaskDef = genProc.flowElements.some((el) =>
				el.extensionElements.some(
					(ext) => ext.name === "zeebe:taskDefinition" && ext.attributes.type === "my-connector",
				),
			);
			expect(hasTaskDef).toBe(true);
		});

		it("does not report when only 1 task of a type", () => {
			const t1 = taskEl(
				"t1",
				["f1"],
				["f2"],
				[taskDefExt("my-connector"), headerExt([{ key: "k", value: "v" }])],
			);
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, endEl("e", ["f2"])],
				[flow("f1", "s", "t1"), flow("f2", "t1", "e")],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "task/reusable-group")).toBe(false);
		});

		it("does not report when similarity < 0.70", () => {
			// Same taskType (0.50) but different headers and different IO count → total 0.50 < 0.70
			const t1 = taskEl(
				"t1",
				["f1"],
				["f2"],
				[
					taskDefExt("my-connector"),
					headerExt([{ key: "keyA", value: "v" }]),
					ioExt([{ source: "= x", target: "inputVar" }], []),
				],
			);
			const t2 = taskEl(
				"t2",
				["f3"],
				["f4"],
				[taskDefExt("my-connector"), headerExt([{ key: "keyB", value: "v" }])],
			);
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, t2, endEl("e")],
				[
					flow("f1", "s", "t1"),
					flow("f2", "t1", "e"),
					flow("f3", "s", "t2"),
					flow("f4", "t2", "e"),
				],
			);
			const report = optimize(makeDefs(proc));
			expect(report.findings.some((f) => f.id === "task/reusable-group")).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Options
	// -----------------------------------------------------------------------

	describe("options", () => {
		it('categories: ["flow"] returns only flow findings', () => {
			const deadEnd = taskEl("t1", ["f1"]);
			const proc = makeProcess("proc", [startEl("s"), deadEnd], [flow("f1", "s", "t1")]);
			const report = optimize(makeDefs(proc), { categories: ["flow"] });
			expect(report.findings.every((f) => f.category === "flow")).toBe(true);
		});

		it("feelLengthThreshold: 200 suppresses complex-condition at default length", () => {
			const gw = gwEl("gw1", ["f0"], ["f1", "f2"]);
			const expr = "= someVar > anotherLongVar and thirdVar != fourthVar or fifthVar <= sixth";
			expect(expr.length).toBeLessThan(200);
			const proc = makeProcess(
				"proc",
				[startEl("s"), gw, endEl("e", ["f1"]), endEl("e2", ["f2"])],
				[flow("f0", "s", "gw1"), flow("f1", "gw1", "e", expr), flow("f2", "gw1", "e2", "= true")],
			);
			// Default threshold (80) would flag; 200 should not flag for length
			const report = optimize(makeDefs(proc), {
				feelLengthThreshold: 200,
				feelOperatorThreshold: 50,
				feelVariableThreshold: 50,
				feelNestingThreshold: 50,
			});
			expect(report.findings.some((f) => f.id === "feel/complex-condition")).toBe(false);
		});

		it("reuseThreshold: 3 requires 3+ tasks before flagging", () => {
			const ext = [taskDefExt("my-connector"), headerExt([{ key: "apiKey", value: "123" }])];
			// Only 2 identical tasks, but threshold is 3
			const t1 = taskEl("t1", ["f1"], ["f2"], ext);
			const t2 = taskEl("t2", ["f3"], ["f4"], ext);
			const proc = makeProcess(
				"proc",
				[startEl("s"), t1, t2, endEl("e")],
				[
					flow("f1", "s", "t1"),
					flow("f2", "t1", "e"),
					flow("f3", "s", "t2"),
					flow("f4", "t2", "e"),
				],
			);
			const report = optimize(makeDefs(proc), { reuseThreshold: 3 });
			expect(report.findings.some((f) => f.id === "task/reusable-group")).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Summary
	// -----------------------------------------------------------------------

	describe("summary", () => {
		it("summary.total equals findings.length", () => {
			const proc = makeProcess("proc", [startEl("s"), endEl("e", ["f1"])], [flow("f1", "s", "e")]);
			const report = optimize(makeDefs(proc));
			expect(report.summary.total).toBe(report.findings.length);
		});

		it("byCategory counts match per-category findings", () => {
			const deadEnd = taskEl("t1", ["f1"]);
			const proc = makeProcess("proc", [startEl("s"), deadEnd], [flow("f1", "s", "t1")]);
			const report = optimize(makeDefs(proc));
			for (const cat of ["feel", "flow", "task-reuse", "extract"] as const) {
				const expected = report.findings.filter((f) => f.category === cat).length;
				expect(report.summary.byCategory[cat]).toBe(expected);
			}
		});

		it("bySeverity counts match per-severity findings", () => {
			const proc = makeProcess("proc", [startEl("s"), endEl("e", ["f1"])], [flow("f1", "s", "e")]);
			const report = optimize(makeDefs(proc));
			for (const sev of ["info", "warning", "error"] as const) {
				const expected = report.findings.filter((f) => f.severity === sev).length;
				expect(report.summary.bySeverity[sev]).toBe(expected);
			}
		});
	});
});

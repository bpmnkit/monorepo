import { Bpmn } from "@bpmn-sdk/core"
import type { BpmnDefinitions, BpmnProcess } from "@bpmn-sdk/core"
import { describe, expect, it } from "vitest"
import { Engine } from "../src/engine.js"
import type { ProcessEvent } from "../src/types.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProcess(
	id: string,
	flowElements: BpmnProcess["flowElements"],
	sequenceFlows: BpmnProcess["sequenceFlows"] = [],
): BpmnProcess {
	return {
		id,
		isExecutable: true,
		extensionElements: [],
		flowElements,
		sequenceFlows,
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}
}

function makeDefs(processes: BpmnProcess[]): BpmnDefinitions {
	return {
		id: "Definitions_1",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes,
		diagrams: [],
	}
}

function node(
	type: BpmnProcess["flowElements"][number]["type"],
	id: string,
	incoming: string[] = [],
	outgoing: string[] = [],
	name?: string,
): BpmnProcess["flowElements"][number] {
	return {
		type,
		id,
		name,
		incoming,
		outgoing,
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
	} as BpmnProcess["flowElements"][number]
}

function flow(
	id: string,
	src: string,
	tgt: string,
	condition?: string,
): BpmnProcess["sequenceFlows"][number] {
	return {
		id,
		sourceRef: src,
		targetRef: tgt,
		conditionExpression: condition !== undefined ? { text: condition, attributes: {} } : undefined,
		extensionElements: [],
		unknownAttributes: {},
	}
}

function collectEvents(instance: ReturnType<Engine["start"]>): ProcessEvent[] {
	const events: ProcessEvent[] = []
	instance.onChange((e) => events.push(e))
	return events
}

/** Drain all pending microtasks by scheduling a macrotask. */
function settle(): Promise<void> {
	return new Promise<void>((r) => setTimeout(r, 0))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Engine", () => {
	it("throws if process not deployed", () => {
		const engine = new Engine()
		expect(() => engine.start("missing")).toThrow("not deployed")
	})

	it("getDeployedProcesses returns process ids", () => {
		const engine = new Engine()
		engine.deploy({ bpmn: makeDefs([makeProcess("p1", [])]) })
		engine.deploy({ bpmn: makeDefs([makeProcess("p2", [])]) })
		expect(engine.getDeployedProcesses().sort()).toEqual(["p1", "p2"])
	})

	describe("simple happy path", () => {
		it("start → task → end fires entering/entered/leaving/left + process:completed", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"proc",
						[
							node("startEvent", "s", [], ["f1"]),
							node("task", "t", ["f1"], ["f2"], "Do something"),
							node("endEvent", "e", ["f2"], []),
						],
						[flow("f1", "s", "t"), flow("f2", "t", "e")],
					),
				]),
			})

			const events: ProcessEvent[] = []
			const instance = engine.start("proc")
			instance.onChange((ev) => events.push(ev))
			await settle()

			expect(instance.state).toBe("completed")
			const types = events.map((e) => e.type)
			expect(types).toContain("element:entering")
			expect(types).toContain("element:left")
			expect(types).toContain("process:completed")
		})

		it("instance is completed after async run", async () => {
			const engine = new Engine()
			const process = makeProcess(
				"p",
				[
					node("startEvent", "s", [], ["f1"]),
					node("task", "t", ["f1"], ["f2"]),
					node("endEvent", "e", ["f2"], []),
				],
				[flow("f1", "s", "t"), flow("f2", "t", "e")],
			)
			engine.deploy({ bpmn: makeDefs([process]) })
			const instance = engine.start("p", { x: 1 })
			await settle()
			expect(instance.state).toBe("completed")
		})

		it("initial variables are in snapshot", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"p",
						[node("startEvent", "s", [], []), node("endEvent", "e", [], [])],
						[flow("f1", "s", "e")],
					),
				]),
			})
			const instance = engine.start("p", { amount: 42, name: "test" })
			await settle()
			expect(instance.variables_snapshot).toMatchObject({ amount: 42, name: "test" })
		})
	})

	describe("service task with job worker", () => {
		it("job worker is called and can complete with variables", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"p",
						[
							node("startEvent", "s", [], ["f1"]),
							{
								type: "serviceTask",
								id: "svc",
								incoming: ["f1"],
								outgoing: ["f2"],
								extensionElements: [
									{
										name: "zeebe:taskDefinition",
										attributes: { type: "my-worker" },
										children: [],
									},
								],
								unknownAttributes: {},
							},
							node("endEvent", "e", ["f2"], []),
						],
						[flow("f1", "s", "svc"), flow("f2", "svc", "e")],
					),
				]),
			})

			let workerCalled = false
			engine.registerJobWorker("my-worker", (job) => {
				workerCalled = true
				job.complete({ result: 99 })
			})

			const instance = engine.start("p", { input: 1 })
			// Job worker is synchronous here
			await settle()
			expect(workerCalled).toBe(true)
			expect(instance.state).toBe("completed")
			expect(instance.variables_snapshot).toMatchObject({ result: 99 })
		})

		it("job fail sets instance state to failed", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"p",
						[
							node("startEvent", "s", [], ["f1"]),
							{
								type: "serviceTask",
								id: "svc",
								incoming: ["f1"],
								outgoing: ["f2"],
								extensionElements: [
									{
										name: "zeebe:taskDefinition",
										attributes: { type: "failing-worker" },
										children: [],
									},
								],
								unknownAttributes: {},
							},
							node("endEvent", "e", ["f2"], []),
						],
						[flow("f1", "s", "svc"), flow("f2", "svc", "e")],
					),
				]),
			})

			engine.registerJobWorker("failing-worker", (job) => {
				job.fail("something went wrong")
			})

			const instance = engine.start("p")
			await settle()
			expect(instance.state).toBe("failed")
			expect(instance.error).toBe("something went wrong")
		})

		it("auto-completes service task with no matching worker (simulation mode)", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"p",
						[
							node("startEvent", "s", [], ["f1"]),
							{
								type: "serviceTask",
								id: "svc",
								incoming: ["f1"],
								outgoing: ["f2"],
								extensionElements: [],
								unknownAttributes: {},
							},
							node("endEvent", "e", ["f2"], []),
						],
						[flow("f1", "s", "svc"), flow("f2", "svc", "e")],
					),
				]),
			})
			const instance = engine.start("p")
			await settle()
			expect(instance.state).toBe("completed")
		})
	})

	describe("exclusive gateway", () => {
		function makeGatewayProcess(condition1: string, condition2: string): BpmnDefinitions {
			return makeDefs([
				makeProcess(
					"gw",
					[
						node("startEvent", "s", [], ["f0"]),
						node(
							"exclusiveGateway",
							"gw",
							["f0"],
							["f1", "f2"],
						) as BpmnProcess["flowElements"][number],
						node("endEvent", "e1", ["f1"], []),
						node("endEvent", "e2", ["f2"], []),
					],
					[
						flow("f0", "s", "gw"),
						flow("f1", "gw", "e1", condition1),
						flow("f2", "gw", "e2", condition2),
					],
				),
			])
		}

		it("takes the true branch", async () => {
			const engine = new Engine()
			engine.deploy({ bpmn: makeGatewayProcess("x > 5", "x <= 5") })
			const instance = engine.start("gw", { x: 10 })
			await settle()
			expect(instance.state).toBe("completed")
			expect(instance.activeElements).toEqual([])
		})

		it("takes the second branch when first is false", async () => {
			const engine = new Engine()
			engine.deploy({ bpmn: makeGatewayProcess("x > 5", "x <= 5") })
			const instance = engine.start("gw", { x: 3 })
			await settle()
			expect(instance.state).toBe("completed")
		})
	})

	describe("parallel gateway", () => {
		it("split and join completes process", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"par",
						[
							node("startEvent", "s", [], ["f0"]),
							{
								type: "parallelGateway",
								id: "split",
								incoming: ["f0"],
								outgoing: ["f1", "f2"],
								extensionElements: [],
								unknownAttributes: {},
							},
							node("task", "t1", ["f1"], ["f3"]),
							node("task", "t2", ["f2"], ["f4"]),
							{
								type: "parallelGateway",
								id: "join",
								incoming: ["f3", "f4"],
								outgoing: ["f5"],
								extensionElements: [],
								unknownAttributes: {},
							},
							node("endEvent", "e", ["f5"], []),
						],
						[
							flow("f0", "s", "split"),
							flow("f1", "split", "t1"),
							flow("f2", "split", "t2"),
							flow("f3", "t1", "join"),
							flow("f4", "t2", "join"),
							flow("f5", "join", "e"),
						],
					),
				]),
			})
			const instance = engine.start("par")
			await settle()
			expect(instance.state).toBe("completed")
		})
	})

	describe("terminate end event", () => {
		it("terminates the process immediately", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"term",
						[
							node("startEvent", "s", [], ["f1"]),
							{
								type: "endEvent",
								id: "e",
								incoming: ["f1"],
								outgoing: [],
								extensionElements: [],
								unknownAttributes: {},
								eventDefinitions: [{ type: "terminate" }],
							},
						],
						[flow("f1", "s", "e")],
					),
				]),
			})
			const instance = engine.start("term")
			await settle()
			expect(instance.state).toBe("completed")
		})
	})

	describe("cancel()", () => {
		it("sets state to terminated", () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([makeProcess("p", [node("startEvent", "s", [], [])], [])]),
			})
			const instance = engine.start("p")
			instance.cancel()
			expect(instance.state).toBe("terminated")
		})
	})

	describe("deploy from XML", () => {
		it("parses and runs SAMPLE_BPMN_XML (start → serviceTask → end) in simulation mode", async () => {
			const engine = new Engine()
			engine.deploy({ bpmn: Bpmn.parse(Bpmn.SAMPLE_XML) })

			expect(engine.getDeployedProcesses()).toContain("proc")

			const events: ProcessEvent[] = []
			const instance = engine.start("proc")
			instance.onChange((e) => events.push(e))

			// Service task has no zeebe:taskDefinition → auto-completes in simulation mode
			await settle()
			expect(instance.state).toBe("completed")
		})

		it("parses hand-written XML with a zeebe service task and runs a job worker", async () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="order-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="charge" name="Charge Customer">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="payment-worker"/>
        <zeebe:ioMapping>
          <zeebe:output source="charged" target="charged"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="charge"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="charge" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>`

			const engine = new Engine()
			engine.deploy({ bpmn: Bpmn.parse(xml) })

			let jobType = ""
			engine.registerJobWorker("payment-worker", (job) => {
				jobType = job.type
				job.complete({ charged: true })
			})

			const instance = engine.start("order-process", { amount: 50 })
			await settle()

			expect(instance.state).toBe("completed")
			expect(jobType).toBe("payment-worker")
			expect(instance.variables_snapshot).toMatchObject({ charged: true })
		})
	})

	describe("registerJobWorker unsubscribe", () => {
		it("worker no longer called after unsubscribe", async () => {
			const engine = new Engine()
			engine.deploy({
				bpmn: makeDefs([
					makeProcess(
						"p",
						[
							node("startEvent", "s", [], ["f1"]),
							{
								type: "serviceTask",
								id: "svc",
								incoming: ["f1"],
								outgoing: ["f2"],
								extensionElements: [
									{ name: "zeebe:taskDefinition", attributes: { type: "w" }, children: [] },
								],
								unknownAttributes: {},
							},
							node("endEvent", "e", ["f2"], []),
						],
						[flow("f1", "s", "svc"), flow("f2", "svc", "e")],
					),
				]),
			})

			let calls = 0
			const unsubscribe = engine.registerJobWorker("w", (job) => {
				calls++
				job.complete()
			})
			unsubscribe()

			// After unsubscribe, worker is gone — auto-complete applies
			engine.start("p")
			await settle()
			expect(calls).toBe(0)
		})
	})
})

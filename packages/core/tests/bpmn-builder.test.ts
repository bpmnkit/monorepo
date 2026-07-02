import { beforeEach, describe, expect, it } from "vitest"
import { Bpmn, resetIdCounter } from "../src/index.js"

/** Extracts the first process from BpmnDefinitions with a runtime assertion. */
function firstProcess(defs: ReturnType<ReturnType<typeof Bpmn.createProcess>["build"]>) {
	const p = defs.processes[0]
	expect(p).toBeDefined()
	return p as NonNullable<typeof p>
}

/** Asserts a value is defined and returns it with narrowed type. */
function defined<T>(value: T | undefined | null, msg?: string): T {
	expect(value, msg).toBeDefined()
	return value as T
}

describe("BpmnProcessBuilder", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	// -----------------------------------------------------------------------
	// Linear flow
	// -----------------------------------------------------------------------

	describe("linear flow", () => {
		it("creates a minimal start → end process", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc1")
					.name("Simple Process")
					.startEvent("start")
					.endEvent("end")
					.build(),
			)

			expect(process.id).toBe("proc1")
			expect(process.name).toBe("Simple Process")
			expect(process.isExecutable).toBe(true)
			expect(process.flowElements).toHaveLength(2)
			expect(process.sequenceFlows).toHaveLength(1)

			const flow = defined(process.sequenceFlows[0])
			expect(flow.sourceRef).toBe("start")
			expect(flow.targetRef).toBe("end")
		})

		it("auto-connects sequential elements", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc2")
					.startEvent("s")
					.serviceTask("t1", { taskType: "type-a" })
					.serviceTask("t2", { taskType: "type-b" })
					.endEvent("e")
					.build(),
			)

			expect(process.flowElements).toHaveLength(4)
			expect(process.sequenceFlows).toHaveLength(3)

			expect(process.sequenceFlows[0]?.sourceRef).toBe("s")
			expect(process.sequenceFlows[0]?.targetRef).toBe("t1")
			expect(process.sequenceFlows[1]?.sourceRef).toBe("t1")
			expect(process.sequenceFlows[1]?.targetRef).toBe("t2")
			expect(process.sequenceFlows[2]?.sourceRef).toBe("t2")
			expect(process.sequenceFlows[2]?.targetRef).toBe("e")
		})

		it("computes incoming/outgoing arrays from flows", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("t1", { taskType: "x" })
					.endEvent("e")
					.build(),
			)

			const start = defined(process.flowElements.find((el) => el.id === "s"))
			const task = defined(process.flowElements.find((el) => el.id === "t1"))
			const end = defined(process.flowElements.find((el) => el.id === "e"))

			expect(start.outgoing).toHaveLength(1)
			expect(start.incoming).toHaveLength(0)
			expect(task.incoming).toHaveLength(1)
			expect(task.outgoing).toHaveLength(1)
			expect(end.incoming).toHaveLength(1)
			expect(end.outgoing).toHaveLength(0)
		})

		it("sets process as executable by default", () => {
			const process = firstProcess(Bpmn.createProcess("proc").build())
			expect(process.isExecutable).toBe(true)
		})

		it("allows setting executable to false", () => {
			const process = firstProcess(Bpmn.createProcess("proc").executable(false).build())
			expect(process.isExecutable).toBe(false)
		})

		it("auto-generates start event ID when not provided", () => {
			const process = firstProcess(Bpmn.createProcess("proc").startEvent().endEvent().build())
			expect(process.flowElements).toHaveLength(2)
			expect(process.flowElements[0]?.id).toMatch(/^StartEvent_/)
		})
	})

	// -----------------------------------------------------------------------
	// Element types (validated)
	// -----------------------------------------------------------------------

	describe("element types — validated", () => {
		it("creates a service task with task definition", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.serviceTask("st1", {
						name: "My Service",
						taskType: "my-worker",
						retries: "5",
					})
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "st1"))
			expect(el.type).toBe("serviceTask")
			expect(el.name).toBe("My Service")

			const taskDef = defined(el.extensionElements.find((e) => e.name === "zeebe:taskDefinition"))
			expect(taskDef.attributes.type).toBe("my-worker")
			expect(taskDef.attributes.retries).toBe("5")
		})

		it("creates a service task with task headers", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.serviceTask("st1", {
						taskType: "worker",
						taskHeaders: { key1: "val1", key2: "val2" },
					})
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "st1"))
			const headerEl = defined(el.extensionElements.find((e) => e.name === "zeebe:taskHeaders"))
			expect(headerEl.children).toHaveLength(2)
			expect(headerEl.children[0]?.attributes.key).toBe("key1")
			expect(headerEl.children[0]?.attributes.value).toBe("val1")
		})

		it("creates a user task with form reference", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").userTask("ut1", { name: "Review", formId: "form-123" }).build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "ut1"))
			expect(el.type).toBe("userTask")
			expect(el.name).toBe("Review")

			const formDef = defined(el.extensionElements.find((e) => e.name === "zeebe:formDefinition"))
			expect(formDef.attributes.formId).toBe("form-123")
		})

		it("creates a zeebe user task with zeebeUserTask flag", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").userTask("ut2", { name: "Review", zeebeUserTask: true }).build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "ut2"))
			expect(el.type).toBe("userTask")
			const zeebeUserTaskEl = el.extensionElements.find((e) => e.name === "zeebe:userTask")
			expect(zeebeUserTaskEl).toBeDefined()
		})

		it("creates a zeebe user task with both zeebeUserTask flag and formId", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.userTask("ut3", { name: "Review", zeebeUserTask: true, formId: "form-456" })
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "ut3"))
			const zeebeUserTaskEl = el.extensionElements.find((e) => e.name === "zeebe:userTask")
			expect(zeebeUserTaskEl).toBeDefined()
			const formDef = defined(el.extensionElements.find((e) => e.name === "zeebe:formDefinition"))
			expect(formDef.attributes.formId).toBe("form-456")
			// zeebe:userTask should appear before zeebe:formDefinition
			const zeebeIdx = el.extensionElements.findIndex((e) => e.name === "zeebe:userTask")
			const formIdx = el.extensionElements.findIndex((e) => e.name === "zeebe:formDefinition")
			expect(zeebeIdx).toBeLessThan(formIdx)
		})

		it("creates a script task with FEEL expression", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.scriptTask("sc1", {
						name: "Compute",
						expression: "=x + 1",
						resultVariable: "result",
					})
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "sc1"))
			expect(el.type).toBe("scriptTask")
			expect(el.name).toBe("Compute")

			const script = defined(el.extensionElements.find((e) => e.name === "zeebe:script"))
			expect(script.attributes.expression).toBe("=x + 1")
			expect(script.attributes.resultVariable).toBe("result")
		})

		it("creates a call activity with called process", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.callActivity("ca1", {
						name: "Sub Flow",
						processId: "child-process",
					})
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "ca1"))
			expect(el.type).toBe("callActivity")
			expect(el.name).toBe("Sub Flow")

			const calledEl = defined(el.extensionElements.find((e) => e.name === "zeebe:calledElement"))
			expect(calledEl.attributes.processId).toBe("child-process")
		})

		it("creates intermediate throw events", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateThrowEvent("ite1", { name: "Signal" })
					.endEvent("e")
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "ite1"))
			expect(el.type).toBe("intermediateThrowEvent")
			expect(el.name).toBe("Signal")
		})

		it("creates intermediate catch events", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("ice1", { name: "Wait" })
					.endEvent("e")
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "ice1"))
			expect(el.type).toBe("intermediateCatchEvent")
			expect(el.name).toBe("Wait")
		})
	})

	// -----------------------------------------------------------------------
	// Element types (aspirational)
	// -----------------------------------------------------------------------

	describe("element types — aspirational", () => {
		it("creates a send task", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").sendTask("send1", { name: "Send Message" }).build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "send1"))
			expect(el.type).toBe("sendTask")
			expect(el.name).toBe("Send Message")
		})

		it("creates a receive task", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").receiveTask("recv1", { name: "Wait for Message" }).build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "recv1"))
			expect(el.type).toBe("receiveTask")
			expect(el.name).toBe("Wait for Message")
		})

		it("receiveTask with messageName emits root bpmn:message and sets messageRef on task", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.receiveTask("rt", { name: "Await ping", messageName: "PingMsg" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("PingMsg")

			const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
			if (el.type !== "receiveTask") throw new Error("expected receiveTask")
			expect(el.messageRef).toBe(rootMsg?.id)
		})

		it("sendTask with messageName emits root bpmn:message and sets messageRef on task", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.sendTask("st", { name: "Send ping", messageName: "PingMsg" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("PingMsg")

			const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "st"))
			if (el.type !== "sendTask") throw new Error("expected sendTask")
			expect(el.messageRef).toBe(rootMsg?.id)
		})

		it("receiveTask without messageName emits a bare task (no messageRef)", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.receiveTask("rt", { name: "Bare receive" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(0)
			const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
			if (el.type !== "receiveTask") throw new Error("expected receiveTask")
			expect(el.messageRef).toBeUndefined()
		})

		it("messageName is de-duplicated across receiveTask and message start event", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", { messageName: "SharedMsg" })
				.receiveTask("rt", { name: "Await", messageName: "SharedMsg" })
				.endEvent("e")
				.build()

			// Only one root message despite two usages
			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("SharedMsg")

			// Start event references the same root
			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
			if (start?.type === "startEvent") {
				const def = start.eventDefinitions[0]
				if (def?.type === "message") expect(def.messageRef).toBe(rootMsg?.id)
			}

			// Receive task also references the same root
			const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
			if (el.type !== "receiveTask") throw new Error("expected receiveTask")
			expect(el.messageRef).toBe(rootMsg?.id)
		})

		it("receiveTask messageName in a branch emits root message and sets messageRef", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("A", (b) =>
					b.receiveTask("rt", { name: "Wait", messageName: "BranchMsg" }).connectTo("e"),
				)
				.branch("B", (b) => b.endEvent("e2"))
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("BranchMsg")

			const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
			if (el.type !== "receiveTask") throw new Error("expected receiveTask")
			expect(el.messageRef).toBe(rootMsg?.id)
		})

		it("receiveTask with messageName inside subProcess emits root bpmn:message and sets messageRef", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.subProcess("sub", (b) => {
					b.startEvent("sub-s")
						.receiveTask("rt", { name: "Await ping", messageName: "SubMsg" })
						.endEvent("sub-e")
				})
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("SubMsg")

			const subProc = defs.processes[0]?.flowElements.find((n) => n.id === "sub")
			if (subProc?.type !== "subProcess") throw new Error("expected subProcess")
			const rt = subProc.flowElements.find((n) => n.id === "rt")
			if (rt?.type !== "receiveTask") throw new Error("expected receiveTask")
			expect(rt.messageRef).toBe(rootMsg?.id)
		})

		it("receiveTask round-trips messageRef through export → parse", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.receiveTask("rt", { name: "Await ping", messageName: "PingMsg" })
				.endEvent("e")
				.build()

			const xml = Bpmn.export(defs)
			const parsed = Bpmn.parse(xml)

			const el = defined(parsed.processes[0]?.flowElements.find((n) => n.id === "rt"))
			if (el.type !== "receiveTask") throw new Error("expected receiveTask")
			expect(el.messageRef).toBeDefined()
			// Must resolve to the root message ID, not raw name
			const rootMsg = parsed.messages.find((m) => m.name === "PingMsg")
			expect(rootMsg).toBeDefined()
			expect(el.messageRef).toBe(rootMsg?.id)
		})

		it("creates an abstract task with no extension elements", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").task("t1", { name: "Phase 1" }).build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "t1"))
			expect(el.type).toBe("task")
			expect(el.name).toBe("Phase 1")
			expect(el.extensionElements).toHaveLength(0)
		})

		it("creates an abstract task with no options", () => {
			const process = firstProcess(Bpmn.createProcess("proc").task("t2").build())

			const el = defined(process.flowElements.find((n) => n.id === "t2"))
			expect(el.type).toBe("task")
			expect(el.name).toBeUndefined()
			expect(el.extensionElements).toHaveLength(0)
		})

		it("abstract task round-trips through export → parse unchanged", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.task("t1", { name: "Phase 1" })
				.endEvent("e")
				.build()

			const xml = Bpmn.export(defs)
			const parsed = Bpmn.parse(xml)

			const el = defined(parsed.processes[0]?.flowElements.find((n) => n.id === "t1"))
			expect(el.type).toBe("task")
			expect(el.name).toBe("Phase 1")
			expect(el.extensionElements).toHaveLength(0)
			// No <zeebe:*> leakage
			expect(xml).not.toContain("zeebe:taskDefinition")
			expect(xml).toContain('<bpmn:task id="t1"')
		})

		it("abstract task works in a branch", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.exclusiveGateway("gw")
					.branch("A", (b) => b.task("t-a", { name: "Path A" }).connectTo("merge"))
					.branch("B", (b) => b.task("t-b", { name: "Path B" }).connectTo("merge"))
					.exclusiveGateway("merge")
					.build(),
			)

			const ta = defined(process.flowElements.find((n) => n.id === "t-a"))
			const tb = defined(process.flowElements.find((n) => n.id === "t-b"))
			expect(ta.type).toBe("task")
			expect(tb.type).toBe("task")
		})

		it("creates a business rule task with decision reference", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.businessRuleTask("brt1", {
						name: "Evaluate Rules",
						decisionId: "Decision_1",
						resultVariable: "outcome",
					})
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "brt1"))
			expect(el.type).toBe("businessRuleTask")
			expect(el.name).toBe("Evaluate Rules")

			const calledDecision = defined(
				el.extensionElements.find((e) => e.name === "zeebe:calledDecision"),
			)
			expect(calledDecision.attributes.decisionId).toBe("Decision_1")
			expect(calledDecision.attributes.resultVariable).toBe("outcome")
		})
	})

	// -----------------------------------------------------------------------
	// Exclusive gateway
	// -----------------------------------------------------------------------

	describe("exclusive gateway", () => {
		it("fan-out with 2 branches and merge", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw1", { name: "Decision" })
					.branch("Yes", (b) => b.serviceTask("t-yes", { taskType: "yes" }).connectTo("merge"))
					.branch("No", (b) => b.serviceTask("t-no", { taskType: "no" }).connectTo("merge"))
					.exclusiveGateway("merge", { name: "Merge" })
					.endEvent("e")
					.build(),
			)

			// 6 elements: s, gw1, t-yes, t-no, merge, e
			expect(process.flowElements).toHaveLength(6)

			// Flows: s→gw1, gw1→t-yes(Yes), gw1→t-no(No), t-yes→merge, t-no→merge, merge→e
			expect(process.sequenceFlows).toHaveLength(6)

			// Check branch labels
			const yesBranch = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw1" && f.targetRef === "t-yes"),
			)
			expect(yesBranch.name).toBe("Yes")

			const noBranch = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw1" && f.targetRef === "t-no"),
			)
			expect(noBranch.name).toBe("No")

			// Check merge incoming
			const mergeEl = defined(process.flowElements.find((n) => n.id === "merge"))
			expect(mergeEl.incoming).toHaveLength(2)

			// Check gateway outgoing
			const gwEl = defined(process.flowElements.find((n) => n.id === "gw1"))
			expect(gwEl.outgoing).toHaveLength(2)
		})

		it("fan-out with 9 branches (Handle PDP - Comment pattern)", () => {
			const branchNames = [
				"Next Phase",
				"Default",
				"Update Design",
				"Migrate Epic",
				"Pause/Continue",
				"Ask AI",
				"Update Progress",
				"Add to Channel",
				"Assignment Changed",
			]

			let builder = Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw9", { name: "Comment Action" })

			for (const [i, name] of branchNames.entries()) {
				builder = builder.branch(name, (b) =>
					b.callActivity(`ca-${i}`, { processId: `Process_${i}`, name }).connectTo("gw-merge"),
				)
			}

			const process = firstProcess(builder.exclusiveGateway("gw-merge").endEvent("e").build())

			// 2 gateways + 9 call activities + start + end = 13
			expect(process.flowElements).toHaveLength(13)

			// s→gw9 + 9*(gw9→ca + ca→merge) + merge→e = 1 + 18 + 1 = 20
			expect(process.sequenceFlows).toHaveLength(20)

			// Verify merge gateway has 9 incoming flows
			const mergeEl = defined(process.flowElements.find((n) => n.id === "gw-merge"))
			expect(mergeEl.incoming).toHaveLength(9)

			// Verify fork gateway has 9 outgoing flows
			const gwEl = defined(process.flowElements.find((n) => n.id === "gw9"))
			expect(gwEl.outgoing).toHaveLength(9)

			// Verify each branch label
			for (const name of branchNames) {
				const flow = process.sequenceFlows.find((f) => f.sourceRef === "gw9" && f.name === name)
				expect(flow, `Expected branch flow labeled "${name}"`).toBeDefined()
			}
		})

		it("supports nested exclusive gateways in branches", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw-outer")
					.branch("A", (b) => b.serviceTask("a1", { taskType: "a" }).connectTo("merge"))
					.branch("B", (b) => b.serviceTask("b1", { taskType: "b" }).connectTo("merge"))
					.exclusiveGateway("merge")
					.endEvent("e")
					.build(),
			)

			// Verify the structure is valid
			expect(process.flowElements).toHaveLength(6)
			expect(process.sequenceFlows).toHaveLength(6)
		})
	})

	// -----------------------------------------------------------------------
	// Parallel gateway
	// -----------------------------------------------------------------------

	describe("parallel gateway", () => {
		it("fork and join pattern", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.parallelGateway("fork")
					.branch("path-a", (b) => b.serviceTask("a", { taskType: "work-a" }).connectTo("join"))
					.branch("path-b", (b) => b.serviceTask("b", { taskType: "work-b" }).connectTo("join"))
					.parallelGateway("join")
					.endEvent("e")
					.build(),
			)

			expect(process.flowElements).toHaveLength(6)
			expect(process.sequenceFlows).toHaveLength(6)

			const joinEl = defined(process.flowElements.find((n) => n.id === "join"))
			expect(joinEl.type).toBe("parallelGateway")
			expect(joinEl.incoming).toHaveLength(2)

			const forkEl = defined(process.flowElements.find((n) => n.id === "fork"))
			expect(forkEl.type).toBe("parallelGateway")
			expect(forkEl.outgoing).toHaveLength(2)
		})

		it("three parallel branches", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.parallelGateway("fork")
					.branch("1", (b) => b.serviceTask("t1", { taskType: "w1" }).connectTo("join"))
					.branch("2", (b) => b.serviceTask("t2", { taskType: "w2" }).connectTo("join"))
					.branch("3", (b) => b.serviceTask("t3", { taskType: "w3" }).connectTo("join"))
					.parallelGateway("join")
					.endEvent("e")
					.build(),
			)

			expect(process.flowElements).toHaveLength(7) // s, fork, t1, t2, t3, join, e
			expect(process.sequenceFlows).toHaveLength(8) // s→fork, 3*(fork→t + t→join), join→e
		})

		it("auto-connects branch ends to join gateway without explicit connectTo()", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.parallelGateway("fork")
					.branch("1", (b) => b.serviceTask("t1", { taskType: "w1" }))
					.branch("2", (b) => b.serviceTask("t2", { taskType: "w2" }))
					.branch("3", (b) => b.serviceTask("t3", { taskType: "w3" }))
					.parallelGateway("join")
					.endEvent("e")
					.build(),
			)

			expect(process.flowElements).toHaveLength(7) // s, fork, t1, t2, t3, join, e
			expect(process.sequenceFlows).toHaveLength(8) // s→fork, 3*(fork→t + t→join), join→e

			const joinEl = defined(process.flowElements.find((n) => n.id === "join"))
			expect(joinEl.incoming).toHaveLength(3)

			const forkEl = defined(process.flowElements.find((n) => n.id === "fork"))
			expect(forkEl.outgoing).toHaveLength(3)
		})
	})

	// -----------------------------------------------------------------------
	// Aspirational gateway types
	// -----------------------------------------------------------------------

	describe("aspirational gateways", () => {
		it("creates an inclusive gateway", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.inclusiveGateway("ig1", { name: "Inclusive" })
					.branch("A", (b) => b.serviceTask("a", { taskType: "a" }).connectTo("ig-merge"))
					.branch("B", (b) => b.serviceTask("b", { taskType: "b" }).connectTo("ig-merge"))
					.inclusiveGateway("ig-merge")
					.endEvent("e")
					.build(),
			)

			const ig = defined(process.flowElements.find((n) => n.id === "ig1"))
			expect(ig.type).toBe("inclusiveGateway")
			expect(ig.name).toBe("Inclusive")
			expect(ig.outgoing).toHaveLength(2)
		})

		it("creates an event-based gateway", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.eventBasedGateway("ebg1", { name: "Wait For" })
					.branch("Timer", (b) =>
						b.intermediateCatchEvent("timer1", { name: "5min" }).connectTo("after"),
					)
					.branch("Message", (b) =>
						b.intermediateCatchEvent("msg1", { name: "Response" }).connectTo("after"),
					)
					.serviceTask("after", { taskType: "continue" })
					.endEvent("e")
					.build(),
			)

			const ebg = defined(process.flowElements.find((n) => n.id === "ebg1"))
			expect(ebg.type).toBe("eventBasedGateway")
			expect(ebg.name).toBe("Wait For")
			expect(ebg.outgoing).toHaveLength(2)
		})
	})

	// -----------------------------------------------------------------------
	// Loops via connectTo
	// -----------------------------------------------------------------------

	describe("loops via connectTo", () => {
		it("creates a loop back to an earlier element", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("check")
					.branch("retry", (b) =>
						b.serviceTask("retry-task", { taskType: "retry" }).connectTo("check"),
					)
					.branch("done", (b) => b.connectTo("end"))
					.endEvent("end")
					.build(),
			)

			// Verify loop flow: retry-task → check
			const loopFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "retry-task" && f.targetRef === "check",
			)
			expect(loopFlow).toBeDefined()

			// Check gateway has 2 incoming (from start and from retry)
			const checkEl = defined(process.flowElements.find((n) => n.id === "check"))
			expect(checkEl.incoming).toHaveLength(2)
		})

		it("creates a loop with intermediate processing", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("process", { taskType: "work" })
					.exclusiveGateway("validate")
					.branch("invalid", (b) => b.serviceTask("fix", { taskType: "fix" }).connectTo("process"))
					.branch("valid", (b) => b.connectTo("done"))
					.endEvent("done")
					.build(),
			)

			const loopFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "fix" && f.targetRef === "process",
			)
			expect(loopFlow).toBeDefined()

			// process should have 2 incoming: from start and from fix
			const processEl = defined(process.flowElements.find((n) => n.id === "process"))
			expect(processEl.incoming).toHaveLength(2)
		})
	})

	// -----------------------------------------------------------------------
	// Ad-hoc sub-process with multi-instance
	// -----------------------------------------------------------------------

	describe("ad-hoc sub-process", () => {
		it("creates an ad-hoc sub-process with nested content", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.adHocSubProcess(
						"adhoc1",
						(sub) => {
							sub
								.startEvent("sub-start")
								.serviceTask("sub-task", { taskType: "sub-work" })
								.endEvent("sub-end")
						},
						{ name: "Review Steps" },
					)
					.endEvent("e")
					.build(),
			)

			const adhoc = defined(process.flowElements.find((n) => n.id === "adhoc1"))
			expect(adhoc.type).toBe("adHocSubProcess")
			expect(adhoc.name).toBe("Review Steps")

			if (adhoc.type === "adHocSubProcess") {
				expect(adhoc.flowElements).toHaveLength(3)
				expect(adhoc.sequenceFlows).toHaveLength(2)

				const subTask = defined(adhoc.flowElements.find((n) => n.id === "sub-task"))
				expect(subTask.type).toBe("serviceTask")
			}
		})

		it("creates an ad-hoc sub-process with parallel multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.adHocSubProcess(
						"adhoc-mi",
						(sub) => {
							sub.serviceTask("inner", { taskType: "review" })
						},
						{
							name: "Review Bot",
							multiInstance: {
								isSequential: false,
								collection: "=items",
								elementVariable: "item",
							},
						},
					)
					.endEvent("e")
					.build(),
			)

			const adhoc = defined(process.flowElements.find((n) => n.id === "adhoc-mi"))
			expect(adhoc.type).toBe("adHocSubProcess")

			if (adhoc.type === "adHocSubProcess") {
				expect(adhoc.loopCharacteristics).toBeDefined()
				const loopExt = defined(adhoc.loopCharacteristics?.extensionElements[0])
				expect(loopExt.name).toBe("zeebe:loopCharacteristics")
				expect(loopExt.attributes.inputCollection).toBe("=items")
				expect(loopExt.attributes.inputElement).toBe("item")
			}
		})

		it("creates an ad-hoc sub-process with sequential multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.adHocSubProcess(
						"seq-mi",
						(sub) => {
							sub.serviceTask("work", { taskType: "process" })
						},
						{
							multiInstance: {
								isSequential: true,
								collection: "=records",
							},
						},
					)
					.build(),
			)

			const adhoc = defined(process.flowElements.find((n) => n.id === "seq-mi"))
			if (adhoc.type === "adHocSubProcess") {
				expect(adhoc.loopCharacteristics).toBeDefined()
			}
		})
	})

	// -----------------------------------------------------------------------
	// Sub-process (aspirational)
	// -----------------------------------------------------------------------

	describe("sub-process (aspirational)", () => {
		it("creates a sub-process with nested flow", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.subProcess(
						"sub1",
						(sub) => {
							sub.startEvent("sub-s").serviceTask("sub-t", { taskType: "inner" }).endEvent("sub-e")
						},
						{ name: "Embedded Sub" },
					)
					.endEvent("e")
					.build(),
			)

			const sub = defined(process.flowElements.find((n) => n.id === "sub1"))
			expect(sub.type).toBe("subProcess")
			expect(sub.name).toBe("Embedded Sub")

			if (sub.type === "subProcess") {
				expect(sub.flowElements).toHaveLength(3)
				expect(sub.sequenceFlows).toHaveLength(2)
			}
		})

		it("creates a sub-process with multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.subProcess(
						"sub-mi",
						(sub) => {
							sub.serviceTask("batch", { taskType: "batch-work" })
						},
						{
							multiInstance: {
								isSequential: false,
								collection: "=items",
								elementVariable: "item",
							},
						},
					)
					.build(),
			)

			const sub = defined(process.flowElements.find((n) => n.id === "sub-mi"))
			if (sub.type === "subProcess") {
				expect(sub.loopCharacteristics).toBeDefined()
			}
		})
	})

	// -----------------------------------------------------------------------
	// Event sub-process
	// -----------------------------------------------------------------------

	describe("event sub-process", () => {
		it("creates a subProcess with triggeredByEvent=true", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.eventSubProcess(
						"evtsub1",
						(sub) => {
							sub
								.startEvent("err-start", { name: "Error Start" })
								.serviceTask("handle-err", { taskType: "error-handler" })
								.endEvent("err-end")
						},
						{ name: "Error Handler" },
					)
					.endEvent("e")
					.build(),
			)

			const evtSub = defined(process.flowElements.find((n) => n.id === "evtsub1"))
			// (a) correct element type
			expect(evtSub.type).toBe("subProcess")
			expect(evtSub.name).toBe("Error Handler")

			if (evtSub.type === "subProcess") {
				// (a) canonical attribute
				expect(evtSub.triggeredByEvent).toBe(true)
				// internal flows preserved
				expect(evtSub.flowElements).toHaveLength(3)
				expect(evtSub.sequenceFlows).toHaveLength(2)
			}

			// (c) no illegal incoming/outgoing on the sub-process
			expect(evtSub.incoming).toHaveLength(0)
			expect(evtSub.outgoing).toHaveLength(0)

			// (c) no sequence flow references evtsub1 as source or target
			expect(
				process.sequenceFlows.every((f) => f.sourceRef !== "evtsub1" && f.targetRef !== "evtsub1"),
			).toBe(true)

			// cursor advances past event sub-process as if it wasn't there: s → e
			const sToE = process.sequenceFlows.find((f) => f.sourceRef === "s" && f.targetRef === "e")
			expect(sToE).toBeDefined()
		})

		it("emits <bpmn:subProcess triggeredByEvent='true'> in XML — no <bpmn:eventSubProcess>", () => {
			const xml = Bpmn.export(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.eventSubProcess("esp", (sub) => {
						sub.startEvent("t-start", { timerDuration: "PT1H" }).endEvent("t-end")
					})
					.endEvent("e")
					.build(),
			)

			// (a) canonical tag
			expect(xml).toContain('triggeredByEvent="true"')
			expect(xml).not.toContain("<bpmn:eventSubProcess")

			// (c) no flows to/from esp
			expect(xml).not.toContain('sourceRef="esp"')
			expect(xml).not.toContain('targetRef="esp"')

			// (c) no incoming/outgoing on sub-process
			// (the serializer emits incoming/outgoing only when the arrays are non-empty)
			// We verify by checking the flow count: s→e = 1 flow at process level
			const flowMatches = [...xml.matchAll(/<bpmn:sequenceFlow /g)]
			// internal: t-start→t-end = 1; process level: s→e = 1; total = 2
			expect(flowMatches).toHaveLength(2)
		})

		it("emits isInterrupting='false' on non-interrupting start event", () => {
			const xml = Bpmn.export(
				Bpmn.createProcess("proc")
					.eventSubProcess("esp", (sub) => {
						sub
							.startEvent("t-start", { timerDuration: "PT1H", isInterrupting: false })
							.endEvent("t-end")
					})
					.build(),
			)

			expect(xml).toContain('isInterrupting="false"')
		})

		it("omits isInterrupting attribute for interrupting (default) start event", () => {
			const xml = Bpmn.export(
				Bpmn.createProcess("proc")
					.eventSubProcess("esp", (sub) => {
						sub.startEvent("t-start", { timerDuration: "PT1H" }).endEvent("t-end")
					})
					.build(),
			)

			expect(xml).not.toContain("isInterrupting")
		})

		it("throws on duplicate ID in eventSubProcess", () => {
			expect(() =>
				Bpmn.createProcess("proc")
					.startEvent("s")
					.eventSubProcess("s", (sub) => {
						sub.startEvent("t-start").endEvent("t-end")
					})
					.build(),
			).toThrow('Duplicate element ID "s"')
		})

		it("does not consume openBranchEnds — next element drains them", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("a", (b) =>
						b.serviceTask("t1", { name: "T1", taskType: "t1" }).connectTo("merge"),
					)
					.branch("b", (b) =>
						b.serviceTask("t2", { name: "T2", taskType: "t2" }).connectTo("merge"),
					)
					.exclusiveGateway("merge")
					.eventSubProcess("esp", (sub) => {
						sub.startEvent("esp-start", { timerDuration: "PT1H" }).endEvent("esp-end")
					})
					.endEvent("e")
					.build(),
			)

			// both branch ends connect to "merge", not to "esp"
			const flows = process.sequenceFlows
			expect(flows.some((f) => f.targetRef === "merge" && f.sourceRef === "t1")).toBe(true)
			expect(flows.some((f) => f.targetRef === "merge" && f.sourceRef === "t2")).toBe(true)
			// merge connects to e (the element added after eventSubProcess)
			expect(flows.some((f) => f.sourceRef === "merge" && f.targetRef === "e")).toBe(true)
			// no flow references esp
			expect(flows.every((f) => f.sourceRef !== "esp" && f.targetRef !== "esp")).toBe(true)
		})
	})

	// -----------------------------------------------------------------------
	// Error cases
	// -----------------------------------------------------------------------

	describe("error handling", () => {
		it("throws on duplicate element IDs", () => {
			expect(() => Bpmn.createProcess("proc").startEvent("dup").endEvent("dup").build()).toThrow(
				'Duplicate element ID "dup"',
			)
		})

		it("throws when branch() called without a preceding gateway", () => {
			expect(() =>
				Bpmn.createProcess("proc")
					.startEvent("s")
					.branch("x", (b) => b.connectTo("end")),
			).toThrow("branch() must be called after a gateway")
		})
	})

	// -----------------------------------------------------------------------
	// Element naming
	// -----------------------------------------------------------------------

	describe("element naming", () => {
		it("sets names on elements via options", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s", { name: "Begin" })
					.serviceTask("t1", { name: "Do Work", taskType: "work" })
					.endEvent("e", { name: "Finish" })
					.build(),
			)

			expect(process.flowElements.find((n) => n.id === "s")?.name).toBe("Begin")
			expect(process.flowElements.find((n) => n.id === "t1")?.name).toBe("Do Work")
			expect(process.flowElements.find((n) => n.id === "e")?.name).toBe("Finish")
		})
	})

	// -----------------------------------------------------------------------
	// connectTo on process builder
	// -----------------------------------------------------------------------

	describe("connectTo on process builder", () => {
		it("creates a manual connection between elements", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("t1", { taskType: "first" })
					.connectTo("s")
					.build(),
			)

			// Should have a flow from t1 back to s
			const backFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "t1" && f.targetRef === "s",
			)
			expect(backFlow).toBeDefined()
		})
	})

	// -----------------------------------------------------------------------
	// Complex patterns
	// -----------------------------------------------------------------------

	describe("complex patterns", () => {
		it("parallel gateway with exclusive gateways inside branches", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.parallelGateway("pfork")
					.branch("path-a", (b) => b.serviceTask("a1", { taskType: "a" }).connectTo("pjoin"))
					.branch("path-b", (b) => b.serviceTask("b1", { taskType: "b" }).connectTo("pjoin"))
					.parallelGateway("pjoin")
					.endEvent("e")
					.build(),
			)

			expect(process.flowElements).toHaveLength(6)
			expect(process.sequenceFlows).toHaveLength(6)
		})

		it("multiple sequential gateways", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw1")
					.branch("A", (b) => b.serviceTask("a", { taskType: "a" }).connectTo("gw1-merge"))
					.branch("B", (b) => b.serviceTask("b", { taskType: "b" }).connectTo("gw1-merge"))
					.exclusiveGateway("gw1-merge")
					.exclusiveGateway("gw2")
					.branch("C", (b) => b.serviceTask("c", { taskType: "c" }).connectTo("gw2-merge"))
					.branch("D", (b) => b.serviceTask("d", { taskType: "d" }).connectTo("gw2-merge"))
					.exclusiveGateway("gw2-merge")
					.endEvent("e")
					.build(),
			)

			// s, gw1, a, b, gw1-merge, gw2, c, d, gw2-merge, e = 10
			expect(process.flowElements).toHaveLength(10)
		})

		it("branch with multiple tasks before connectTo", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("long-path", (b) =>
						b
							.serviceTask("t1", { taskType: "step1" })
							.serviceTask("t2", { taskType: "step2" })
							.serviceTask("t3", { taskType: "step3" })
							.connectTo("merge"),
					)
					.branch("short-path", (b) => b.serviceTask("t4", { taskType: "skip" }).connectTo("merge"))
					.exclusiveGateway("merge")
					.endEvent("e")
					.build(),
			)

			// Verify long path has sequential flows
			expect(
				process.sequenceFlows.find((f) => f.sourceRef === "t1" && f.targetRef === "t2"),
			).toBeDefined()
			expect(
				process.sequenceFlows.find((f) => f.sourceRef === "t2" && f.targetRef === "t3"),
			).toBeDefined()
			expect(
				process.sequenceFlows.find((f) => f.sourceRef === "t3" && f.targetRef === "merge"),
			).toBeDefined()
		})
	})

	// -----------------------------------------------------------------------
	// Branch condition & defaultFlow
	// -----------------------------------------------------------------------

	describe("branch condition and defaultFlow", () => {
		it("sets a FEEL condition on the branch sequence flow", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("yes", (b) =>
						b
							.condition("= amount > 1000")
							.serviceTask("approve", { taskType: "approve" })
							.connectTo("merge"),
					)
					.branch("no", (b) =>
						b.defaultFlow().serviceTask("reject", { taskType: "reject" }).connectTo("merge"),
					)
					.exclusiveGateway("merge")
					.endEvent("e")
					.build(),
			)

			const yesFlow = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw" && f.targetRef === "approve"),
			)
			expect(yesFlow.name).toBe("yes")
			expect(yesFlow.conditionExpression).toBeDefined()
			expect(yesFlow.conditionExpression?.text).toBe("= amount > 1000")
			expect(yesFlow.conditionExpression?.attributes["xsi:type"]).toBe("bpmn:tFormalExpression")

			const noFlow = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw" && f.targetRef === "reject"),
			)
			expect(noFlow.name).toBe("no")
			expect(noFlow.conditionExpression).toBeUndefined()

			// The gateway should have the default flow set
			const gw = defined(process.flowElements.find((n) => n.id === "gw"))
			if (gw.type === "exclusiveGateway") {
				expect(gw.default).toBe(noFlow.id)
			}
		})

		it("sets condition on a direct connectTo (no intermediate elements)", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("skip", (b) => b.condition("= skip").connectTo("end"))
					.branch("work", (b) =>
						b.defaultFlow().serviceTask("task", { taskType: "do" }).connectTo("end"),
					)
					.endEvent("end")
					.build(),
			)

			// Auto-join inserts gw_join before end
			const joinGw = process.flowElements.find((e) => e.id === "gw_join")
			expect(joinGw).toBeDefined()
			expect(joinGw?.type).toBe("exclusiveGateway")

			const skipFlow = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw" && f.targetRef === "gw_join"),
			)
			expect(skipFlow.conditionExpression).toBeDefined()
			expect(skipFlow.conditionExpression?.text).toBe("= skip")

			// Verify join → end flow exists
			const joinToEnd = process.sequenceFlows.find(
				(f) => f.sourceRef === "gw_join" && f.targetRef === "end",
			)
			expect(joinToEnd).toBeDefined()
		})
	})

	// -----------------------------------------------------------------------
	// branch() subProcess (mirrors ProcessBuilder.subProcess)
	// -----------------------------------------------------------------------

	describe("branch() subProcess", () => {
		it("creates a sub-process inside a branch with nested flow", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("bundled", (b) =>
						b
							.defaultFlow()
							.subProcess(
								"sub1",
								(sub) => {
									sub
										.startEvent("sub-s")
										.serviceTask("sub-t", { taskType: "inner" })
										.endEvent("sub-e")
								},
								{ name: "Embedded Sub" },
							)
							.connectTo("end"),
					)
					.endEvent("end")
					.build(),
			)

			const sub = defined(process.flowElements.find((n) => n.id === "sub1"))
			expect(sub.type).toBe("subProcess")
			expect(sub.name).toBe("Embedded Sub")

			if (sub.type === "subProcess") {
				expect(sub.flowElements).toHaveLength(3)
				expect(sub.sequenceFlows).toHaveLength(2)
			}

			const gw = defined(process.flowElements.find((n) => n.id === "gw"))
			if (gw.type === "exclusiveGateway") {
				const defaultFlow = defined(process.sequenceFlows.find((f) => f.id === gw.default))
				expect(defaultFlow.targetRef).toBe("sub1")
			}
		})

		it("creates a sub-process inside a branch with multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("bundled", (b) =>
						b
							.defaultFlow()
							.subProcess(
								"sub-mi",
								(sub) => {
									sub.serviceTask("batch", { taskType: "batch-work" })
								},
								{
									multiInstance: {
										isSequential: false,
										collection: "=items",
										elementVariable: "item",
									},
								},
							)
							.connectTo("end"),
					)
					.endEvent("end")
					.build(),
			)

			const sub = defined(process.flowElements.find((n) => n.id === "sub-mi"))
			if (sub.type === "subProcess") {
				expect(sub.loopCharacteristics).toBeDefined()
			}
		})
	})

	// -----------------------------------------------------------------------
	// addStartEvent & element()
	// -----------------------------------------------------------------------

	describe("addStartEvent and element()", () => {
		it("addStartEvent creates a disconnected start event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s1")
					.serviceTask("t1", { taskType: "a" })
					.endEvent("e1")
					.addStartEvent("s2")
					.serviceTask("t2", { taskType: "b" })
					.endEvent("e2")
					.build(),
			)

			expect(process.flowElements).toHaveLength(6)
			// s1→t1, t1→e1, s2→t2, t2→e2
			expect(process.sequenceFlows).toHaveLength(4)

			// s2 should NOT be connected to e1
			const crossFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "e1" && f.targetRef === "s2",
			)
			expect(crossFlow).toBeUndefined()
		})

		it("element() repositions the builder at an existing element", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("t1", { taskType: "a" })
					.endEvent("e1")
					.element("t1")
					.serviceTask("t2", { taskType: "b" })
					.endEvent("e2")
					.build(),
			)

			// t1 should have 2 outgoing
			const t1 = defined(process.flowElements.find((n) => n.id === "t1"))
			expect(t1.outgoing).toHaveLength(2)

			const t1ToE1 = process.sequenceFlows.find((f) => f.sourceRef === "t1" && f.targetRef === "e1")
			expect(t1ToE1).toBeDefined()

			const t1ToT2 = process.sequenceFlows.find((f) => f.sourceRef === "t1" && f.targetRef === "t2")
			expect(t1ToT2).toBeDefined()
		})

		it("element() throws for non-existent IDs", () => {
			expect(() => Bpmn.createProcess("proc").startEvent("s").element("nonexistent")).toThrow(
				'Element "nonexistent" not found',
			)
		})
	})

	// -----------------------------------------------------------------------
	// Boundary events
	// -----------------------------------------------------------------------

	describe("boundary events", () => {
		it("creates a boundary event attached to a task", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("task1", { taskType: "work" })
					.endEvent("main-end")
					.boundaryEvent("boundary1", {
						attachedTo: "task1",
						errorCode: "ERR_001",
					})
					.serviceTask("error-handler", { taskType: "handle" })
					.endEvent("error-end")
					.build(),
			)

			const boundary = defined(process.flowElements.find((n) => n.id === "boundary1"))
			expect(boundary.type).toBe("boundaryEvent")
			if (boundary.type === "boundaryEvent") {
				expect(boundary.attachedToRef).toBe("task1")
				expect(boundary.eventDefinitions).toHaveLength(1)
				expect(boundary.eventDefinitions[0]?.type).toBe("error")
			}

			// boundary → error-handler flow exists
			const boundaryFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "boundary1" && f.targetRef === "error-handler",
			)
			expect(boundaryFlow).toBeDefined()

			// No flow from main-end to boundary (boundary is disconnected)
			const badFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "main-end" && f.targetRef === "boundary1",
			)
			expect(badFlow).toBeUndefined()
		})

		it("creates a non-interrupting timer boundary event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.serviceTask("task1", { taskType: "slow" })
					.boundaryEvent("timer-boundary", {
						attachedTo: "task1",
						cancelActivity: false,
						timerDuration: "PT1H",
					})
					.endEvent("timeout-end")
					.build(),
			)

			const boundary = defined(process.flowElements.find((n) => n.id === "timer-boundary"))
			if (boundary.type === "boundaryEvent") {
				expect(boundary.cancelActivity).toBe(false)
				expect(boundary.eventDefinitions).toHaveLength(1)
				expect(boundary.eventDefinitions[0]?.type).toBe("timer")
			}
		})
	})

	// -----------------------------------------------------------------------
	// Version tag
	// -----------------------------------------------------------------------

	describe("version tag", () => {
		it("sets a version tag on the process", () => {
			const process = firstProcess(Bpmn.createProcess("proc").versionTag("1.0.0").build())

			const versionExt = defined(
				process.extensionElements.find((e) => e.name === "zeebe:versionTag"),
			)
			expect(versionExt.attributes.value).toBe("1.0.0")
		})
	})

	describe("executionPlatformVersion", () => {
		it("defaults to 8.9.0", () => {
			const defs = Bpmn.createProcess("p1").startEvent("s").endEvent("e").build()
			expect(defs.unknownAttributes["modeler:executionPlatformVersion"]).toBe("8.9.0")
		})

		it("accepts a custom version", () => {
			const defs = Bpmn.createProcess("p1")
				.executionPlatformVersion("8.8.0")
				.startEvent("s")
				.endEvent("e")
				.build()
			expect(defs.unknownAttributes["modeler:executionPlatformVersion"]).toBe("8.8.0")
		})

		it("is chainable", () => {
			const builder = Bpmn.createProcess("p1")
			expect(builder.executionPlatformVersion("8.7.0")).toBe(builder)
		})
	})

	// -----------------------------------------------------------------------
	// Event definitions
	// -----------------------------------------------------------------------

	describe("event definitions", () => {
		it("creates a timer start event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("ts", { timerDuration: "PT5M" })
					.endEvent("e")
					.build(),
			)

			const start = defined(process.flowElements.find((n) => n.id === "ts"))
			if (start.type === "startEvent") {
				expect(start.eventDefinitions).toHaveLength(1)
				expect(start.eventDefinitions[0]?.type).toBe("timer")
			}
		})

		it("creates intermediate catch with timer", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("wait", { timerDuration: "PT1H" })
					.endEvent("e")
					.build(),
			)

			const ice = defined(process.flowElements.find((n) => n.id === "wait"))
			if (ice.type === "intermediateCatchEvent") {
				expect(ice.eventDefinitions).toHaveLength(1)
				expect(ice.eventDefinitions[0]?.type).toBe("timer")
			}
		})

		it("creates intermediate throw with message", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateThrowEvent("msg", { messageName: "notify" })
					.endEvent("e")
					.build(),
			)

			const ite = defined(process.flowElements.find((n) => n.id === "msg"))
			if (ite.type === "intermediateThrowEvent") {
				expect(ite.eventDefinitions).toHaveLength(1)
				expect(ite.eventDefinitions[0]?.type).toBe("message")
			}
		})
	})

	// -----------------------------------------------------------------------
	// build() returns BpmnDefinitions
	// -----------------------------------------------------------------------

	describe("build() output", () => {
		it("returns BpmnDefinitions wrapping the process", () => {
			const defs = Bpmn.createProcess("my-proc")
				.name("My Process")
				.startEvent("s")
				.endEvent("e")
				.build()

			expect(defs.id).toBe("Definitions_1")
			expect(defs.targetNamespace).toBe("http://bpmn.io/schema/bpmn")
			expect(defs.processes).toHaveLength(1)
			expect(defs.processes[0]?.id).toBe("my-proc")
			expect(defs.processes[0]?.name).toBe("My Process")
			expect(defs.namespaces.zeebe).toBe("http://camunda.org/schema/zeebe/1.0")
		})
	})

	// -----------------------------------------------------------------------
	// Modeler template attributes
	// -----------------------------------------------------------------------

	describe("modeler template attributes", () => {
		it("sets modeler template attributes on service task", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.serviceTask("st1", {
						taskType: "connector",
						modelerTemplate: "template-id",
						modelerTemplateVersion: "2",
						modelerTemplateIcon: "data:image/svg+xml;base64,abc",
					})
					.build(),
			)

			const el = defined(process.flowElements.find((n) => n.id === "st1"))
			expect(el.unknownAttributes["zeebe:modelerTemplate"]).toBe("template-id")
			expect(el.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("2")
			expect(el.unknownAttributes["zeebe:modelerTemplateIcon"]).toBe(
				"data:image/svg+xml;base64,abc",
			)
		})
	})

	// -----------------------------------------------------------------------
	// Ad-hoc sub-process with loop characteristics
	// -----------------------------------------------------------------------

	describe("ad-hoc sub-process with loop characteristics", () => {
		it("sets activeElementsCollection and loopCharacteristics", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.adHocSubProcess(
						"adhoc-lc",
						(sub) => {
							sub.serviceTask("inner", { taskType: "review" })
						},
						{
							activeElementsCollection: "=elements",
							loopCharacteristics: {
								inputCollection: "=items",
								inputElement: "item",
								outputCollection: "=results",
								outputElement: "result",
							},
						},
					)
					.build(),
			)

			const adhoc = defined(process.flowElements.find((n) => n.id === "adhoc-lc"))
			if (adhoc.type === "adHocSubProcess") {
				// Check activeElementsCollection via extension elements
				const adHocExt = defined(adhoc.extensionElements.find((e) => e.name === "zeebe:adHoc"))
				expect(adHocExt.attributes.activeElementsCollection).toBe("=elements")

				// Check loop characteristics
				expect(adhoc.loopCharacteristics).toBeDefined()
				const loopExt = defined(adhoc.loopCharacteristics?.extensionElements[0])
				expect(loopExt.attributes.inputCollection).toBe("=items")
				expect(loopExt.attributes.inputElement).toBe("item")
				expect(loopExt.attributes.outputCollection).toBe("=results")
				expect(loopExt.attributes.outputElement).toBe("result")
			}
		})
	})

	// -----------------------------------------------------------------------
	// Regression: timerDate / timeCycle preserved
	// -----------------------------------------------------------------------

	describe("timer date and cycle", () => {
		it("preserves timerDate on start event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("ts", { timerDate: "2026-01-01T00:00:00Z" })
					.endEvent("e")
					.build(),
			)

			const start = defined(process.flowElements.find((n) => n.id === "ts"))
			if (start.type === "startEvent") {
				expect(start.eventDefinitions).toHaveLength(1)
				const td = defined(start.eventDefinitions[0])
				expect(td.type).toBe("timer")
				if (td.type === "timer") {
					expect(td.timeDate).toBe("2026-01-01T00:00:00Z")
					expect(td.timeDuration).toBeUndefined()
				}
			}
		})

		it("preserves timerCycle on start event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("ts", { timerCycle: "R3/PT10M" })
					.endEvent("e")
					.build(),
			)

			const start = defined(process.flowElements.find((n) => n.id === "ts"))
			if (start.type === "startEvent") {
				const td = defined(start.eventDefinitions[0])
				if (td.type === "timer") {
					expect(td.timeCycle).toBe("R3/PT10M")
					expect(td.timeDuration).toBeUndefined()
				}
			}
		})

		it("preserves timerDate on intermediate catch event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("ice", { timerDate: "2026-06-01T12:00:00Z" })
					.endEvent("e")
					.build(),
			)

			const ice = defined(process.flowElements.find((n) => n.id === "ice"))
			if (ice.type === "intermediateCatchEvent") {
				expect(ice.eventDefinitions).toHaveLength(1)
				const td = defined(ice.eventDefinitions[0])
				expect(td.type).toBe("timer")
				if (td.type === "timer") {
					expect(td.timeDate).toBe("2026-06-01T12:00:00Z")
					expect(td.timeDuration).toBeUndefined()
				}
			}
		})

		it("preserves timerCycle on intermediate catch event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("ice", { timerCycle: "R5/PT30M" })
					.endEvent("e")
					.build(),
			)

			const ice = defined(process.flowElements.find((n) => n.id === "ice"))
			if (ice.type === "intermediateCatchEvent") {
				const td = defined(ice.eventDefinitions[0])
				expect(td.type).toBe("timer")
				if (td.type === "timer") {
					expect(td.timeCycle).toBe("R5/PT30M")
					expect(td.timeDuration).toBeUndefined()
				}
			}
		})

		it("preserves timerDate on boundary event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("task1", { taskType: "io.example:1" })
					.endEvent("e")
					.boundaryEvent("bd", {
						attachedTo: "task1",
						cancelActivity: false,
						timerDate: "2026-12-25T00:00:00Z",
					})
					.endEvent("e2")
					.build(),
			)

			const bd = defined(process.flowElements.find((n) => n.id === "bd"))
			if (bd.type === "boundaryEvent") {
				expect(bd.eventDefinitions).toHaveLength(1)
				const td = defined(bd.eventDefinitions[0])
				expect(td.type).toBe("timer")
				if (td.type === "timer") {
					expect(td.timeDate).toBe("2026-12-25T00:00:00Z")
					expect(td.timeDuration).toBeUndefined()
				}
			}
		})

		it("preserves timerCycle on boundary event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("task1", { taskType: "io.example:1" })
					.endEvent("e")
					.boundaryEvent("bd", {
						attachedTo: "task1",
						cancelActivity: false,
						timerCycle: "R/PT15M",
					})
					.endEvent("e2")
					.build(),
			)

			const bd = defined(process.flowElements.find((n) => n.id === "bd"))
			if (bd.type === "boundaryEvent") {
				const td = defined(bd.eventDefinitions[0])
				expect(td.type).toBe("timer")
				if (td.type === "timer") {
					expect(td.timeCycle).toBe("R/PT15M")
					expect(td.timeDuration).toBeUndefined()
				}
			}
		})
	})

	// -----------------------------------------------------------------------
	// Regression: event definition values stored
	// -----------------------------------------------------------------------

	describe("event definition values", () => {
		it("intermediateThrowEvent messageName emits root message and sets messageRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateThrowEvent("msg", { messageName: "order-placed" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("order-placed")

			const ite = defs.processes[0]?.flowElements.find((n) => n.id === "msg")
			if (ite?.type === "intermediateThrowEvent") {
				const def = ite.eventDefinitions[0]
				expect(def?.type).toBe("message")
				if (def?.type === "message") {
					expect(def.messageRef).toBe(rootMsg?.id)
				}
			}
		})

		it("intermediateCatchEvent signalName emits root signal and sets signalRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateCatchEvent("sig", { signalName: "data-ready" })
				.endEvent("e")
				.build()

			expect(defs.signals).toHaveLength(1)
			const rootSig = defs.signals[0]
			expect(rootSig?.name).toBe("data-ready")

			const ice = defs.processes[0]?.flowElements.find((n) => n.id === "sig")
			if (ice?.type === "intermediateCatchEvent") {
				const def = ice.eventDefinitions[0]
				expect(def?.type).toBe("signal")
				if (def?.type === "signal") {
					expect(def.signalRef).toBe(rootSig?.id)
				}
			}
		})

		it("intermediateThrowEvent escalationCode emits root escalation and sets escalationRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateThrowEvent("esc", { escalationCode: "ESC_001" })
				.endEvent("e")
				.build()

			expect(defs.escalations).toHaveLength(1)
			const rootEsc = defs.escalations[0]
			expect(rootEsc?.escalationCode).toBe("ESC_001")

			const ite = defs.processes[0]?.flowElements.find((n) => n.id === "esc")
			if (ite?.type === "intermediateThrowEvent") {
				const def = ite.eventDefinitions[0]
				expect(def?.type).toBe("escalation")
				if (def?.type === "escalation") {
					expect(def.escalationRef).toBe(rootEsc?.id)
				}
			}
		})
	})

	// -----------------------------------------------------------------------
	// Event ref root declarations
	// -----------------------------------------------------------------------

	describe("event ref root declarations", () => {
		it("intermediateThrowEvent signalName emits root signal and sets signalRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateThrowEvent("throw", { signalName: "OrderShipped" })
				.endEvent("e")
				.build()

			expect(defs.signals).toHaveLength(1)
			const rootSig = defs.signals[0]
			expect(rootSig?.name).toBe("OrderShipped")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "throw")
			if (ev?.type === "intermediateThrowEvent") {
				const def = ev.eventDefinitions[0]
				expect(def?.type).toBe("signal")
				if (def?.type === "signal") expect(def.signalRef).toBe(rootSig?.id)
			}
		})

		it("intermediateCatchEvent messageName emits root message and sets messageRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateCatchEvent("catch", { messageName: "PaymentConfirmed" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("PaymentConfirmed")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "catch")
			if (ev?.type === "intermediateCatchEvent") {
				const def = ev.eventDefinitions[0]
				expect(def?.type).toBe("message")
				if (def?.type === "message") expect(def.messageRef).toBe(rootMsg?.id)
			}
		})

		it("boundaryEvent signalName emits root signal and sets signalRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.serviceTask("task", { name: "T", taskType: "t" })
				.boundaryEvent("bnd", { attachedTo: "task", signalName: "Cancelled" })
				.endEvent("e")
				.build()

			expect(defs.signals).toHaveLength(1)
			const rootSig = defs.signals[0]
			expect(rootSig?.name).toBe("Cancelled")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
			if (ev?.type === "boundaryEvent") {
				const def = ev.eventDefinitions[0]
				expect(def?.type).toBe("signal")
				if (def?.type === "signal") expect(def.signalRef).toBe(rootSig?.id)
			}
		})

		it("boundaryEvent messageName emits root message and sets messageRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.serviceTask("task", { name: "T", taskType: "t" })
				.boundaryEvent("bnd", { attachedTo: "task", messageName: "Retry" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]
			expect(rootMsg?.name).toBe("Retry")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
			if (ev?.type === "boundaryEvent") {
				const def = ev.eventDefinitions[0]
				expect(def?.type).toBe("message")
				if (def?.type === "message") expect(def.messageRef).toBe(rootMsg?.id)
			}
		})

		it("boundaryEvent errorRef emits root error and sets errorRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.serviceTask("task", { name: "T", taskType: "t" })
				.boundaryEvent("bnd", { attachedTo: "task", errorRef: "MyError" })
				.endEvent("e")
				.build()

			expect(defs.errors).toHaveLength(1)
			const rootErr = defs.errors[0]
			expect(rootErr?.name).toBe("MyError")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
			if (ev?.type === "boundaryEvent") {
				const def = ev.eventDefinitions[0]
				expect(def?.type).toBe("error")
				if (def?.type === "error") expect(def.errorRef).toBe(rootErr?.id)
			}
		})

		it("de-duplicates signals: two events with same signalName share one root", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateThrowEvent("t1", { signalName: "Shared" })
				.intermediateThrowEvent("t2", { signalName: "Shared" })
				.endEvent("e")
				.build()

			expect(defs.signals).toHaveLength(1)
			const rootSig = defs.signals[0]

			const t1 = defs.processes[0]?.flowElements.find((n) => n.id === "t1")
			const t2 = defs.processes[0]?.flowElements.find((n) => n.id === "t2")
			if (t1?.type === "intermediateThrowEvent" && t2?.type === "intermediateThrowEvent") {
				const def1 = t1.eventDefinitions[0]
				const def2 = t2.eventDefinitions[0]
				expect(def1?.type).toBe("signal")
				expect(def2?.type).toBe("signal")
				if (def1?.type === "signal" && def2?.type === "signal") {
					expect(def1.signalRef).toBe(rootSig?.id)
					expect(def2.signalRef).toBe(rootSig?.id)
				}
			}
		})

		it("de-duplicates messages: two events with same messageName share one root", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateCatchEvent("c1", { messageName: "Shared" })
				.intermediateCatchEvent("c2", { messageName: "Shared" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const rootMsg = defs.messages[0]

			const c1 = defs.processes[0]?.flowElements.find((n) => n.id === "c1")
			const c2 = defs.processes[0]?.flowElements.find((n) => n.id === "c2")
			if (c1?.type === "intermediateCatchEvent" && c2?.type === "intermediateCatchEvent") {
				const def1 = c1.eventDefinitions[0]
				const def2 = c2.eventDefinitions[0]
				expect(def1?.type).toBe("message")
				expect(def2?.type).toBe("message")
				if (def1?.type === "message" && def2?.type === "message") {
					expect(def1.messageRef).toBe(rootMsg?.id)
					expect(def2.messageRef).toBe(rootMsg?.id)
				}
			}
		})

		it("de-duplicates escalations: two events with same escalationCode share one root", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateThrowEvent("t1", { escalationCode: "ESC_1" })
				.intermediateThrowEvent("t2", { escalationCode: "ESC_1" })
				.endEvent("e")
				.build()

			expect(defs.escalations).toHaveLength(1)
			const rootEsc = defs.escalations[0]

			const t1 = defs.processes[0]?.flowElements.find((n) => n.id === "t1")
			const t2 = defs.processes[0]?.flowElements.find((n) => n.id === "t2")
			if (t1?.type === "intermediateThrowEvent" && t2?.type === "intermediateThrowEvent") {
				const def1 = t1.eventDefinitions[0]
				const def2 = t2.eventDefinitions[0]
				expect(def1?.type).toBe("escalation")
				expect(def2?.type).toBe("escalation")
				if (def1?.type === "escalation" && def2?.type === "escalation") {
					expect(def1.escalationRef).toBe(rootEsc?.id)
					expect(def2.escalationRef).toBe(rootEsc?.id)
				}
			}
		})

		it("no ref points at raw name string — all refs resolve to a declared root ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.intermediateThrowEvent("sig-throw", { signalName: "Sig1" })
				.intermediateCatchEvent("msg-catch", { messageName: "Msg1" })
				.intermediateThrowEvent("esc-throw", { escalationCode: "ESC_1" })
				.endEvent("e")
				.build()

			const allRootIds = new Set([
				...defs.signals.map((s) => s.id),
				...defs.messages.map((m) => m.id),
				...defs.escalations.map((e) => e.id),
				...defs.errors.map((e) => e.id),
			])

			for (const el of defs.processes[0]?.flowElements ?? []) {
				const evDefs =
					el.type === "intermediateThrowEvent" ||
					el.type === "intermediateCatchEvent" ||
					el.type === "boundaryEvent"
						? el.eventDefinitions
						: []
				for (const def of evDefs) {
					if (def.type === "signal" && def.signalRef) {
						expect(allRootIds.has(def.signalRef)).toBe(true)
					}
					if (def.type === "message" && def.messageRef) {
						expect(allRootIds.has(def.messageRef)).toBe(true)
					}
					if (def.type === "escalation" && def.escalationRef) {
						expect(allRootIds.has(def.escalationRef)).toBe(true)
					}
					if (def.type === "error" && def.errorRef) {
						expect(allRootIds.has(def.errorRef)).toBe(true)
					}
				}
			}
		})

		it("existing working case unchanged: messageName on startEvent emits root message", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", { messageName: "webhook-trigger" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			expect(defs.messages[0]?.name).toBe("webhook-trigger")

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
			if (start?.type === "startEvent") {
				const def = start.eventDefinitions[0]
				if (def?.type === "message") {
					expect(def.messageRef).toBe(defs.messages[0]?.id)
				}
			}
		})

		it("existing working case unchanged: errorCode on boundaryEvent emits root error", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.serviceTask("task", { name: "T", taskType: "t" })
				.boundaryEvent("bnd", { attachedTo: "task", errorCode: "BOOM" })
				.endEvent("e")
				.build()

			expect(defs.errors).toHaveLength(1)
			expect(defs.errors[0]?.errorCode).toBe("BOOM")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
			if (ev?.type === "boundaryEvent") {
				const def = ev.eventDefinitions[0]
				if (def?.type === "error") {
					expect(def.errorRef).toBe(defs.errors[0]?.id)
				}
			}
		})
	})

	describe("BranchBuilder event ref root declarations", () => {
		it("branch intermediateThrowEvent signalName emits root signal and sets signalRef to its ID", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("yes", (b) =>
					b.intermediateThrowEvent("throw", { signalName: "BranchSignal" }).connectTo("end"),
				)
				.branch("no", (b) => b.connectTo("end"))
				.exclusiveGateway("end")
				.endEvent("e")
				.build()

			expect(defs.signals).toHaveLength(1)
			const rootSig = defs.signals[0]
			expect(rootSig?.name).toBe("BranchSignal")

			const ev = defs.processes[0]?.flowElements.find((n) => n.id === "throw")
			if (ev?.type === "intermediateThrowEvent") {
				const def = ev.eventDefinitions[0]
				expect(def?.type).toBe("signal")
				if (def?.type === "signal") expect(def.signalRef).toBe(rootSig?.id)
			}
		})

		it("branch escalationCode and process-level escalationCode deduplicate to one root", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("yes", (b) =>
					b.intermediateThrowEvent("branch-esc", { escalationCode: "SHARED" }).connectTo("end"),
				)
				.branch("no", (b) => b.connectTo("end"))
				.exclusiveGateway("end")
				.intermediateThrowEvent("proc-esc", { escalationCode: "SHARED" })
				.endEvent("e")
				.build()

			expect(defs.escalations).toHaveLength(1)
			const rootEsc = defs.escalations[0]
			expect(rootEsc?.escalationCode).toBe("SHARED")

			const branchEv = defs.processes[0]?.flowElements.find((n) => n.id === "branch-esc")
			const procEv = defs.processes[0]?.flowElements.find((n) => n.id === "proc-esc")
			if (
				branchEv?.type === "intermediateThrowEvent" &&
				procEv?.type === "intermediateThrowEvent"
			) {
				const def1 = branchEv.eventDefinitions[0]
				const def2 = procEv.eventDefinitions[0]
				expect(def1?.type).toBe("escalation")
				expect(def2?.type).toBe("escalation")
				if (def1?.type === "escalation" && def2?.type === "escalation") {
					expect(def1.escalationRef).toBe(rootEsc?.id)
					expect(def2.escalationRef).toBe(rootEsc?.id)
				}
			}
		})
	})

	// -----------------------------------------------------------------------
	// Regression: end event event definitions
	// -----------------------------------------------------------------------

	describe("end event event definitions", () => {
		it("creates an error end event with errorCode", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.endEvent("e", { errorCode: "BOOM" })
				.build()

			const process = firstProcess(defs)
			const end = defined(process.flowElements.find((n) => n.id === "e"))
			expect(end.type).toBe("endEvent")
			if (end.type === "endEvent") {
				expect(end.eventDefinitions).toHaveLength(1)
				expect(end.eventDefinitions[0]?.type).toBe("error")
			}
			// root bpmn:error element must be emitted
			expect(defs.errors).toHaveLength(1)
			expect(defs.errors[0]?.errorCode).toBe("BOOM")
		})

		it("creates a message end event with messageName", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.endEvent("e", { messageName: "order-failed" })
					.build(),
			)

			const end = defined(process.flowElements.find((n) => n.id === "e"))
			if (end.type === "endEvent") {
				expect(end.eventDefinitions).toHaveLength(1)
				expect(end.eventDefinitions[0]?.type).toBe("message")
			}
		})

		it("creates a signal end event with signalName", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").startEvent("s").endEvent("e", { signalName: "abort" }).build(),
			)

			const end = defined(process.flowElements.find((n) => n.id === "e"))
			if (end.type === "endEvent") {
				expect(end.eventDefinitions).toHaveLength(1)
				expect(end.eventDefinitions[0]?.type).toBe("signal")
			}
		})

		it("creates an escalation end event with escalationCode", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.endEvent("e", { escalationCode: "ESC_001" })
					.build(),
			)

			const end = defined(process.flowElements.find((n) => n.id === "e"))
			if (end.type === "endEvent") {
				expect(end.eventDefinitions).toHaveLength(1)
				expect(end.eventDefinitions[0]?.type).toBe("escalation")
			}
		})

		it("end event with no event options remains a none end event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").startEvent("s").endEvent("e", { name: "Done" }).build(),
			)

			const end = defined(process.flowElements.find((n) => n.id === "e"))
			if (end.type === "endEvent") {
				expect(end.eventDefinitions).toHaveLength(0)
			}
		})
	})

	// -----------------------------------------------------------------------
	// Regression: duplicate ID in branch
	// -----------------------------------------------------------------------

	describe("duplicate ID in branch", () => {
		it("throws when branch element duplicates an existing process element", () => {
			expect(() =>
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("dup", { taskType: "work" })
					.exclusiveGateway("gw")
					.branch("a", (b) => b.serviceTask("dup", { taskType: "other" }).connectTo("merge"))
					.exclusiveGateway("merge")
					.endEvent("e")
					.build(),
			).toThrow('Duplicate element ID "dup"')
		})
	})

	// -----------------------------------------------------------------------
	// Auto-layout
	// -----------------------------------------------------------------------

	describe("withAutoLayout", () => {
		it("produces empty diagrams by default", () => {
			const defs = Bpmn.createProcess("proc1").startEvent("s").endEvent("e").build()
			expect(defs.diagrams).toHaveLength(0)
		})

		it("produces DI shapes and edges for a linear flow", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.serviceTask("t", { name: "Task", taskType: "job" })
				.endEvent("e")
				.build()

			expect(defs.diagrams).toHaveLength(1)
			const diagram = defined(defs.diagrams[0])
			expect(diagram.plane.bpmnElement).toBe("proc1")

			// 3 elements → 3 shapes
			expect(diagram.plane.shapes).toHaveLength(3)
			const shapeElements = diagram.plane.shapes.map((s) => s.bpmnElement)
			expect(shapeElements).toContain("s")
			expect(shapeElements).toContain("t")
			expect(shapeElements).toContain("e")

			// All shapes have valid bounds
			for (const shape of diagram.plane.shapes) {
				expect(shape.bounds.width).toBeGreaterThan(0)
				expect(shape.bounds.height).toBeGreaterThan(0)
			}

			// 2 sequence flows → 2 edges
			expect(diagram.plane.edges).toHaveLength(2)
			for (const edge of diagram.plane.edges) {
				expect(edge.waypoints.length).toBeGreaterThanOrEqual(2)
			}
		})

		it("produces DI for gateway branches", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("a", (b) => b.serviceTask("t1", { name: "A", taskType: "a" }))
				.branch("b", (b) => b.serviceTask("t2", { name: "B", taskType: "b" }))
				.exclusiveGateway("merge")
				.endEvent("e")
				.build()

			const diagram = defined(defs.diagrams[0])
			// s, gw, t1, t2, merge, e = 6 shapes
			expect(diagram.plane.shapes.length).toBeGreaterThanOrEqual(6)
			expect(diagram.plane.edges.length).toBeGreaterThanOrEqual(4)
		})

		it("survives roundtrip: export → parse preserves DI", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.serviceTask("t", { name: "Task", taskType: "job" })
				.endEvent("e")
				.build()

			const xml = Bpmn.export(defs)
			const parsed = Bpmn.parse(xml)

			expect(parsed.diagrams).toHaveLength(1)
			const diagram = defined(parsed.diagrams[0])
			expect(diagram.plane.shapes).toHaveLength(3)
			expect(diagram.plane.edges).toHaveLength(2)
		})

		it("positions survive full export → parse → export round-trip", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.serviceTask("t1", { name: "First", taskType: "job" })
				.exclusiveGateway("gw")
				.branch("a", (b) => b.serviceTask("t2", { name: "A", taskType: "a" }))
				.branch("b", (b) => b.serviceTask("t3", { name: "B", taskType: "b" }))
				.exclusiveGateway("merge")
				.endEvent("e")
				.build()

			// First cycle: export → parse
			const xml1 = Bpmn.export(defs)
			const parsed1 = Bpmn.parse(xml1)

			// Second cycle: re-export → re-parse
			const xml2 = Bpmn.export(parsed1)
			const parsed2 = Bpmn.parse(xml2)

			const diag1 = defined(parsed1.diagrams[0])
			const diag2 = defined(parsed2.diagrams[0])

			// Same number of shapes and edges
			expect(diag2.plane.shapes).toHaveLength(diag1.plane.shapes.length)
			expect(diag2.plane.edges).toHaveLength(diag1.plane.edges.length)

			// Shape bounds are identical across cycles
			const sortedShapes1 = [...diag1.plane.shapes].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			)
			const sortedShapes2 = [...diag2.plane.shapes].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			)
			for (let i = 0; i < sortedShapes1.length; i++) {
				expect(sortedShapes2[i]?.bpmnElement).toBe(sortedShapes1[i]?.bpmnElement)
				expect(sortedShapes2[i]?.bounds).toEqual(sortedShapes1[i]?.bounds)
			}

			// Edge waypoints are identical across cycles
			const sortedEdges1 = [...diag1.plane.edges].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			)
			const sortedEdges2 = [...diag2.plane.edges].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			)
			for (let i = 0; i < sortedEdges1.length; i++) {
				expect(sortedEdges2[i]?.bpmnElement).toBe(sortedEdges1[i]?.bpmnElement)
				expect(sortedEdges2[i]?.waypoints).toEqual(sortedEdges1[i]?.waypoints)
			}

			// XML output is stable (idempotent serialization)
			expect(xml2).toBe(xml1)
		})
	})

	// -----------------------------------------------------------------------
	// Message start event with root bpmn:message
	// -----------------------------------------------------------------------

	describe("message start event", () => {
		it("creates a root bpmn:message element when messageName is provided on start event", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", { name: "Webhook", messageName: "webhook-trigger" })
				.endEvent("e")
				.build()

			expect(defs.messages).toHaveLength(1)
			const msg = defs.messages[0]
			expect(msg).toBeDefined()
			expect(msg?.name).toBe("webhook-trigger")

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
			expect(start).toBeDefined()
			if (start?.type === "startEvent") {
				expect(start.eventDefinitions).toHaveLength(1)
				const msgDef = start.eventDefinitions[0]
				expect(msgDef?.type).toBe("message")
				if (msgDef?.type === "message") {
					expect(msgDef.messageRef).toBe(msg?.id)
				}
			}
		})

		it("supports zeebe:properties on start events", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", {
					name: "Trigger",
					messageName: "wh-trigger",
					zeebeProperties: [
						{ name: "inbound.type", value: "io.camunda:webhook:1" },
						{ name: "inbound.method", value: "any" },
					],
				})
				.endEvent("e")
				.build()

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
			expect(start).toBeDefined()
			const propsExt = start?.extensionElements.find((e) => e.name === "zeebe:properties")
			expect(propsExt).toBeDefined()
			expect(propsExt?.children).toHaveLength(2)
			expect(propsExt?.children[0]?.attributes.name).toBe("inbound.type")
			expect(propsExt?.children[0]?.attributes.value).toBe("io.camunda:webhook:1")
		})

		it("supports modeler template attributes on start events", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", {
					name: "Trigger",
					modelerTemplate: "io.camunda.connectors.webhook.v1",
					modelerTemplateVersion: "13",
				})
				.endEvent("e")
				.build()

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
			expect(start).toBeDefined()
			expect(start?.unknownAttributes["zeebe:modelerTemplate"]).toBe(
				"io.camunda.connectors.webhook.v1",
			)
			expect(start?.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("13")
		})
	})

	// -----------------------------------------------------------------------
	// Enhanced ad-hoc sub-process (agentic AI pattern)
	// -----------------------------------------------------------------------

	describe("ad-hoc sub-process (agentic AI)", () => {
		it("creates an ad-hoc sub-process with taskDefinition, ioMapping, taskHeaders", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.adHocSubProcess(
					"agent",
					(b) => {
						b.serviceTask("tool1", { name: "Tool 1", taskType: "http:1" })
						b.serviceTask("tool2", { name: "Tool 2", taskType: "slack:1" })
					},
					{
						name: "AI Agent",
						taskDefinition: { type: "io.camunda.agenticai:aiagent-job-worker:1", retries: "3" },
						ioMapping: {
							inputs: [
								{ source: "bedrock", target: "provider.type" },
								{ source: "us-east-1", target: "provider.bedrock.region" },
							],
							outputs: [{ source: "=agent", target: "agent" }],
						},
						taskHeaders: {
							elementTemplateVersion: "5",
							elementTemplateId: "io.camunda.connectors.agenticai.v1",
						},
						outputCollection: "toolCallResults",
						outputElement: "={id: toolCall._meta.id, name: toolCall._meta.name}",
					},
				)
				.endEvent("e")
				.build()

			const process = firstProcess(defs)
			const agent = defined(process.flowElements.find((n) => n.id === "agent"))
			expect(agent.type).toBe("adHocSubProcess")

			// Check zeebe:taskDefinition
			const taskDef = agent.extensionElements.find((e) => e.name === "zeebe:taskDefinition")
			expect(taskDef).toBeDefined()
			expect(taskDef?.attributes.type).toBe("io.camunda.agenticai:aiagent-job-worker:1")

			// Check zeebe:ioMapping
			const ioMapping = agent.extensionElements.find((e) => e.name === "zeebe:ioMapping")
			expect(ioMapping).toBeDefined()
			expect(ioMapping?.children.filter((c) => c.name === "zeebe:input")).toHaveLength(2)
			expect(ioMapping?.children.filter((c) => c.name === "zeebe:output")).toHaveLength(1)

			// Check zeebe:taskHeaders
			const headers = agent.extensionElements.find((e) => e.name === "zeebe:taskHeaders")
			expect(headers).toBeDefined()
			expect(headers?.children).toHaveLength(2)

			// Check zeebe:adHoc
			const adHoc = agent.extensionElements.find((e) => e.name === "zeebe:adHoc")
			expect(adHoc).toBeDefined()
			expect(adHoc?.attributes.outputCollection).toBe("toolCallResults")
			expect(adHoc?.attributes.outputElement).toBe(
				"={id: toolCall._meta.id, name: toolCall._meta.name}",
			)

			// Check child elements
			if (agent.type === "adHocSubProcess") {
				expect(agent.flowElements).toHaveLength(2)
			}
		})

		it("supports modeler template attributes on ad-hoc sub-process", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.adHocSubProcess(
					"agent",
					(b) => {
						b.serviceTask("tool1", { name: "Tool", taskType: "test:1" })
					},
					{
						name: "Agent",
						modelerTemplate: "io.camunda.connectors.agenticai.v1",
						modelerTemplateVersion: "5",
						modelerTemplateIcon: "data:image/svg+xml;base64,abc",
					},
				)
				.endEvent("e")
				.build()

			const agent = defined(firstProcess(defs).flowElements.find((n) => n.id === "agent"))
			expect(agent.unknownAttributes["zeebe:modelerTemplate"]).toBe(
				"io.camunda.connectors.agenticai.v1",
			)
			expect(agent.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("5")
			expect(agent.unknownAttributes["zeebe:modelerTemplateIcon"]).toBe(
				"data:image/svg+xml;base64,abc",
			)
		})
	})

	// -----------------------------------------------------------------------
	// zeebe:properties round-trip
	// -----------------------------------------------------------------------

	describe("zeebe:properties", () => {
		it("round-trips zeebe:properties through export and parse", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", {
					name: "Webhook",
					messageName: "wh-123",
					zeebeProperties: [
						{ name: "inbound.type", value: "io.camunda:webhook:1" },
						{ name: "inbound.method", value: "POST" },
					],
				})
				.endEvent("e")
				.build()

			const xml = Bpmn.export(defs)
			const parsed = Bpmn.parse(xml)

			// Message should round-trip
			expect(parsed.messages).toHaveLength(1)
			expect(parsed.messages[0]?.name).toBe("wh-123")

			// zeebe:properties should round-trip
			const start = parsed.processes[0]?.flowElements.find((n) => n.id === "s")
			const propsExt = start?.extensionElements.find((e) => e.name === "zeebe:properties")
			expect(propsExt).toBeDefined()
			expect(propsExt?.children).toHaveLength(2)
		})
	})

	// -----------------------------------------------------------------------
	// Auto-join gateways
	// -----------------------------------------------------------------------

	describe("auto-join gateways", () => {
		it("inserts a matching exclusive join gateway when branches converge", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("a", (b) =>
						b.condition("= a").serviceTask("t1", { name: "A", taskType: "x" }).connectTo("end"),
					)
					.branch("b", (b) => b.defaultFlow().connectTo("end"))
					.endEvent("end")
					.build(),
			)

			const join = process.flowElements.find((e) => e.id === "gw_join")
			expect(join).toBeDefined()
			expect(join?.type).toBe("exclusiveGateway")

			// Both branches should target the join
			expect(
				process.sequenceFlows.some((f) => f.sourceRef === "t1" && f.targetRef === "gw_join"),
			).toBe(true)
			expect(
				process.sequenceFlows.some((f) => f.sourceRef === "gw" && f.targetRef === "gw_join"),
			).toBe(true)

			// Join should flow to end
			expect(
				process.sequenceFlows.some((f) => f.sourceRef === "gw_join" && f.targetRef === "end"),
			).toBe(true)
		})

		it("does not insert a join if one already exists with matching type", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.parallelGateway("split")
					.branch("a", (b) => b.serviceTask("t1", { name: "A", taskType: "x" }).connectTo("join"))
					.branch("b", (b) => b.serviceTask("t2", { name: "B", taskType: "y" }).connectTo("join"))
					.parallelGateway("join")
					.endEvent("end")
					.build(),
			)

			// No auto-join should be created since "join" is already a parallelGateway
			expect(process.flowElements.find((e) => e.id === "split_join")).toBeUndefined()
		})

		it("does not insert a join for early-return branches with different targets", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("err", (b) => b.condition("= err").endEvent("errEnd"))
					.branch("ok", (b) => b.defaultFlow().connectTo("next"))
					.serviceTask("next", { name: "Next", taskType: "x" })
					.endEvent("end")
					.build(),
			)

			// No auto-join needed since branches go to different targets
			expect(process.flowElements.find((e) => e.id === "gw_join")).toBeUndefined()
		})

		it("inserts an exclusiveGateway join (not eventBasedGateway) when eventBasedGateway branches converge", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.eventBasedGateway("wait", { name: "Wait for response" })
					.branch("msg", (b) =>
						b
							.intermediateCatchEvent("onMessage", {
								name: "Message received",
								messageName: "ResponseMessage",
							})
							.connectTo("converge"),
					)
					.branch("timer", (b) =>
						b
							.intermediateCatchEvent("onTimeout", {
								name: "Timeout",
								timerDuration: "PT1H",
							})
							.connectTo("converge"),
					)
					.serviceTask("converge", { name: "Handle outcome", taskType: "handle" })
					.endEvent("end")
					.build(),
			)

			const join = process.flowElements.find((e) => e.id === "wait_join")
			expect(join).toBeDefined()
			// Must NOT be eventBasedGateway — that is illegal BPMN (split-only type)
			expect(join?.type).not.toBe("eventBasedGateway")
			// Must be exclusiveGateway — event-based branches are mutually exclusive
			expect(join?.type).toBe("exclusiveGateway")

			// Both catch events should flow into the join
			expect(
				process.sequenceFlows.some(
					(f) => f.sourceRef === "onMessage" && f.targetRef === "wait_join",
				),
			).toBe(true)
			expect(
				process.sequenceFlows.some(
					(f) => f.sourceRef === "onTimeout" && f.targetRef === "wait_join",
				),
			).toBe(true)

			// Join flows to converge task
			expect(
				process.sequenceFlows.some(
					(f) => f.sourceRef === "wait_join" && f.targetRef === "converge",
				),
			).toBe(true)
		})

		it("still inserts parallelGateway join for parallelGateway splits (regression)", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.parallelGateway("split")
					.branch("a", (b) => b.serviceTask("ta", { name: "A", taskType: "x" }).connectTo("merge"))
					.branch("b", (b) => b.serviceTask("tb", { name: "B", taskType: "y" }).connectTo("merge"))
					.serviceTask("merge", { name: "After", taskType: "z" })
					.endEvent("end")
					.build(),
			)

			const join = process.flowElements.find((e) => e.id === "split_join")
			expect(join).toBeDefined()
			expect(join?.type).toBe("parallelGateway")
		})
	})
})

// -----------------------------------------------------------------------
// Task 1 regression — factory extraction
// -----------------------------------------------------------------------

describe("factory extraction regression", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("service task with modeler template in a branch still sets unknownAttributes", () => {
		const process = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("yes", (b) =>
					b
						.defaultFlow()
						.serviceTask("t1", {
							name: "Templated",
							taskType: "worker",
							modelerTemplate: "io.example.v1",
							modelerTemplateVersion: "3",
						})
						.connectTo("end"),
				)
				.branch("no", (b) => b.condition("= false").endEvent())
				.endEvent("end")
				.build(),
		)

		const t1 = defined(process.flowElements.find((e) => e.id === "t1"))
		expect(t1.unknownAttributes["zeebe:modelerTemplate"]).toBe("io.example.v1")
		expect(t1.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("3")
	})

	it("user task with formId in a sub-process sets zeebe:formDefinition extension", () => {
		const process = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("s")
				.subProcess("sub", (b) => {
					b.startEvent("ss").userTask("ut", { formId: "form-abc" }).endEvent("se")
				})
				.endEvent("e")
				.build(),
		)

		const sub = defined(process.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		const ut = defined(sub.flowElements.find((e) => e.id === "ut"))
		const formDef = ut.extensionElements.find((x) => x.name === "zeebe:formDefinition")
		expect(formDef).toBeDefined()
		expect(formDef?.attributes.formId).toBe("form-abc")
	})

	it("businessRuleTask with taskType in a branch sets zeebe:taskDefinition", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("rule-path", (b) =>
				b.defaultFlow().businessRuleTask("rule", { taskType: "evaluate-worker" }).connectTo("end"),
			)
			.branch("other", (b) => b.condition("= false").endEvent())
			.endEvent("end")
			.build()

		const p = firstProcess(defs)
		const rule = defined(p.flowElements.find((e) => e.id === "rule"))
		const taskDef = rule.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
		expect(taskDef).toBeDefined()
		expect(taskDef?.attributes.type).toBe("evaluate-worker")
	})
})

// -----------------------------------------------------------------------
// Task 2 — SubProcessContentBuilder branching
// -----------------------------------------------------------------------

describe("SubProcessContentBuilder branching", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("sub-process supports exclusive gateway with branches to separate end events", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.subProcess("sub", (b) => {
				b.startEvent("ss")
					.exclusiveGateway("gw")
					.branch("approve", (br) =>
						br
							.condition("= approved")
							.serviceTask("approve-task", { name: "Approve", taskType: "approve" })
							.endEvent("se-approve"),
					)
					.branch("reject", (br) =>
						br
							.defaultFlow()
							.serviceTask("reject-task", { name: "Reject", taskType: "reject" })
							.endEvent("se-reject"),
					)
			})
			.endEvent("e")
			.build()

		const sub = defined(defs.processes[0]?.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		expect(sub.flowElements.some((e) => e.id === "approve-task")).toBe(true)
		expect(sub.flowElements.some((e) => e.id === "reject-task")).toBe(true)
		// Gateway flows to branch tasks
		expect(
			sub.sequenceFlows.some((f) => f.sourceRef === "gw" && f.targetRef === "approve-task"),
		).toBe(true)
		expect(
			sub.sequenceFlows.some((f) => f.sourceRef === "gw" && f.targetRef === "reject-task"),
		).toBe(true)
		// Branch tasks flow to their respective end events
		expect(
			sub.sequenceFlows.some((f) => f.sourceRef === "approve-task" && f.targetRef === "se-approve"),
		).toBe(true)
		expect(
			sub.sequenceFlows.some((f) => f.sourceRef === "reject-task" && f.targetRef === "se-reject"),
		).toBe(true)
		// No auto-join needed (no convergence)
		expect(sub.flowElements.some((e) => e.id === "gw_join")).toBe(false)
	})

	it("sub-process auto-inserts join gateway when branches converge", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.subProcess("sub", (b) => {
				b.startEvent("ss")
					.exclusiveGateway("gw")
					.branch("a", (br) =>
						br
							.condition("= x > 0")
							.serviceTask("ta", { name: "A", taskType: "a" })
							.connectTo("merge"),
					)
					.branch("b", (br) =>
						br.defaultFlow().serviceTask("tb", { name: "B", taskType: "b" }).connectTo("merge"),
					)
					.serviceTask("merge", { name: "After", taskType: "after" })
					.endEvent("se")
			})
			.endEvent("e")
			.build()

		const sub = defined(defs.processes[0]?.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		const join = sub.flowElements.find((e) => e.id === "gw_join")
		expect(join).toBeDefined()
		expect(join?.type).toBe("exclusiveGateway")
		// Verify flows: ta→gw_join, tb→gw_join, gw_join→merge
		expect(sub.sequenceFlows.some((f) => f.sourceRef === "ta" && f.targetRef === "gw_join")).toBe(
			true,
		)
		expect(sub.sequenceFlows.some((f) => f.sourceRef === "tb" && f.targetRef === "gw_join")).toBe(
			true,
		)
		expect(
			sub.sequenceFlows.some((f) => f.sourceRef === "gw_join" && f.targetRef === "merge"),
		).toBe(true)
		// Original ta→merge and tb→merge flows should not exist (replaced by gw_join)
		expect(sub.sequenceFlows.some((f) => f.targetRef === "merge" && f.sourceRef === "ta")).toBe(
			false,
		)
		expect(sub.sequenceFlows.some((f) => f.targetRef === "merge" && f.sourceRef === "tb")).toBe(
			false,
		)
	})

	it("sub-process supports connectTo for loop back", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.subProcess("sub", (b) => {
				b.startEvent("ss")
					.serviceTask("work", { name: "Work", taskType: "work" })
					.exclusiveGateway("check")
					.branch("done", (br) => br.condition("= done").endEvent("se"))
					.branch("retry", (br) => br.defaultFlow().connectTo("work"))
			})
			.endEvent("e")
			.build()

		const sub = defined(defs.processes[0]?.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		expect(sub.sequenceFlows.some((f) => f.sourceRef === "check" && f.targetRef === "work")).toBe(
			true,
		)
	})

	it("sub-process supports businessRuleTask and sendTask", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.subProcess("sub", (b) => {
				b.startEvent("ss")
					.businessRuleTask("rule", { decisionId: "approval-decision", resultVariable: "decision" })
					.sendTask("notify", { name: "Notify" })
					.endEvent("se")
			})
			.endEvent("e")
			.build()

		const sub = defined(defs.processes[0]?.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		expect(sub.flowElements.some((e) => e.id === "rule")).toBe(true)
		expect(sub.flowElements.some((e) => e.id === "notify")).toBe(true)
	})
})

// -----------------------------------------------------------------------
// Task 3 — Build-time validation
// -----------------------------------------------------------------------

describe("build-time validation", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("throws when connectTo references an ID that does not exist", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.serviceTask("t1", { name: "T", taskType: "x" })
				.connectTo("nonexistent")
				.endEvent("e")
				.build(),
		).toThrow(/nonexistent/)
	})

	it("allows connectTo with a forward reference that is satisfied later", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("a", (b) =>
					b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("end"),
				)
				.branch("b", (b) => b.defaultFlow().connectTo("end"))
				.endEvent("end")
				.build(),
		).not.toThrow()
	})

	it("strict mode throws when auto-join gateway would be inserted", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("a", (b) =>
					b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("after"),
				)
				.branch("b", (b) => b.defaultFlow().connectTo("after"))
				.serviceTask("after", { name: "After", taskType: "z" })
				.endEvent("end")
				.build({ strict: true }),
		).toThrow(/auto-join/)
	})

	it("strict mode passes when join gateway is explicit", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("a", (b) =>
					b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("join"),
				)
				.branch("b", (b) => b.defaultFlow().connectTo("join"))
				.exclusiveGateway("join")
				.endEvent("end")
				.build({ strict: true }),
		).not.toThrow()
	})
})

// -----------------------------------------------------------------------
// Task 4 — withBoundary ergonomics
// -----------------------------------------------------------------------

describe("withBoundary", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("attaches error boundary to the preceding task and main flow continues", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.serviceTask("validate", { name: "Validate", taskType: "validate" })
			.withBoundary("on-err", { errorCode: "INVALID", cancelActivity: true }, (p) =>
				p.serviceTask("handle", { name: "Handle", taskType: "handle-err" }).endEvent("err-end"),
			)
			.serviceTask("next", { name: "Next", taskType: "next" })
			.endEvent("end")
			.build()

		const p = firstProcess(defs)
		// boundary event is attached to "validate"
		const boundary = p.flowElements.find((e) => e.id === "on-err")
		expect(boundary).toBeDefined()
		if (boundary?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
		expect(boundary.attachedToRef).toBe("validate")

		// main flow: validate → next (not validate → handle)
		expect(p.sequenceFlows.some((f) => f.sourceRef === "validate" && f.targetRef === "next")).toBe(
			true,
		)

		// error path: on-err → handle → err-end
		expect(p.sequenceFlows.some((f) => f.sourceRef === "on-err" && f.targetRef === "handle")).toBe(
			true,
		)
		expect(p.sequenceFlows.some((f) => f.sourceRef === "handle" && f.targetRef === "err-end")).toBe(
			true,
		)
	})

	it("timer boundary leaves main flow intact", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.serviceTask("slow", { name: "Slow", taskType: "slow" })
			.withBoundary("on-timeout", { timerDuration: "PT30S", cancelActivity: false }, (p) =>
				p
					.serviceTask("escalate", { name: "Escalate", taskType: "escalate" })
					.endEvent("timeout-end"),
			)
			.endEvent("end")
			.build()

		const p = firstProcess(defs)
		const timeout = p.flowElements.find((e) => e.id === "on-timeout")
		expect(timeout).toBeDefined()
		if (timeout?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
		expect(timeout.attachedToRef).toBe("slow")
		expect(timeout.cancelActivity).toBe(false)

		// main flow: slow → end
		expect(p.sequenceFlows.some((f) => f.sourceRef === "slow" && f.targetRef === "end")).toBe(true)
	})

	it("throws when withBoundary is called without a preceding element", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.withBoundary("err", { errorCode: "X" }, (p) => p.endEvent())
				.build(),
		).toThrow(/withBoundary/)
	})
})

// -----------------------------------------------------------------------
// Task 5 — Task defaults + disconnectedStartEvent alias
// -----------------------------------------------------------------------

describe("task defaults", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("applies default retries to all subsequent service tasks", () => {
		const defs = Bpmn.createProcess("proc")
			.defaults({ serviceTask: { retries: "5" } })
			.startEvent("s")
			.serviceTask("t1", { name: "T1", taskType: "worker-a" })
			.serviceTask("t2", { name: "T2", taskType: "worker-b" })
			.endEvent("e")
			.build()

		const p = firstProcess(defs)
		for (const id of ["t1", "t2"]) {
			const task = defined(p.flowElements.find((e) => e.id === id))
			const taskDef = task.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
			expect(taskDef?.attributes.retries, `${id} retries`).toBe("5")
		}
	})

	it("explicit retries override the default", () => {
		const defs = Bpmn.createProcess("proc")
			.defaults({ serviceTask: { retries: "5" } })
			.startEvent("s")
			.serviceTask("t1", { name: "T1", taskType: "worker-a", retries: "1" })
			.endEvent("e")
			.build()

		const p = firstProcess(defs)
		const task = defined(p.flowElements.find((e) => e.id === "t1"))
		const taskDef = task.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
		expect(taskDef?.attributes.retries).toBe("1")
	})

	it("defaults do not affect service tasks added before .defaults() call", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.serviceTask("before", { name: "Before", taskType: "x" })
			.defaults({ serviceTask: { retries: "9" } })
			.serviceTask("after", { name: "After", taskType: "y" })
			.endEvent("e")
			.build()

		const p = firstProcess(defs)
		const before = defined(p.flowElements.find((e) => e.id === "before"))
		const taskDefBefore = before.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
		// "before" had no explicit retries and defaults weren't set yet
		expect(taskDefBefore?.attributes.retries).toBeUndefined()

		const after = defined(p.flowElements.find((e) => e.id === "after"))
		const taskDefAfter = after.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
		expect(taskDefAfter?.attributes.retries).toBe("9")
	})
})

describe("disconnectedStartEvent alias", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("disconnectedStartEvent creates a start event with no auto-connection", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s1")
			.serviceTask("t1", { name: "T1", taskType: "x" })
			.endEvent("e1")
			.disconnectedStartEvent("s2")
			.serviceTask("t2", { name: "T2", taskType: "y" })
			.endEvent("e2")
			.build()

		const p = firstProcess(defs)
		// s2 should have no incoming flows
		expect(p.sequenceFlows.some((f) => f.targetRef === "s2")).toBe(false)
		// t2 connects from s2
		expect(p.sequenceFlows.some((f) => f.sourceRef === "s2" && f.targetRef === "t2")).toBe(true)
	})
})

// -----------------------------------------------------------------------
// Task 6 — DiagramBuilder / Bpmn.createDiagram()
// -----------------------------------------------------------------------

describe("DiagramBuilder", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("builds a definitions with a user-provided id", () => {
		const defs = Bpmn.createDiagram("OrderSystem")
			.process("order-flow", (p) =>
				p.startEvent("s").serviceTask("t1", { name: "T", taskType: "x" }).endEvent("e"),
			)
			.build()

		expect(defs.id).toBe("OrderSystem")
		expect(defs.processes).toHaveLength(1)
		expect(defs.processes[0]?.id).toBe("order-flow")
	})

	it("builds a definitions with two processes and no id conflict", () => {
		const defs = Bpmn.createDiagram("TwoProcess")
			.process("caller", (p) =>
				p.startEvent("s1").callActivity("call-callee", { processId: "callee" }).endEvent("e1"),
			)
			.process("callee", (p) =>
				p.startEvent("s2").serviceTask("work", { name: "Work", taskType: "work" }).endEvent("e2"),
			)
			.build()

		expect(defs.processes).toHaveLength(2)
		expect(defs.processes[0]?.id).toBe("caller")
		expect(defs.processes[1]?.id).toBe("callee")
	})

	it("collects root messages across processes", () => {
		const defs = Bpmn.createDiagram("Messaging")
			.process("sender", (p) =>
				p
					.startEvent("s")
					.intermediateThrowEvent("throw", { messageName: "order-placed" })
					.endEvent("e"),
			)
			.process("receiver", (p) =>
				p.startEvent("catch", { messageName: "order-placed" }).endEvent("e2"),
			)
			.build()

		// Both processes reference "order-placed" — messages should be collected
		expect(defs.messages.length).toBeGreaterThanOrEqual(1)
	})

	it("defaults definitions id to 'Definitions_1' when not provided", () => {
		const defs = Bpmn.createDiagram()
			.process("p", (p) => p.startEvent("s").endEvent("e"))
			.build()

		expect(defs.id).toBe("Definitions_1")
	})
})

// -----------------------------------------------------------------------
// Task 7 — exporterVersion constant
// -----------------------------------------------------------------------

describe("exporterVersion", () => {
	it("ProcessBuilder.build() sets a non-empty exporterVersion", () => {
		const defs = Bpmn.createProcess("proc").startEvent("s").endEvent("e").build()
		expect(defs.exporterVersion).toBeTruthy()
		expect(typeof defs.exporterVersion).toBe("string")
	})

	it("DiagramBuilder.build() sets the same exporterVersion as ProcessBuilder", () => {
		const single = Bpmn.createProcess("proc").startEvent("s").endEvent("e").build()
		const multi = Bpmn.createDiagram("D")
			.process("proc", (p) => p.startEvent("s").endEvent("e"))
			.build()
		expect(multi.exporterVersion).toBe(single.exporterVersion)
	})
})

describe("DiagramBuilder", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("defaults executionPlatformVersion to 8.9.0", () => {
		const defs = Bpmn.createDiagram("D1")
			.process("p1", (b) => b.startEvent("s").endEvent("e"))
			.build()
		expect(defs.unknownAttributes["modeler:executionPlatformVersion"]).toBe("8.9.0")
	})

	it("accepts a custom executionPlatformVersion", () => {
		const defs = Bpmn.createDiagram("D1")
			.executionPlatformVersion("8.9.0")
			.process("p1", (b) => b.startEvent("s").endEvent("e"))
			.build()
		expect(defs.unknownAttributes["modeler:executionPlatformVersion"]).toBe("8.9.0")
	})

	it("executionPlatformVersion is chainable", () => {
		const builder = Bpmn.createDiagram("D1")
		expect(builder.executionPlatformVersion("8.7.0")).toBe(builder)
	})
})

// ---------------------------------------------------------------------------
// Text annotations
// ---------------------------------------------------------------------------

describe("text annotations", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("textAnnotation() attaches annotation to current element", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("s")
				.userTask("T", { name: "Do work" })
				.textAnnotation("Manual: needs sign-off")
				.endEvent("e")
				.build(),
		)

		expect(process.textAnnotations).toHaveLength(1)
		const ann = defined(process.textAnnotations[0])
		expect(ann.id).toBe("TextAnnotation_T_1")
		expect(ann.text).toBe("Manual: needs sign-off")

		expect(process.associations).toHaveLength(1)
		const assoc = defined(process.associations[0])
		expect(assoc.id).toBe("Association_T_1")
		expect(assoc.sourceRef).toBe("T")
		expect(assoc.targetRef).toBe("TextAnnotation_T_1")
		expect(assoc.associationDirection).toBe("None")
	})

	it("annotate() attaches annotation to an arbitrary element by ID", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("s")
				.userTask("T", { name: "Do work" })
				.endEvent("e")
				.annotate("s", "Triggered by: customer order")
				.build(),
		)

		expect(process.textAnnotations).toHaveLength(1)
		const ann = defined(process.textAnnotations[0])
		expect(ann.id).toBe("TextAnnotation_s_1")
		expect(ann.text).toBe("Triggered by: customer order")
		expect(process.associations[0]?.sourceRef).toBe("s")
	})

	it("multiple annotations on the same element get incremented IDs", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("s")
				.userTask("T", { name: "Do work" })
				.textAnnotation("Implementation: POST /work")
				.textAnnotation("Manual: needs sign-off")
				.endEvent("e")
				.build(),
		)

		expect(process.textAnnotations).toHaveLength(2)
		expect(process.textAnnotations[0]?.id).toBe("TextAnnotation_T_1")
		expect(process.textAnnotations[1]?.id).toBe("TextAnnotation_T_2")
		expect(process.associations[0]?.id).toBe("Association_T_1")
		expect(process.associations[1]?.id).toBe("Association_T_2")
	})

	it("textAnnotation() does not move the cursor", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("s")
				.userTask("T", { name: "Do work" })
				.textAnnotation("note")
				.endEvent("e")
				.build(),
		)

		// The sequence flow should still go T → e, not annotation → e
		const toEnd = process.sequenceFlows.find((f) => f.targetRef === "e")
		expect(defined(toEnd).sourceRef).toBe("T")
	})

	it("annotations in branches bubble up to the process", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("yes", (b) =>
					b.userTask("T1", { name: "Option A" }).textAnnotation("Follow-up: notify team"),
				)
				.branch("no", (b) => b.endEvent("e2"))
				.endEvent("e")
				.build(),
		)

		expect(process.textAnnotations).toHaveLength(1)
		expect(process.textAnnotations[0]?.id).toBe("TextAnnotation_T1_1")
		expect(process.associations[0]?.sourceRef).toBe("T1")
	})

	it("textAnnotation() throws if no current element", () => {
		expect(() => Bpmn.createProcess("p").textAnnotation("note").build()).toThrow(
			"textAnnotation() must follow a flow element",
		)
	})
})

describe("compensation — isForCompensation serialization", () => {
	it("serializes isForCompensation=true on a service task to XML", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("proc")
				.serviceTask("handler", { name: "Cancel", taskType: "cancel", isForCompensation: true })
				.build(),
		)
		expect(xml).toContain('isForCompensation="true"')
		expect(xml).toContain('id="handler"')
	})

	it("round-trips isForCompensation through parse → export", () => {
		const xml1 = Bpmn.export(
			Bpmn.createProcess("proc")
				.serviceTask("handler", { name: "Cancel", taskType: "cancel", isForCompensation: true })
				.build(),
		)
		const xml2 = Bpmn.export(Bpmn.parse(xml1))
		expect(xml2).toContain('isForCompensation="true"')
	})
})

describe("compensation", () => {
	it("boundary event with compensation: true emits compensateEventDefinition", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
				.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
				.endEvent("end")
				.build(),
		)
		expect(xml).toContain("compensateEventDefinition")
		expect(xml).toContain('id="CompBoundary"')
	})

	it("intermediateThrowEvent with compensation: true emits compensateEventDefinition", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.intermediateThrowEvent("CompThrow", {
					name: "Compensate",
					compensation: true,
					activityRef: "BookHotel",
				})
				.endEvent("end")
				.build(),
		)
		expect(xml).toContain("compensateEventDefinition")
		expect(xml).toContain('activityRef="BookHotel"')
	})

	it("compensation handler is linked by association, not sequence flow", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("start")
			.serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
			.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
			.serviceTask("CancelHotel", {
				name: "Cancel Hotel",
				taskType: "cancel-hotel",
				isForCompensation: true,
			})
			.intermediateThrowEvent("CompThrow", { name: "Compensate", compensation: true })
			.endEvent("end")
			.build()

		const process = defined(defs.processes[0])
		const xml = Bpmn.export(defs)

		// No sequence flow from CompBoundary to CancelHotel
		expect(xml).not.toMatch(/sourceRef="CompBoundary"[^>]*?sequenceFlow/)
		expect(xml).not.toMatch(/sequenceFlow[^>]*?sourceRef="CompBoundary"/)

		// Association exists from CompBoundary to CancelHotel
		const assoc = process.associations.find(
			(a) => a.sourceRef === "CompBoundary" && a.targetRef === "CancelHotel",
		)
		expect(assoc).toBeDefined()
		expect(xml).toContain("<bpmn:association")
		expect(xml).toContain('sourceRef="CompBoundary"')
		expect(xml).toContain('targetRef="CancelHotel"')
	})

	it("compensation handler has no incoming/outgoing sequence flows", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("start")
			.serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
			.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
			.serviceTask("CancelHotel", {
				name: "Cancel Hotel",
				taskType: "cancel-hotel",
				isForCompensation: true,
			})
			.endEvent("end")
			.build()

		const process = defined(defs.processes[0])
		const handler = defined(process.flowElements.find((e) => e.id === "CancelHotel"))
		expect(handler.incoming).toHaveLength(0)
		expect(handler.outgoing).toHaveLength(0)
	})

	it("main flow continues normally after adding compensation handler", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("start")
			.serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
			.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
			.serviceTask("CancelHotel", {
				name: "Cancel Hotel",
				taskType: "cancel-hotel",
				isForCompensation: true,
			})
			.intermediateThrowEvent("CompThrow", { name: "Compensate", compensation: true })
			.endEvent("end")
			.build()

		const process = defined(defs.processes[0])
		// Main flow: start → BookHotel → CompThrow → end
		const flows = process.sequenceFlows
		expect(
			flows.find((f) => f.sourceRef === "BookHotel" && f.targetRef === "CompThrow"),
		).toBeDefined()
		expect(flows.find((f) => f.sourceRef === "CompThrow" && f.targetRef === "end")).toBeDefined()
	})

	it("reproduction script: all three contains checks pass", () => {
		const builder = Bpmn.createProcess("trip-booking").name("Trip Booking")
		builder
			.startEvent("start", { name: "Start" })
			.serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
		builder.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
		builder.serviceTask("CancelHotel", {
			name: "Cancel Hotel",
			taskType: "cancel-hotel",
			isForCompensation: true,
		})
		builder.intermediateThrowEvent("CompThrow", {
			name: "Compensate",
			compensation: true,
			activityRef: "BookHotel",
		})
		const defs = builder.endEvent("end", { name: "End" }).build()
		const xml = Bpmn.export(defs)

		expect(xml).toContain("compensateEventDefinition")
		expect(xml).toContain("isForCompensation")
		expect(xml).toContain("activityRef")
		// Association, not sequence flow, links boundary to handler
		expect(xml).toContain("<bpmn:association")
		expect(xml).not.toMatch(/sequenceFlow[^>]*sourceRef="CompBoundary"/)
		expect(xml).not.toMatch(/sequenceFlow[^>]*targetRef="CancelHotel"/)
	})

	it("round-trips compensation constructs through parse → export", () => {
		const builder = Bpmn.createProcess("comp-proc")
		builder
			.startEvent("start")
			.serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
		builder.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
		builder.serviceTask("CancelHotel", {
			name: "Cancel Hotel",
			taskType: "cancel-hotel",
			isForCompensation: true,
		})
		builder.intermediateThrowEvent("CompThrow", {
			compensation: true,
			activityRef: "BookHotel",
		})
		const xml1 = Bpmn.export(builder.endEvent("end").build())
		const xml2 = Bpmn.export(Bpmn.parse(xml1))

		expect(xml2).toContain("compensateEventDefinition")
		expect(xml2).toContain("isForCompensation")
		expect(xml2).toContain('activityRef="BookHotel"')
	})
})

describe("BranchBuilder — isForCompensation forwarding (C1)", () => {
	it("sendTask with isForCompensation:true in a branch produces isForCompensation on the element", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.parallelGateway("split")
				.branch("A", (b) => b.sendTask("send-comp", { isForCompensation: true }).connectTo("join"))
				.branch("B", (b) => b.task("other", {}).connectTo("join"))
				.parallelGateway("join")
				.endEvent("end")
				.build(),
		)
		const el = defined(p.flowElements.find((e) => e.id === "send-comp"))
		expect(el.isForCompensation).toBe(true)
	})

	it("receiveTask with isForCompensation:true in a branch produces isForCompensation on the element", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.parallelGateway("split")
				.branch("A", (b) =>
					b.receiveTask("recv-comp", { isForCompensation: true }).connectTo("join"),
				)
				.branch("B", (b) => b.task("other", {}).connectTo("join"))
				.parallelGateway("join")
				.endEvent("end")
				.build(),
		)
		const el = defined(p.flowElements.find((e) => e.id === "recv-comp"))
		expect(el.isForCompensation).toBe(true)
	})

	it("task with isForCompensation:true in a branch produces isForCompensation on the element", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.parallelGateway("split")
				.branch("A", (b) => b.task("task-comp", { isForCompensation: true }).connectTo("join"))
				.branch("B", (b) => b.task("other", {}).connectTo("join"))
				.parallelGateway("join")
				.endEvent("end")
				.build(),
		)
		const el = defined(p.flowElements.find((e) => e.id === "task-comp"))
		expect(el.isForCompensation).toBe(true)
	})
})

describe("SubProcessContentBuilder — isForCompensation forwarding (C2)", () => {
	it("sendTask with isForCompensation:true inside a subProcess produces isForCompensation on the element", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.subProcess("sub", (b) => {
					b.startEvent("sub-start")
						.sendTask("send-comp", { isForCompensation: true })
						.endEvent("sub-end")
				})
				.endEvent("end")
				.build(),
		)
		const sub = defined(p.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		const el = defined(sub.flowElements.find((e) => e.id === "send-comp"))
		expect(el.isForCompensation).toBe(true)
	})

	it("receiveTask with isForCompensation:true inside a subProcess produces isForCompensation on the element", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.subProcess("sub", (b) => {
					b.startEvent("sub-start")
						.receiveTask("recv-comp", { isForCompensation: true })
						.endEvent("sub-end")
				})
				.endEvent("end")
				.build(),
		)
		const sub = defined(p.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		const el = defined(sub.flowElements.find((e) => e.id === "recv-comp"))
		expect(el.isForCompensation).toBe(true)
	})

	it("task with isForCompensation:true inside a subProcess produces isForCompensation on the element", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.subProcess("sub", (b) => {
					b.startEvent("sub-start")
						.task("task-comp", { isForCompensation: true })
						.endEvent("sub-end")
				})
				.endEvent("end")
				.build(),
		)
		const sub = defined(p.flowElements.find((e) => e.id === "sub"))
		if (sub.type !== "subProcess") throw new Error("expected subProcess")
		const el = defined(sub.flowElements.find((e) => e.id === "task-comp"))
		expect(el.isForCompensation).toBe(true)
	})
})

describe("BranchBuilder nested branch infrastructure", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("elements added after nested branches in a branch auto-connect from all open ends", () => {
		// This exercises the new openBranchEnds drainage in BranchBuilder.addElement()
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("outer-gw")
			.branch("path-a", (b) => {
				b.exclusiveGateway("inner-gw")
					.branch("x", (bb) => bb.userTask("t-x"))
					.branch("y", (bb) => bb.userTask("t-y"))
					.userTask("t-after")
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)
		// t-x and t-y both connect via a convergence join to t-after
		// (build() auto-inserts inner-gw_join when multiple branches converge on the same target)
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "t-x" && f.targetRef === "inner-gw_join"),
		).toBe(true)
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "t-y" && f.targetRef === "inner-gw_join"),
		).toBe(true)
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "inner-gw_join" && f.targetRef === "t-after"),
		).toBe(true)
	})

	it("exclusiveGateway inside a branch supports branch() sub-split with endEvent termination", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("outer-gw")
			.branch("path-a", (b) => {
				b.exclusiveGateway("inner-gw")
					.branch("x", (bb) => bb.condition("= x").endEvent("e-x"))
					.branch("y", (bb) => bb.defaultFlow().endEvent("e-y"))
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)
		// inner-gw exists
		expect(p.flowElements.some((e) => e.id === "inner-gw")).toBe(true)
		// outer-gw → inner-gw (labeled "path-a")
		expect(
			p.sequenceFlows.some(
				(f) => f.sourceRef === "outer-gw" && f.targetRef === "inner-gw" && f.name === "path-a",
			),
		).toBe(true)
		// inner-gw → e-x (labeled "x")
		expect(
			p.sequenceFlows.some(
				(f) => f.sourceRef === "inner-gw" && f.targetRef === "e-x" && f.name === "x",
			),
		).toBe(true)
		// inner-gw → e-y (labeled "y")
		expect(
			p.sequenceFlows.some(
				(f) => f.sourceRef === "inner-gw" && f.targetRef === "e-y" && f.name === "y",
			),
		).toBe(true)
	})

	it("nested branch with connectTo correctly wires to a process-level element", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("outer-gw")
			.branch("path-a", (b) => {
				b.exclusiveGateway("inner-gw")
					.branch("x", (bb) => bb.condition("= x").userTask("t-x").connectTo("outer-merge"))
					.branch("y", (bb) => bb.defaultFlow().userTask("t-y").connectTo("outer-merge"))
			})
			.branch("path-b", (b) =>
				b.serviceTask("t-b", { name: "B", taskType: "b" }).connectTo("outer-merge"),
			)
			.exclusiveGateway("outer-merge")
			.endEvent("e")
			.build()

		const p = firstProcess(defs)
		// Both inner branches connect to outer-merge
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "t-x" && f.targetRef === "outer-merge"),
		).toBe(true)
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "t-y" && f.targetRef === "outer-merge"),
		).toBe(true)
	})

	it("throws when branch() called without preceding gateway inside a branch", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("a", (b) => {
					b.userTask("t").branch("x", (bb) => bb.endEvent("e"))
				})
				.build(),
		).toThrow("branch() must be called after a gateway element")
	})
})

describe("withBoundary — _savedMainFlowId cleanup (C3)", () => {
	it("element added after withBoundary(compensation) connects correctly to main flow", () => {
		const p = firstProcess(
			Bpmn.createProcess("proc")
				.startEvent("start")
				.serviceTask("Book", { name: "Book", taskType: "book" })
				.withBoundary("comp-boundary", { compensation: true }, (b) =>
					b.serviceTask("Cancel", { name: "Cancel", taskType: "cancel", isForCompensation: true }),
				)
				.serviceTask("Confirm", { name: "Confirm", taskType: "confirm" })
				.endEvent("end")
				.build(),
		)
		const flows = p.sequenceFlows
		// Main flow: Book → Confirm → end (not Book → Cancel or comp-boundary → Confirm)
		expect(flows.find((f) => f.sourceRef === "Book" && f.targetRef === "Confirm")).toBeDefined()
		expect(flows.find((f) => f.sourceRef === "Confirm" && f.targetRef === "end")).toBeDefined()
		// Compensation handler must not be in main sequence flow
		expect(flows.find((f) => f.targetRef === "Cancel")).toBeUndefined()
	})
})

describe("boundary events inside a branch", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("boundaryEvent() inside a branch attaches to the preceding task via attachedToRef", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("path-a", (b) => {
				b.userTask("ut")
					.boundaryEvent("be", { attachedTo: "ut", timerDuration: "PT4H", cancelActivity: false })
					.endEvent("e-timeout")
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)
		const be = p.flowElements.find((e) => e.id === "be")
		expect(be).toBeDefined()
		if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
		expect(be.attachedToRef).toBe("ut")
		expect(be.cancelActivity).toBe(false)
		expect(be.eventDefinitions).toHaveLength(1)
		expect(be.eventDefinitions[0]?.type).toBe("timer")
		// Boundary event chains to e-timeout
		expect(p.sequenceFlows.some((f) => f.sourceRef === "be" && f.targetRef === "e-timeout")).toBe(
			true,
		)
		// No sequence flow from ut to be (boundary events never auto-connect via sequence flow)
		expect(p.sequenceFlows.some((f) => f.sourceRef === "ut" && f.targetRef === "be")).toBe(false)
	})

	it("withBoundary() inside a branch attaches boundary and restores cursor to the task", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("path-a", (b) => {
				b.userTask("ut")
					.withBoundary("be-timer", { timerDuration: "PT4H", cancelActivity: false }, (h) => {
						h.userTask("escalate").endEvent("e-escalate")
					})
					.endEvent("e-main")
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)

		// boundary is attached to ut
		const be = p.flowElements.find((e) => e.id === "be-timer")
		if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
		expect(be.attachedToRef).toBe("ut")
		expect(be.cancelActivity).toBe(false)

		// main flow: ut → e-main (cursor restored to ut after withBoundary)
		expect(p.sequenceFlows.some((f) => f.sourceRef === "ut" && f.targetRef === "e-main")).toBe(true)

		// timeout path: be-timer → escalate → e-escalate
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "be-timer" && f.targetRef === "escalate"),
		).toBe(true)
		expect(
			p.sequenceFlows.some((f) => f.sourceRef === "escalate" && f.targetRef === "e-escalate"),
		).toBe(true)

		// no flow from ut to be-timer
		expect(p.sequenceFlows.some((f) => f.sourceRef === "ut" && f.targetRef === "be-timer")).toBe(
			false,
		)
	})

	it("withBoundary() error variant works in a branch", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("path-a", (b) => {
				b.serviceTask("validate", { name: "Validate", taskType: "validate" })
					.withBoundary("on-err", { errorCode: "INVALID", cancelActivity: true }, (h) => {
						h.endEvent("e-err", { errorCode: "INVALID" })
					})
					.endEvent("e-ok")
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)
		const be = p.flowElements.find((e) => e.id === "on-err")
		if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
		expect(be.attachedToRef).toBe("validate")
		expect(be.cancelActivity).toBe(true)
		// error definition
		expect(be.eventDefinitions[0]?.type).toBe("error")
		// main path: validate → e-ok
		expect(p.sequenceFlows.some((f) => f.sourceRef === "validate" && f.targetRef === "e-ok")).toBe(
			true,
		)
		// error path: on-err → e-err
		expect(p.sequenceFlows.some((f) => f.sourceRef === "on-err" && f.targetRef === "e-err")).toBe(
			true,
		)
	})

	it("withBoundary() throws when no preceding task in the branch", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("path-a", (b) => {
					b.withBoundary("be", { timerDuration: "PT1H" }, (h) => h.endEvent("e-be"))
				})
				.build(),
		).toThrow(/withBoundary/)
	})

	it("boundaryEvent in a branch has correct structure in the built model", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("path-a", (b) => {
				b.userTask("ut")
					.withBoundary("be", { timerDuration: "PT1H" }, (h) => h.endEvent("e-be"))
					.endEvent("e-main")
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)
		const be = p.flowElements.find((e) => e.id === "be")
		if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
		expect(be.attachedToRef).toBe("ut")
		// boundary event is in the main process flowElements
		expect(p.flowElements.some((e) => e.id === "be")).toBe(true)
	})

	it("boundaryEvent() as first element in a branch does not corrupt isFirstElement state", () => {
		// A boundary event attached to an external task, followed by another element
		// The second element must NOT get the branch name stamped on its flow
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.userTask("external-task")
			.exclusiveGateway("gw")
			.branch("path-a", (b) => {
				b.boundaryEvent("be", { attachedTo: "external-task", timerDuration: "PT1H" }).endEvent(
					"e-be",
				)
			})
			.branch("path-b", (b) => b.endEvent("e-b"))
			.build()

		const p = firstProcess(defs)
		// The flow be → e-be must NOT have name "path-a" (branch name belongs on gw → first task flow, not on boundary event outflow)
		const beToEnd = p.sequenceFlows.find((f) => f.sourceRef === "be" && f.targetRef === "e-be")
		expect(beToEnd).toBeDefined()
		expect(beToEnd?.name).toBeUndefined()
	})

	it("withBoundary() throws when the cursor is on a boundary event (not a task)", () => {
		expect(() =>
			Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("path-a", (b) => {
					b.userTask("t")
						.boundaryEvent("be1", { attachedTo: "t", timerDuration: "PT1H" })
						.withBoundary("be2", { timerDuration: "PT2H" }, (h) => h.endEvent("e"))
				})
				.branch("path-b", (b) => b.endEvent("e-b"))
				.build(),
		).toThrow(/withBoundary/)
	})
})

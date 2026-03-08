import { beforeEach, describe, expect, it } from "vitest";
import { Bpmn, resetIdCounter } from "../src/index.js";

/** Extracts the first process from BpmnDefinitions with a runtime assertion. */
function firstProcess(defs: ReturnType<ReturnType<typeof Bpmn.createProcess>["build"]>) {
	const p = defs.processes[0];
	expect(p).toBeDefined();
	return p as NonNullable<typeof p>;
}

/** Asserts a value is defined and returns it with narrowed type. */
function defined<T>(value: T | undefined | null, msg?: string): T {
	expect(value, msg).toBeDefined();
	return value as T;
}

describe("BpmnProcessBuilder", () => {
	beforeEach(() => {
		resetIdCounter();
	});

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
			);

			expect(process.id).toBe("proc1");
			expect(process.name).toBe("Simple Process");
			expect(process.isExecutable).toBe(true);
			expect(process.flowElements).toHaveLength(2);
			expect(process.sequenceFlows).toHaveLength(1);

			const flow = defined(process.sequenceFlows[0]);
			expect(flow.sourceRef).toBe("start");
			expect(flow.targetRef).toBe("end");
		});

		it("auto-connects sequential elements", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc2")
					.startEvent("s")
					.serviceTask("t1", { taskType: "type-a" })
					.serviceTask("t2", { taskType: "type-b" })
					.endEvent("e")
					.build(),
			);

			expect(process.flowElements).toHaveLength(4);
			expect(process.sequenceFlows).toHaveLength(3);

			expect(process.sequenceFlows[0]?.sourceRef).toBe("s");
			expect(process.sequenceFlows[0]?.targetRef).toBe("t1");
			expect(process.sequenceFlows[1]?.sourceRef).toBe("t1");
			expect(process.sequenceFlows[1]?.targetRef).toBe("t2");
			expect(process.sequenceFlows[2]?.sourceRef).toBe("t2");
			expect(process.sequenceFlows[2]?.targetRef).toBe("e");
		});

		it("computes incoming/outgoing arrays from flows", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.serviceTask("t1", { taskType: "x" })
					.endEvent("e")
					.build(),
			);

			const start = defined(process.flowElements.find((el) => el.id === "s"));
			const task = defined(process.flowElements.find((el) => el.id === "t1"));
			const end = defined(process.flowElements.find((el) => el.id === "e"));

			expect(start.outgoing).toHaveLength(1);
			expect(start.incoming).toHaveLength(0);
			expect(task.incoming).toHaveLength(1);
			expect(task.outgoing).toHaveLength(1);
			expect(end.incoming).toHaveLength(1);
			expect(end.outgoing).toHaveLength(0);
		});

		it("sets process as executable by default", () => {
			const process = firstProcess(Bpmn.createProcess("proc").build());
			expect(process.isExecutable).toBe(true);
		});

		it("allows setting executable to false", () => {
			const process = firstProcess(Bpmn.createProcess("proc").executable(false).build());
			expect(process.isExecutable).toBe(false);
		});

		it("auto-generates start event ID when not provided", () => {
			const process = firstProcess(Bpmn.createProcess("proc").startEvent().endEvent().build());
			expect(process.flowElements).toHaveLength(2);
			expect(process.flowElements[0]?.id).toMatch(/^StartEvent_/);
		});
	});

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
			);

			const el = defined(process.flowElements.find((n) => n.id === "st1"));
			expect(el.type).toBe("serviceTask");
			expect(el.name).toBe("My Service");

			const taskDef = defined(el.extensionElements.find((e) => e.name === "zeebe:taskDefinition"));
			expect(taskDef.attributes.type).toBe("my-worker");
			expect(taskDef.attributes.retries).toBe("5");
		});

		it("creates a service task with task headers", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.serviceTask("st1", {
						taskType: "worker",
						taskHeaders: { key1: "val1", key2: "val2" },
					})
					.build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "st1"));
			const headerEl = defined(el.extensionElements.find((e) => e.name === "zeebe:taskHeaders"));
			expect(headerEl.children).toHaveLength(2);
			expect(headerEl.children[0]?.attributes.key).toBe("key1");
			expect(headerEl.children[0]?.attributes.value).toBe("val1");
		});

		it("creates a user task with form reference", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").userTask("ut1", { name: "Review", formId: "form-123" }).build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "ut1"));
			expect(el.type).toBe("userTask");
			expect(el.name).toBe("Review");

			const formDef = defined(el.extensionElements.find((e) => e.name === "zeebe:formDefinition"));
			expect(formDef.attributes.formId).toBe("form-123");
		});

		it("creates a script task with FEEL expression", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.scriptTask("sc1", {
						name: "Compute",
						expression: "=x + 1",
						resultVariable: "result",
					})
					.build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "sc1"));
			expect(el.type).toBe("scriptTask");
			expect(el.name).toBe("Compute");

			const script = defined(el.extensionElements.find((e) => e.name === "zeebe:script"));
			expect(script.attributes.expression).toBe("=x + 1");
			expect(script.attributes.resultVariable).toBe("result");
		});

		it("creates a call activity with called process", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.callActivity("ca1", {
						name: "Sub Flow",
						processId: "child-process",
					})
					.build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "ca1"));
			expect(el.type).toBe("callActivity");
			expect(el.name).toBe("Sub Flow");

			const calledEl = defined(el.extensionElements.find((e) => e.name === "zeebe:calledElement"));
			expect(calledEl.attributes.processId).toBe("child-process");
		});

		it("creates intermediate throw events", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateThrowEvent("ite1", { name: "Signal" })
					.endEvent("e")
					.build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "ite1"));
			expect(el.type).toBe("intermediateThrowEvent");
			expect(el.name).toBe("Signal");
		});

		it("creates intermediate catch events", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("ice1", { name: "Wait" })
					.endEvent("e")
					.build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "ice1"));
			expect(el.type).toBe("intermediateCatchEvent");
			expect(el.name).toBe("Wait");
		});
	});

	// -----------------------------------------------------------------------
	// Element types (aspirational)
	// -----------------------------------------------------------------------

	describe("element types — aspirational", () => {
		it("creates a send task", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").sendTask("send1", { name: "Send Message" }).build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "send1"));
			expect(el.type).toBe("sendTask");
			expect(el.name).toBe("Send Message");
		});

		it("creates a receive task", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc").receiveTask("recv1", { name: "Wait for Message" }).build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "recv1"));
			expect(el.type).toBe("receiveTask");
			expect(el.name).toBe("Wait for Message");
		});

		it("creates a business rule task with decision reference", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.businessRuleTask("brt1", {
						name: "Evaluate Rules",
						decisionId: "Decision_1",
						resultVariable: "outcome",
					})
					.build(),
			);

			const el = defined(process.flowElements.find((n) => n.id === "brt1"));
			expect(el.type).toBe("businessRuleTask");
			expect(el.name).toBe("Evaluate Rules");

			const calledDecision = defined(
				el.extensionElements.find((e) => e.name === "zeebe:calledDecision"),
			);
			expect(calledDecision.attributes.decisionId).toBe("Decision_1");
			expect(calledDecision.attributes.resultVariable).toBe("outcome");
		});
	});

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
			);

			// 6 elements: s, gw1, t-yes, t-no, merge, e
			expect(process.flowElements).toHaveLength(6);

			// Flows: s→gw1, gw1→t-yes(Yes), gw1→t-no(No), t-yes→merge, t-no→merge, merge→e
			expect(process.sequenceFlows).toHaveLength(6);

			// Check branch labels
			const yesBranch = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw1" && f.targetRef === "t-yes"),
			);
			expect(yesBranch.name).toBe("Yes");

			const noBranch = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw1" && f.targetRef === "t-no"),
			);
			expect(noBranch.name).toBe("No");

			// Check merge incoming
			const mergeEl = defined(process.flowElements.find((n) => n.id === "merge"));
			expect(mergeEl.incoming).toHaveLength(2);

			// Check gateway outgoing
			const gwEl = defined(process.flowElements.find((n) => n.id === "gw1"));
			expect(gwEl.outgoing).toHaveLength(2);
		});

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
			];

			let builder = Bpmn.createProcess("proc")
				.startEvent("s")
				.exclusiveGateway("gw9", { name: "Comment Action" });

			for (const [i, name] of branchNames.entries()) {
				builder = builder.branch(name, (b) =>
					b.callActivity(`ca-${i}`, { processId: `Process_${i}`, name }).connectTo("gw-merge"),
				);
			}

			const process = firstProcess(builder.exclusiveGateway("gw-merge").endEvent("e").build());

			// 2 gateways + 9 call activities + start + end = 13
			expect(process.flowElements).toHaveLength(13);

			// s→gw9 + 9*(gw9→ca + ca→merge) + merge→e = 1 + 18 + 1 = 20
			expect(process.sequenceFlows).toHaveLength(20);

			// Verify merge gateway has 9 incoming flows
			const mergeEl = defined(process.flowElements.find((n) => n.id === "gw-merge"));
			expect(mergeEl.incoming).toHaveLength(9);

			// Verify fork gateway has 9 outgoing flows
			const gwEl = defined(process.flowElements.find((n) => n.id === "gw9"));
			expect(gwEl.outgoing).toHaveLength(9);

			// Verify each branch label
			for (const name of branchNames) {
				const flow = process.sequenceFlows.find((f) => f.sourceRef === "gw9" && f.name === name);
				expect(flow, `Expected branch flow labeled "${name}"`).toBeDefined();
			}
		});

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
			);

			// Verify the structure is valid
			expect(process.flowElements).toHaveLength(6);
			expect(process.sequenceFlows).toHaveLength(6);
		});
	});

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
			);

			expect(process.flowElements).toHaveLength(6);
			expect(process.sequenceFlows).toHaveLength(6);

			const joinEl = defined(process.flowElements.find((n) => n.id === "join"));
			expect(joinEl.type).toBe("parallelGateway");
			expect(joinEl.incoming).toHaveLength(2);

			const forkEl = defined(process.flowElements.find((n) => n.id === "fork"));
			expect(forkEl.type).toBe("parallelGateway");
			expect(forkEl.outgoing).toHaveLength(2);
		});

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
			);

			expect(process.flowElements).toHaveLength(7); // s, fork, t1, t2, t3, join, e
			expect(process.sequenceFlows).toHaveLength(8); // s→fork, 3*(fork→t + t→join), join→e
		});

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
			);

			expect(process.flowElements).toHaveLength(7); // s, fork, t1, t2, t3, join, e
			expect(process.sequenceFlows).toHaveLength(8); // s→fork, 3*(fork→t + t→join), join→e

			const joinEl = defined(process.flowElements.find((n) => n.id === "join"));
			expect(joinEl.incoming).toHaveLength(3);

			const forkEl = defined(process.flowElements.find((n) => n.id === "fork"));
			expect(forkEl.outgoing).toHaveLength(3);
		});
	});

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
			);

			const ig = defined(process.flowElements.find((n) => n.id === "ig1"));
			expect(ig.type).toBe("inclusiveGateway");
			expect(ig.name).toBe("Inclusive");
			expect(ig.outgoing).toHaveLength(2);
		});

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
			);

			const ebg = defined(process.flowElements.find((n) => n.id === "ebg1"));
			expect(ebg.type).toBe("eventBasedGateway");
			expect(ebg.name).toBe("Wait For");
			expect(ebg.outgoing).toHaveLength(2);
		});
	});

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
			);

			// Verify loop flow: retry-task → check
			const loopFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "retry-task" && f.targetRef === "check",
			);
			expect(loopFlow).toBeDefined();

			// Check gateway has 2 incoming (from start and from retry)
			const checkEl = defined(process.flowElements.find((n) => n.id === "check"));
			expect(checkEl.incoming).toHaveLength(2);
		});

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
			);

			const loopFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "fix" && f.targetRef === "process",
			);
			expect(loopFlow).toBeDefined();

			// process should have 2 incoming: from start and from fix
			const processEl = defined(process.flowElements.find((n) => n.id === "process"));
			expect(processEl.incoming).toHaveLength(2);
		});
	});

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
								.endEvent("sub-end");
						},
						{ name: "Review Steps" },
					)
					.endEvent("e")
					.build(),
			);

			const adhoc = defined(process.flowElements.find((n) => n.id === "adhoc1"));
			expect(adhoc.type).toBe("adHocSubProcess");
			expect(adhoc.name).toBe("Review Steps");

			if (adhoc.type === "adHocSubProcess") {
				expect(adhoc.flowElements).toHaveLength(3);
				expect(adhoc.sequenceFlows).toHaveLength(2);

				const subTask = defined(adhoc.flowElements.find((n) => n.id === "sub-task"));
				expect(subTask.type).toBe("serviceTask");
			}
		});

		it("creates an ad-hoc sub-process with parallel multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.adHocSubProcess(
						"adhoc-mi",
						(sub) => {
							sub.serviceTask("inner", { taskType: "review" });
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
			);

			const adhoc = defined(process.flowElements.find((n) => n.id === "adhoc-mi"));
			expect(adhoc.type).toBe("adHocSubProcess");

			if (adhoc.type === "adHocSubProcess") {
				expect(adhoc.loopCharacteristics).toBeDefined();
				const loopExt = defined(adhoc.loopCharacteristics?.extensionElements[0]);
				expect(loopExt.name).toBe("zeebe:loopCharacteristics");
				expect(loopExt.attributes.inputCollection).toBe("=items");
				expect(loopExt.attributes.inputElement).toBe("item");
			}
		});

		it("creates an ad-hoc sub-process with sequential multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.adHocSubProcess(
						"seq-mi",
						(sub) => {
							sub.serviceTask("work", { taskType: "process" });
						},
						{
							multiInstance: {
								isSequential: true,
								collection: "=records",
							},
						},
					)
					.build(),
			);

			const adhoc = defined(process.flowElements.find((n) => n.id === "seq-mi"));
			if (adhoc.type === "adHocSubProcess") {
				expect(adhoc.loopCharacteristics).toBeDefined();
			}
		});
	});

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
							sub.startEvent("sub-s").serviceTask("sub-t", { taskType: "inner" }).endEvent("sub-e");
						},
						{ name: "Embedded Sub" },
					)
					.endEvent("e")
					.build(),
			);

			const sub = defined(process.flowElements.find((n) => n.id === "sub1"));
			expect(sub.type).toBe("subProcess");
			expect(sub.name).toBe("Embedded Sub");

			if (sub.type === "subProcess") {
				expect(sub.flowElements).toHaveLength(3);
				expect(sub.sequenceFlows).toHaveLength(2);
			}
		});

		it("creates a sub-process with multi-instance", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.subProcess(
						"sub-mi",
						(sub) => {
							sub.serviceTask("batch", { taskType: "batch-work" });
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
			);

			const sub = defined(process.flowElements.find((n) => n.id === "sub-mi"));
			if (sub.type === "subProcess") {
				expect(sub.loopCharacteristics).toBeDefined();
			}
		});
	});

	// -----------------------------------------------------------------------
	// Event sub-process (aspirational)
	// -----------------------------------------------------------------------

	describe("event sub-process (aspirational)", () => {
		it("creates an event sub-process", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.eventSubProcess(
						"evtsub1",
						(sub) => {
							sub
								.startEvent("err-start", { name: "Error Start" })
								.serviceTask("handle-err", { taskType: "error-handler" })
								.endEvent("err-end");
						},
						{ name: "Error Handler" },
					)
					.endEvent("e")
					.build(),
			);

			const evtSub = defined(process.flowElements.find((n) => n.id === "evtsub1"));
			expect(evtSub.type).toBe("eventSubProcess");
			expect(evtSub.name).toBe("Error Handler");

			if (evtSub.type === "eventSubProcess") {
				expect(evtSub.flowElements).toHaveLength(3);
				expect(evtSub.sequenceFlows).toHaveLength(2);
			}
		});
	});

	// -----------------------------------------------------------------------
	// Error cases
	// -----------------------------------------------------------------------

	describe("error handling", () => {
		it("throws on duplicate element IDs", () => {
			expect(() => Bpmn.createProcess("proc").startEvent("dup").endEvent("dup").build()).toThrow(
				'Duplicate element ID "dup"',
			);
		});

		it("throws when branch() called without a preceding gateway", () => {
			expect(() =>
				Bpmn.createProcess("proc")
					.startEvent("s")
					.branch("x", (b) => b.connectTo("end")),
			).toThrow("branch() must be called after a gateway");
		});
	});

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
			);

			expect(process.flowElements.find((n) => n.id === "s")?.name).toBe("Begin");
			expect(process.flowElements.find((n) => n.id === "t1")?.name).toBe("Do Work");
			expect(process.flowElements.find((n) => n.id === "e")?.name).toBe("Finish");
		});
	});

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
			);

			// Should have a flow from t1 back to s
			const backFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "t1" && f.targetRef === "s",
			);
			expect(backFlow).toBeDefined();
		});
	});

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
			);

			expect(process.flowElements).toHaveLength(6);
			expect(process.sequenceFlows).toHaveLength(6);
		});

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
			);

			// s, gw1, a, b, gw1-merge, gw2, c, d, gw2-merge, e = 10
			expect(process.flowElements).toHaveLength(10);
		});

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
			);

			// Verify long path has sequential flows
			expect(
				process.sequenceFlows.find((f) => f.sourceRef === "t1" && f.targetRef === "t2"),
			).toBeDefined();
			expect(
				process.sequenceFlows.find((f) => f.sourceRef === "t2" && f.targetRef === "t3"),
			).toBeDefined();
			expect(
				process.sequenceFlows.find((f) => f.sourceRef === "t3" && f.targetRef === "merge"),
			).toBeDefined();
		});
	});

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
			);

			const yesFlow = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw" && f.targetRef === "approve"),
			);
			expect(yesFlow.name).toBe("yes");
			expect(yesFlow.conditionExpression).toBeDefined();
			expect(yesFlow.conditionExpression?.text).toBe("= amount > 1000");
			expect(yesFlow.conditionExpression?.attributes["xsi:type"]).toBe("bpmn:tFormalExpression");

			const noFlow = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw" && f.targetRef === "reject"),
			);
			expect(noFlow.name).toBe("no");
			expect(noFlow.conditionExpression).toBeUndefined();

			// The gateway should have the default flow set
			const gw = defined(process.flowElements.find((n) => n.id === "gw"));
			if (gw.type === "exclusiveGateway") {
				expect(gw.default).toBe(noFlow.id);
			}
		});

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
			);

			// Auto-join inserts gw_join before end
			const joinGw = process.flowElements.find((e) => e.id === "gw_join");
			expect(joinGw).toBeDefined();
			expect(joinGw?.type).toBe("exclusiveGateway");

			const skipFlow = defined(
				process.sequenceFlows.find((f) => f.sourceRef === "gw" && f.targetRef === "gw_join"),
			);
			expect(skipFlow.conditionExpression).toBeDefined();
			expect(skipFlow.conditionExpression?.text).toBe("= skip");

			// Verify join → end flow exists
			const joinToEnd = process.sequenceFlows.find(
				(f) => f.sourceRef === "gw_join" && f.targetRef === "end",
			);
			expect(joinToEnd).toBeDefined();
		});
	});

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
			);

			expect(process.flowElements).toHaveLength(6);
			// s1→t1, t1→e1, s2→t2, t2→e2
			expect(process.sequenceFlows).toHaveLength(4);

			// s2 should NOT be connected to e1
			const crossFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "e1" && f.targetRef === "s2",
			);
			expect(crossFlow).toBeUndefined();
		});

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
			);

			// t1 should have 2 outgoing
			const t1 = defined(process.flowElements.find((n) => n.id === "t1"));
			expect(t1.outgoing).toHaveLength(2);

			const t1ToE1 = process.sequenceFlows.find(
				(f) => f.sourceRef === "t1" && f.targetRef === "e1",
			);
			expect(t1ToE1).toBeDefined();

			const t1ToT2 = process.sequenceFlows.find(
				(f) => f.sourceRef === "t1" && f.targetRef === "t2",
			);
			expect(t1ToT2).toBeDefined();
		});

		it("element() throws for non-existent IDs", () => {
			expect(() => Bpmn.createProcess("proc").startEvent("s").element("nonexistent")).toThrow(
				'Element "nonexistent" not found',
			);
		});
	});

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
			);

			const boundary = defined(process.flowElements.find((n) => n.id === "boundary1"));
			expect(boundary.type).toBe("boundaryEvent");
			if (boundary.type === "boundaryEvent") {
				expect(boundary.attachedToRef).toBe("task1");
				expect(boundary.eventDefinitions).toHaveLength(1);
				expect(boundary.eventDefinitions[0]?.type).toBe("error");
			}

			// boundary → error-handler flow exists
			const boundaryFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "boundary1" && f.targetRef === "error-handler",
			);
			expect(boundaryFlow).toBeDefined();

			// No flow from main-end to boundary (boundary is disconnected)
			const badFlow = process.sequenceFlows.find(
				(f) => f.sourceRef === "main-end" && f.targetRef === "boundary1",
			);
			expect(badFlow).toBeUndefined();
		});

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
			);

			const boundary = defined(process.flowElements.find((n) => n.id === "timer-boundary"));
			if (boundary.type === "boundaryEvent") {
				expect(boundary.cancelActivity).toBe(false);
				expect(boundary.eventDefinitions).toHaveLength(1);
				expect(boundary.eventDefinitions[0]?.type).toBe("timer");
			}
		});
	});

	// -----------------------------------------------------------------------
	// Version tag
	// -----------------------------------------------------------------------

	describe("version tag", () => {
		it("sets a version tag on the process", () => {
			const process = firstProcess(Bpmn.createProcess("proc").versionTag("1.0.0").build());

			const versionExt = defined(
				process.extensionElements.find((e) => e.name === "zeebe:versionTag"),
			);
			expect(versionExt.attributes.value).toBe("1.0.0");
		});
	});

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
			);

			const start = defined(process.flowElements.find((n) => n.id === "ts"));
			if (start.type === "startEvent") {
				expect(start.eventDefinitions).toHaveLength(1);
				expect(start.eventDefinitions[0]?.type).toBe("timer");
			}
		});

		it("creates intermediate catch with timer", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("wait", { timerDuration: "PT1H" })
					.endEvent("e")
					.build(),
			);

			const ice = defined(process.flowElements.find((n) => n.id === "wait"));
			if (ice.type === "intermediateCatchEvent") {
				expect(ice.eventDefinitions).toHaveLength(1);
				expect(ice.eventDefinitions[0]?.type).toBe("timer");
			}
		});

		it("creates intermediate throw with message", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateThrowEvent("msg", { messageName: "notify" })
					.endEvent("e")
					.build(),
			);

			const ite = defined(process.flowElements.find((n) => n.id === "msg"));
			if (ite.type === "intermediateThrowEvent") {
				expect(ite.eventDefinitions).toHaveLength(1);
				expect(ite.eventDefinitions[0]?.type).toBe("message");
			}
		});
	});

	// -----------------------------------------------------------------------
	// build() returns BpmnDefinitions
	// -----------------------------------------------------------------------

	describe("build() output", () => {
		it("returns BpmnDefinitions wrapping the process", () => {
			const defs = Bpmn.createProcess("my-proc")
				.name("My Process")
				.startEvent("s")
				.endEvent("e")
				.build();

			expect(defs.id).toBe("Definitions_1");
			expect(defs.targetNamespace).toBe("http://bpmn.io/schema/bpmn");
			expect(defs.processes).toHaveLength(1);
			expect(defs.processes[0]?.id).toBe("my-proc");
			expect(defs.processes[0]?.name).toBe("My Process");
			expect(defs.namespaces.zeebe).toBe("http://camunda.org/schema/zeebe/1.0");
		});
	});

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
			);

			const el = defined(process.flowElements.find((n) => n.id === "st1"));
			expect(el.unknownAttributes["zeebe:modelerTemplate"]).toBe("template-id");
			expect(el.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("2");
			expect(el.unknownAttributes["zeebe:modelerTemplateIcon"]).toBe(
				"data:image/svg+xml;base64,abc",
			);
		});
	});

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
							sub.serviceTask("inner", { taskType: "review" });
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
			);

			const adhoc = defined(process.flowElements.find((n) => n.id === "adhoc-lc"));
			if (adhoc.type === "adHocSubProcess") {
				// Check activeElementsCollection via extension elements
				const adHocExt = defined(adhoc.extensionElements.find((e) => e.name === "zeebe:adHoc"));
				expect(adHocExt.attributes.activeElementsCollection).toBe("=elements");

				// Check loop characteristics
				expect(adhoc.loopCharacteristics).toBeDefined();
				const loopExt = defined(adhoc.loopCharacteristics?.extensionElements[0]);
				expect(loopExt.attributes.inputCollection).toBe("=items");
				expect(loopExt.attributes.inputElement).toBe("item");
				expect(loopExt.attributes.outputCollection).toBe("=results");
				expect(loopExt.attributes.outputElement).toBe("result");
			}
		});
	});

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
			);

			const start = defined(process.flowElements.find((n) => n.id === "ts"));
			if (start.type === "startEvent") {
				expect(start.eventDefinitions).toHaveLength(1);
				const td = defined(start.eventDefinitions[0]);
				expect(td.type).toBe("timer");
				if (td.type === "timer") {
					expect(td.timeDate).toBe("2026-01-01T00:00:00Z");
					expect(td.timeDuration).toBeUndefined();
				}
			}
		});

		it("preserves timerCycle on start event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("ts", { timerCycle: "R3/PT10M" })
					.endEvent("e")
					.build(),
			);

			const start = defined(process.flowElements.find((n) => n.id === "ts"));
			if (start.type === "startEvent") {
				const td = defined(start.eventDefinitions[0]);
				if (td.type === "timer") {
					expect(td.timeCycle).toBe("R3/PT10M");
					expect(td.timeDuration).toBeUndefined();
				}
			}
		});

		it("preserves timerDate on intermediate catch event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("ice", { timerDate: "2026-06-01T12:00:00Z" })
					.endEvent("e")
					.build(),
			);

			const ice = defined(process.flowElements.find((n) => n.id === "ice"));
			if (ice.type === "intermediateCatchEvent") {
				expect(ice.eventDefinitions).toHaveLength(1);
				const td = defined(ice.eventDefinitions[0]);
				expect(td.type).toBe("timer");
				if (td.type === "timer") {
					expect(td.timeDate).toBe("2026-06-01T12:00:00Z");
					expect(td.timeDuration).toBeUndefined();
				}
			}
		});

		it("preserves timerCycle on intermediate catch event", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("ice", { timerCycle: "R5/PT30M" })
					.endEvent("e")
					.build(),
			);

			const ice = defined(process.flowElements.find((n) => n.id === "ice"));
			if (ice.type === "intermediateCatchEvent") {
				const td = defined(ice.eventDefinitions[0]);
				expect(td.type).toBe("timer");
				if (td.type === "timer") {
					expect(td.timeCycle).toBe("R5/PT30M");
					expect(td.timeDuration).toBeUndefined();
				}
			}
		});

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
			);

			const bd = defined(process.flowElements.find((n) => n.id === "bd"));
			if (bd.type === "boundaryEvent") {
				expect(bd.eventDefinitions).toHaveLength(1);
				const td = defined(bd.eventDefinitions[0]);
				expect(td.type).toBe("timer");
				if (td.type === "timer") {
					expect(td.timeDate).toBe("2026-12-25T00:00:00Z");
					expect(td.timeDuration).toBeUndefined();
				}
			}
		});

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
			);

			const bd = defined(process.flowElements.find((n) => n.id === "bd"));
			if (bd.type === "boundaryEvent") {
				const td = defined(bd.eventDefinitions[0]);
				expect(td.type).toBe("timer");
				if (td.type === "timer") {
					expect(td.timeCycle).toBe("R/PT15M");
					expect(td.timeDuration).toBeUndefined();
				}
			}
		});
	});

	// -----------------------------------------------------------------------
	// Regression: event definition values stored
	// -----------------------------------------------------------------------

	describe("event definition values", () => {
		it("stores messageName as messageRef", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateThrowEvent("msg", { messageName: "order-placed" })
					.endEvent("e")
					.build(),
			);

			const ite = defined(process.flowElements.find((n) => n.id === "msg"));
			if (ite.type === "intermediateThrowEvent") {
				const def = defined(ite.eventDefinitions[0]);
				expect(def.type).toBe("message");
				if (def.type === "message") {
					expect(def.messageRef).toBe("order-placed");
				}
			}
		});

		it("stores signalName as signalRef", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateCatchEvent("sig", { signalName: "data-ready" })
					.endEvent("e")
					.build(),
			);

			const ice = defined(process.flowElements.find((n) => n.id === "sig"));
			if (ice.type === "intermediateCatchEvent") {
				const def = defined(ice.eventDefinitions[0]);
				expect(def.type).toBe("signal");
				if (def.type === "signal") {
					expect(def.signalRef).toBe("data-ready");
				}
			}
		});

		it("stores escalationCode as escalationRef", () => {
			const process = firstProcess(
				Bpmn.createProcess("proc")
					.startEvent("s")
					.intermediateThrowEvent("esc", { escalationCode: "ESC_001" })
					.endEvent("e")
					.build(),
			);

			const ite = defined(process.flowElements.find((n) => n.id === "esc"));
			if (ite.type === "intermediateThrowEvent") {
				const def = defined(ite.eventDefinitions[0]);
				expect(def.type).toBe("escalation");
				if (def.type === "escalation") {
					expect(def.escalationRef).toBe("ESC_001");
				}
			}
		});
	});

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
			).toThrow('Duplicate element ID "dup"');
		});
	});

	// -----------------------------------------------------------------------
	// Auto-layout
	// -----------------------------------------------------------------------

	describe("withAutoLayout", () => {
		it("produces empty diagrams by default", () => {
			const defs = Bpmn.createProcess("proc1").startEvent("s").endEvent("e").build();
			expect(defs.diagrams).toHaveLength(0);
		});

		it("produces DI shapes and edges for a linear flow", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.serviceTask("t", { name: "Task", taskType: "job" })
				.endEvent("e")
				.build();

			expect(defs.diagrams).toHaveLength(1);
			const diagram = defined(defs.diagrams[0]);
			expect(diagram.plane.bpmnElement).toBe("proc1");

			// 3 elements → 3 shapes
			expect(diagram.plane.shapes).toHaveLength(3);
			const shapeElements = diagram.plane.shapes.map((s) => s.bpmnElement);
			expect(shapeElements).toContain("s");
			expect(shapeElements).toContain("t");
			expect(shapeElements).toContain("e");

			// All shapes have valid bounds
			for (const shape of diagram.plane.shapes) {
				expect(shape.bounds.width).toBeGreaterThan(0);
				expect(shape.bounds.height).toBeGreaterThan(0);
			}

			// 2 sequence flows → 2 edges
			expect(diagram.plane.edges).toHaveLength(2);
			for (const edge of diagram.plane.edges) {
				expect(edge.waypoints.length).toBeGreaterThanOrEqual(2);
			}
		});

		it("produces DI for gateway branches", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.exclusiveGateway("gw")
				.branch("a", (b) => b.serviceTask("t1", { name: "A", taskType: "a" }))
				.branch("b", (b) => b.serviceTask("t2", { name: "B", taskType: "b" }))
				.exclusiveGateway("merge")
				.endEvent("e")
				.build();

			const diagram = defined(defs.diagrams[0]);
			// s, gw, t1, t2, merge, e = 6 shapes
			expect(diagram.plane.shapes.length).toBeGreaterThanOrEqual(6);
			expect(diagram.plane.edges.length).toBeGreaterThanOrEqual(4);
		});

		it("survives roundtrip: export → parse preserves DI", () => {
			const defs = Bpmn.createProcess("proc1")
				.withAutoLayout()
				.startEvent("s")
				.serviceTask("t", { name: "Task", taskType: "job" })
				.endEvent("e")
				.build();

			const xml = Bpmn.export(defs);
			const parsed = Bpmn.parse(xml);

			expect(parsed.diagrams).toHaveLength(1);
			const diagram = defined(parsed.diagrams[0]);
			expect(diagram.plane.shapes).toHaveLength(3);
			expect(diagram.plane.edges).toHaveLength(2);
		});

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
				.build();

			// First cycle: export → parse
			const xml1 = Bpmn.export(defs);
			const parsed1 = Bpmn.parse(xml1);

			// Second cycle: re-export → re-parse
			const xml2 = Bpmn.export(parsed1);
			const parsed2 = Bpmn.parse(xml2);

			const diag1 = defined(parsed1.diagrams[0]);
			const diag2 = defined(parsed2.diagrams[0]);

			// Same number of shapes and edges
			expect(diag2.plane.shapes).toHaveLength(diag1.plane.shapes.length);
			expect(diag2.plane.edges).toHaveLength(diag1.plane.edges.length);

			// Shape bounds are identical across cycles
			const sortedShapes1 = [...diag1.plane.shapes].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			);
			const sortedShapes2 = [...diag2.plane.shapes].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			);
			for (let i = 0; i < sortedShapes1.length; i++) {
				expect(sortedShapes2[i]?.bpmnElement).toBe(sortedShapes1[i]?.bpmnElement);
				expect(sortedShapes2[i]?.bounds).toEqual(sortedShapes1[i]?.bounds);
			}

			// Edge waypoints are identical across cycles
			const sortedEdges1 = [...diag1.plane.edges].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			);
			const sortedEdges2 = [...diag2.plane.edges].sort((a, b) =>
				a.bpmnElement.localeCompare(b.bpmnElement),
			);
			for (let i = 0; i < sortedEdges1.length; i++) {
				expect(sortedEdges2[i]?.bpmnElement).toBe(sortedEdges1[i]?.bpmnElement);
				expect(sortedEdges2[i]?.waypoints).toEqual(sortedEdges1[i]?.waypoints);
			}

			// XML output is stable (idempotent serialization)
			expect(xml2).toBe(xml1);
		});
	});

	// -----------------------------------------------------------------------
	// Message start event with root bpmn:message
	// -----------------------------------------------------------------------

	describe("message start event", () => {
		it("creates a root bpmn:message element when messageName is provided on start event", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", { name: "Webhook", messageName: "webhook-trigger" })
				.endEvent("e")
				.build();

			expect(defs.messages).toHaveLength(1);
			const msg = defs.messages[0];
			expect(msg).toBeDefined();
			expect(msg?.name).toBe("webhook-trigger");

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s");
			expect(start).toBeDefined();
			if (start?.type === "startEvent") {
				expect(start.eventDefinitions).toHaveLength(1);
				const msgDef = start.eventDefinitions[0];
				expect(msgDef?.type).toBe("message");
				if (msgDef?.type === "message") {
					expect(msgDef.messageRef).toBe(msg?.id);
				}
			}
		});

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
				.build();

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s");
			expect(start).toBeDefined();
			const propsExt = start?.extensionElements.find((e) => e.name === "zeebe:properties");
			expect(propsExt).toBeDefined();
			expect(propsExt?.children).toHaveLength(2);
			expect(propsExt?.children[0]?.attributes.name).toBe("inbound.type");
			expect(propsExt?.children[0]?.attributes.value).toBe("io.camunda:webhook:1");
		});

		it("supports modeler template attributes on start events", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s", {
					name: "Trigger",
					modelerTemplate: "io.camunda.connectors.webhook.v1",
					modelerTemplateVersion: "13",
				})
				.endEvent("e")
				.build();

			const start = defs.processes[0]?.flowElements.find((n) => n.id === "s");
			expect(start).toBeDefined();
			expect(start?.unknownAttributes["zeebe:modelerTemplate"]).toBe(
				"io.camunda.connectors.webhook.v1",
			);
			expect(start?.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("13");
		});
	});

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
						b.serviceTask("tool1", { name: "Tool 1", taskType: "http:1" });
						b.serviceTask("tool2", { name: "Tool 2", taskType: "slack:1" });
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
				.build();

			const process = firstProcess(defs);
			const agent = defined(process.flowElements.find((n) => n.id === "agent"));
			expect(agent.type).toBe("adHocSubProcess");

			// Check zeebe:taskDefinition
			const taskDef = agent.extensionElements.find((e) => e.name === "zeebe:taskDefinition");
			expect(taskDef).toBeDefined();
			expect(taskDef?.attributes.type).toBe("io.camunda.agenticai:aiagent-job-worker:1");

			// Check zeebe:ioMapping
			const ioMapping = agent.extensionElements.find((e) => e.name === "zeebe:ioMapping");
			expect(ioMapping).toBeDefined();
			expect(ioMapping?.children.filter((c) => c.name === "zeebe:input")).toHaveLength(2);
			expect(ioMapping?.children.filter((c) => c.name === "zeebe:output")).toHaveLength(1);

			// Check zeebe:taskHeaders
			const headers = agent.extensionElements.find((e) => e.name === "zeebe:taskHeaders");
			expect(headers).toBeDefined();
			expect(headers?.children).toHaveLength(2);

			// Check zeebe:adHoc
			const adHoc = agent.extensionElements.find((e) => e.name === "zeebe:adHoc");
			expect(adHoc).toBeDefined();
			expect(adHoc?.attributes.outputCollection).toBe("toolCallResults");
			expect(adHoc?.attributes.outputElement).toBe(
				"={id: toolCall._meta.id, name: toolCall._meta.name}",
			);

			// Check child elements
			if (agent.type === "adHocSubProcess") {
				expect(agent.flowElements).toHaveLength(2);
			}
		});

		it("supports modeler template attributes on ad-hoc sub-process", () => {
			const defs = Bpmn.createProcess("proc")
				.startEvent("s")
				.adHocSubProcess(
					"agent",
					(b) => {
						b.serviceTask("tool1", { name: "Tool", taskType: "test:1" });
					},
					{
						name: "Agent",
						modelerTemplate: "io.camunda.connectors.agenticai.v1",
						modelerTemplateVersion: "5",
						modelerTemplateIcon: "data:image/svg+xml;base64,abc",
					},
				)
				.endEvent("e")
				.build();

			const agent = defined(firstProcess(defs).flowElements.find((n) => n.id === "agent"));
			expect(agent.unknownAttributes["zeebe:modelerTemplate"]).toBe(
				"io.camunda.connectors.agenticai.v1",
			);
			expect(agent.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("5");
			expect(agent.unknownAttributes["zeebe:modelerTemplateIcon"]).toBe(
				"data:image/svg+xml;base64,abc",
			);
		});
	});

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
				.build();

			const xml = Bpmn.export(defs);
			const parsed = Bpmn.parse(xml);

			// Message should round-trip
			expect(parsed.messages).toHaveLength(1);
			expect(parsed.messages[0]?.name).toBe("wh-123");

			// zeebe:properties should round-trip
			const start = parsed.processes[0]?.flowElements.find((n) => n.id === "s");
			const propsExt = start?.extensionElements.find((e) => e.name === "zeebe:properties");
			expect(propsExt).toBeDefined();
			expect(propsExt?.children).toHaveLength(2);
		});
	});

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
			);

			const join = process.flowElements.find((e) => e.id === "gw_join");
			expect(join).toBeDefined();
			expect(join?.type).toBe("exclusiveGateway");

			// Both branches should target the join
			expect(
				process.sequenceFlows.some((f) => f.sourceRef === "t1" && f.targetRef === "gw_join"),
			).toBe(true);
			expect(
				process.sequenceFlows.some((f) => f.sourceRef === "gw" && f.targetRef === "gw_join"),
			).toBe(true);

			// Join should flow to end
			expect(
				process.sequenceFlows.some((f) => f.sourceRef === "gw_join" && f.targetRef === "end"),
			).toBe(true);
		});

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
			);

			// No auto-join should be created since "join" is already a parallelGateway
			expect(process.flowElements.find((e) => e.id === "split_join")).toBeUndefined();
		});

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
			);

			// No auto-join needed since branches go to different targets
			expect(process.flowElements.find((e) => e.id === "gw_join")).toBeUndefined();
		});
	});
});

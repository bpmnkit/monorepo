export interface DiagramSymbol {
	kind:
		| "start"
		| "end"
		| "end-error"
		| "task"
		| "gateway-exclusive"
		| "gateway-parallel"
		| "gateway-inclusive"
		| "boundary"
	label?: string
}

export interface GlossaryEntry {
	slug: string
	term: string
	shortDefinition: string
	definition: string[]
	diagram: DiagramSymbol[]
	codeExample: string
	relatedTutorialId?: string
}

export const glossary: GlossaryEntry[] = [
	{
		slug: "start-event",
		term: "Start Event",
		shortDefinition:
			"The trigger that begins a BPMN process instance — every process has at least one.",
		definition: [
			"A start event marks where a process instance begins. It's drawn as a thin-bordered circle and carries no incoming sequence flow — nothing happens before it.",
			'A start event can be a plain "none" start (triggered manually, or by starting an instance via the API), a message start (triggered when a matching message arrives), or a timer start (triggered on a schedule). A process can have more than one start event if it can begin different ways.',
		],
		diagram: [
			{ kind: "start", label: "Start" },
			{ kind: "task", label: "First Task" },
			{ kind: "end", label: "End" },
		],
		codeExample: `import { Bpmn } from "@bpmnkit/core";

Bpmn.createProcess("order-flow")
  .startEvent("start", { name: "Order Received" })
  .serviceTask("process", { taskType: "process-order" })
  .endEvent("end")
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "getting-started",
	},
	{
		slug: "end-event",
		term: "End Event",
		shortDefinition: "Marks a point where a process instance (or one of its branches) completes.",
		definition: [
			"An end event is drawn as a thick-bordered circle and has no outgoing sequence flow — the process path stops there.",
			"A process can have multiple end events, one for each distinct outcome (approved, rejected, cancelled). An error end event marks a path that terminates abnormally, distinct from a normal completion.",
		],
		diagram: [
			{ kind: "start" },
			{ kind: "task", label: "Do Work" },
			{ kind: "end", label: "Done" },
		],
		codeExample: `Bpmn.createProcess("approval")
  .startEvent("start")
  .userTask("review")
  .exclusiveGateway("gw")
  .branch("approved", (b) => b.condition("= true").endEvent("end-approved"))
  .branch("rejected", (b) => b.defaultFlow().endEvent("end-rejected"))
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "getting-started",
	},
	{
		slug: "exclusive-gateway",
		term: "Exclusive Gateway",
		shortDefinition:
			"A decision point where exactly one of several outgoing paths is taken, based on a condition.",
		definition: [
			"An exclusive gateway (drawn as a diamond with an X, or a plain diamond) routes a token down exactly one outgoing sequence flow — the first one whose condition evaluates true, or a default flow if none match.",
			"This is the BPMN equivalent of an if/else statement. Conditions are FEEL expressions evaluated against the process's variables, e.g. `= approved` or `= amount > 1000`.",
		],
		diagram: [
			{ kind: "start" },
			{ kind: "gateway-exclusive", label: "Approved?" },
			{ kind: "end", label: "Yes" },
		],
		codeExample: `Bpmn.createProcess("loan")
  .startEvent("start")
  .exclusiveGateway("gw", { name: "Approved?" })
  .branch("yes", (b) => b.condition("= approved").endEvent("end-ok"))
  .branch("no", (b) => b.defaultFlow().endEvent("end-rejected"))
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "gateways-decisions",
	},
	{
		slug: "parallel-gateway",
		term: "Parallel Gateway",
		shortDefinition:
			"Splits a process into multiple simultaneous paths that all execute, and later joins them back together.",
		definition: [
			"A parallel gateway (a diamond with a plus sign) forks the process into every outgoing path at once — all branches proceed concurrently, no condition involved.",
			"A second parallel gateway later joins the branches: it waits for a token to arrive on every incoming path before continuing. This models genuinely concurrent work, like preparing packaging and processing payment for an order at the same time.",
		],
		diagram: [
			{ kind: "start" },
			{ kind: "gateway-parallel", label: "Fork" },
			{ kind: "task", label: "Pack" },
			{ kind: "gateway-parallel", label: "Join" },
			{ kind: "end" },
		],
		codeExample: `Bpmn.createProcess("fulfillment")
  .startEvent("start")
  .parallelGateway("fork")
  .branch("pack", (b) => b.serviceTask("pack", { taskType: "packaging" }))
  .branch("charge", (b) => b.serviceTask("charge", { taskType: "payment" }))
  .join("join")
  .endEvent("end")
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "parallel-work",
	},
	{
		slug: "inclusive-gateway",
		term: "Inclusive Gateway",
		shortDefinition:
			"Splits a process into one or more of several paths — any combination of conditions that evaluate true is taken.",
		definition: [
			'An inclusive gateway (a diamond with a circle) sits between an exclusive gateway\'s "pick exactly one" and a parallel gateway\'s "take all paths": every outgoing flow whose condition is true is activated, and the matching join waits only for the branches that were actually taken.',
			"It models scenarios like a support ticket that might need escalation, a refund, or both, depending on independent conditions.",
		],
		diagram: [
			{ kind: "start" },
			{ kind: "gateway-inclusive", label: "Which apply?" },
			{ kind: "task", label: "Escalate" },
			{ kind: "end" },
		],
		codeExample: `Bpmn.createProcess("ticket")
  .startEvent("start")
  .inclusiveGateway("gw", { name: "Which apply?" })
  .branch("escalate", (b) => b.condition("= severity = \\"high\\"").serviceTask("escalate", { taskType: "escalate" }))
  .branch("refund", (b) => b.condition("= refundRequested").serviceTask("refund", { taskType: "refund" }))
  .join("join")
  .endEvent("end")
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "inclusive-gateways",
	},
	{
		slug: "service-task",
		term: "Service Task",
		shortDefinition:
			"An automated step executed by a worker — code, not a human, performs the work.",
		definition: [
			"A service task (a rounded rectangle with a gear icon) represents work performed automatically — calling an API, running a calculation, sending an email. On Camunda 8 / Zeebe, a service task has a job type; a worker process polls for jobs of that type and completes them.",
			"Service tasks are the most common way to integrate external systems into a BPMN process, whether via a hand-written worker or a pre-built connector.",
		],
		diagram: [{ kind: "start" }, { kind: "task", label: "Charge Card" }, { kind: "end" }],
		codeExample: `Bpmn.createProcess("payment")
  .startEvent("start")
  .serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
  .endEvent("end")
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "service-tasks",
	},
	{
		slug: "user-task",
		term: "User Task",
		shortDefinition:
			"A step in the process that waits for a human to complete a form or make a decision.",
		definition: [
			"A user task (a rounded rectangle with a person icon) represents work assigned to a human — reviewing a request, approving an expense, entering data into a form. The process pauses at a user task until someone completes it.",
			"User tasks are commonly linked to a form (Camunda Forms or an embedded form definition) that defines what fields the assignee fills in.",
		],
		diagram: [
			{ kind: "start" },
			{ kind: "task", label: "Review" },
			{ kind: "gateway-exclusive", label: "Approved?" },
			{ kind: "end" },
		],
		codeExample: `Bpmn.createProcess("approval")
  .startEvent("start")
  .userTask("review", { name: "Review Request", formId: "ReviewForm" })
  .exclusiveGateway("gw", { name: "Approved?" })
  .branch("yes", (b) => b.condition("= approved").endEvent("end-ok"))
  .branch("no", (b) => b.defaultFlow().endEvent("end-rejected"))
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "getting-started",
	},
	{
		slug: "sub-process",
		term: "Sub-Process",
		shortDefinition:
			"A self-contained group of elements nested inside a parent process, used to structure or reuse logic.",
		definition: [
			'A sub-process (drawn as a rounded rectangle with a small "+" that expands to reveal its own start event, flow, and end event) groups a set of steps as a single unit inside a larger process. It can have its own gateways and branches, and can attach boundary events that apply to the whole group.',
			"Sub-processes are useful for keeping a large process diagram readable, and for scoping error handling — a boundary event on a sub-process catches errors from anything inside it.",
		],
		diagram: [{ kind: "start" }, { kind: "task", label: "Sub-Process" }, { kind: "end" }],
		codeExample: `Bpmn.createProcess("onboarding")
  .startEvent("start")
  .subProcess("setup", (p) =>
    p.startEvent("sub-start")
      .serviceTask("create-account", { taskType: "create-account" })
      .serviceTask("provision", { taskType: "provision-access" })
      .endEvent("sub-end")
  )
  .endEvent("end")
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "sub-processes",
	},
	{
		slug: "boundary-event",
		term: "Boundary Event",
		shortDefinition:
			"An event attached to a task's edge that interrupts it — commonly used for errors, timeouts, and cancellations.",
		definition: [
			"A boundary event is drawn as a small circle sitting on the border of a task or sub-process. It catches an event — an error, a timeout, a message — while that task is active, and diverts the token onto a separate path.",
			"An interrupting boundary event (solid circle) cancels the task it's attached to when it fires; a non-interrupting one (dashed circle) lets the task keep running alongside the new path. Error boundary events are the standard way to model failure handling in BPMN.",
		],
		diagram: [
			{ kind: "start" },
			{ kind: "task", label: "Charge Card" },
			{ kind: "boundary", label: "On Fail" },
			{ kind: "end-error" },
		],
		codeExample: `Bpmn.createProcess("payment-flow")
  .startEvent("start")
  .serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
  .withBoundary("on-fail", { errorCode: "PAYMENT_FAILED" }, (p) =>
    p.serviceTask("notify", { taskType: "send-email" }).endEvent("end-failed"),
  )
  // main flow continues from "charge" — not from the boundary
  .serviceTask("fulfill", { taskType: "warehouse-pick" })
  .endEvent("end-ok")
  .withAutoLayout()
  .build();`,
		relatedTutorialId: "error-handling",
	},
]

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
	return glossary.find((e) => e.slug === slug)
}

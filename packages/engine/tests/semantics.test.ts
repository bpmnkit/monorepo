import { Bpmn } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnFlowElement, BpmnSequenceFlow } from "@bpmnkit/core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Engine } from "../src/engine.js"
import type { ProcessInstance } from "../src/instance.js"
import type { Job, ProcessEvent } from "../src/types.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fill incoming/outgoing from the sequence flows so the XML below can leave them out. */
function wire(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): void {
	for (const el of elements) {
		el.incoming = flows.filter((f) => f.targetRef === el.id).map((f) => f.id)
		el.outgoing = flows.filter((f) => f.sourceRef === el.id).map((f) => f.id)
		if ("flowElements" in el) wire(el.flowElements, el.sequenceFlows)
	}
}

function parse(body: string): BpmnDefinitions {
	const defs = Bpmn.parse(`<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Defs" targetNamespace="http://bpmn.io/schema/bpmn">
${body}
</bpmn:definitions>`)
	for (const p of defs.processes) wire(p.flowElements, p.sequenceFlows)
	return defs
}

function flow(id: string, source: string, target: string, condition?: string): string {
	const cond =
		condition !== undefined
			? `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${condition}</bpmn:conditionExpression>`
			: ""
	return `<bpmn:sequenceFlow id="${id}" sourceRef="${source}" targetRef="${target}">${cond}</bpmn:sequenceFlow>`
}

function job(id: string, type: string, extra = ""): string {
	return `<bpmn:serviceTask id="${id}"><bpmn:extensionElements><zeebe:taskDefinition type="${type}"/>${extra}</bpmn:extensionElements></bpmn:serviceTask>`
}

function timer(kind: "timeDuration" | "timeCycle", value: string): string {
	return `<bpmn:timerEventDefinition><bpmn:${kind}>${value}</bpmn:${kind}></bpmn:timerEventDefinition>`
}

interface Run {
	engine: Engine
	instance: ProcessInstance
	events: ProcessEvent[]
}

function run(
	xml: string,
	processId: string,
	vars: Record<string, unknown> = {},
	setup?: (engine: Engine) => void,
): Run {
	const engine = new Engine()
	engine.deploy({ bpmn: parse(xml) })
	setup?.(engine)
	const instance = engine.start(processId, vars)
	const events: ProcessEvent[] = []
	instance.onChange((e) => events.push(e))
	return { engine, instance, events }
}

function entered(events: ProcessEvent[]): string[] {
	return events.flatMap((e) => (e.type === "element:entered" ? [e.elementId] : []))
}

function terminated(events: ProcessEvent[]): string[] {
	return events.flatMap((e) => (e.type === "element:terminated" ? [e.elementId] : []))
}

/** Let every pending promise settle; setImmediate is not faked by the timer tests. */
function flush(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve))
}

async function advance(ms: number): Promise<void> {
	vi.advanceTimersByTime(ms)
	await flush()
}

/** A worker that keeps every job so the test decides when it completes. */
function holdJobs(engine: Engine, type: string): Job[] {
	const jobs: Job[] = []
	engine.registerJobWorker(type, (j) => {
		jobs.push(j)
	})
	return jobs
}

afterEach(() => {
	vi.useRealTimers()
})

function useFakeTimers(): void {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
}

// ── Boundary events ───────────────────────────────────────────────────────────

function boundaryProcess(boundaryAttrs: string, definition: string, messages = ""): string {
	return `${messages}
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  ${job("work", "hold")}
  <bpmn:boundaryEvent id="b" attachedToRef="work" ${boundaryAttrs}>${definition}</bpmn:boundaryEvent>
  <bpmn:endEvent id="done"/>
  <bpmn:endEvent id="side"/>
  ${flow("f1", "start", "work")}
  ${flow("f2", "work", "done")}
  ${flow("f3", "b", "side")}
</bpmn:process>`
}

describe("timer boundary events", () => {
	it("non-interrupting: the activity keeps running and the boundary path runs", async () => {
		useFakeTimers()
		let jobs: Job[] = []
		const { instance, events } = run(
			boundaryProcess('cancelActivity="false"', timer("timeDuration", "PT1S")),
			"p",
			{},
			(engine) => {
				jobs = holdJobs(engine, "hold")
			},
		)
		await flush()
		await advance(1000)

		expect(entered(events)).toContain("side")
		expect(instance.activeElements).toEqual(["work"])
		expect(instance.state).toBe("active")

		jobs[0]?.complete()
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toContain("done")
	})

	it("non-interrupting cycle fires once per repetition while the activity runs", async () => {
		useFakeTimers()
		let jobs: Job[] = []
		const { instance, events } = run(
			boundaryProcess('cancelActivity="false"', timer("timeCycle", "R3/PT1S")),
			"p",
			{},
			(engine) => {
				jobs = holdJobs(engine, "hold")
			},
		)
		await flush()
		await advance(10_000)
		expect(entered(events).filter((id) => id === "b")).toHaveLength(3)
		jobs[0]?.complete()
		await flush()
		expect(instance.state).toBe("completed")
	})

	it("interrupting: the activity is terminated and a late job result is ignored", async () => {
		useFakeTimers()
		let jobs: Job[] = []
		const { instance, events } = run(
			boundaryProcess("", timer("timeDuration", "PT1S")),
			"p",
			{},
			(engine) => {
				jobs = holdJobs(engine, "hold")
			},
		)
		await flush()
		await advance(1000)
		expect(instance.state).toBe("completed")
		expect(terminated(events)).toEqual(["work"])

		jobs[0]?.complete({ late: true })
		await flush()
		expect(entered(events)).not.toContain("done")
		expect(instance.variables_snapshot).not.toHaveProperty("late")
	})
})

describe("message boundary events", () => {
	const message = '<bpmn:message id="Msg_cancel" name="cancel-order"/>'
	const def = '<bpmn:messageEventDefinition messageRef="Msg_cancel"/>'

	it("interrupting: a delivered message ends the activity and takes the boundary path", async () => {
		const { instance, events } = run(boundaryProcess("", def, message), "p", {}, (engine) => {
			holdJobs(engine, "hold")
		})
		await flush()
		expect(instance.deliverMessage("cancel-order", { reason: "customer" })).toBe(true)
		await flush()
		expect(instance.state).toBe("completed")
		expect(terminated(events)).toEqual(["work"])
		expect(entered(events)).toContain("side")
		expect(instance.variables_snapshot).toMatchObject({ reason: "customer" })
	})

	it("non-interrupting: the boundary path runs beside the activity, as often as messages come", async () => {
		let jobs: Job[] = []
		const { instance, events } = run(
			boundaryProcess('cancelActivity="false"', def, message),
			"p",
			{},
			(engine) => {
				jobs = holdJobs(engine, "hold")
			},
		)
		await flush()
		// The message is addressable by its id as well as its name.
		instance.deliverMessage("cancel-order")
		instance.deliverMessage("Msg_cancel")
		await flush()
		expect(entered(events).filter((id) => id === "side")).toHaveLength(2)
		expect(instance.activeElements).toEqual(["work"])

		jobs[0]?.complete()
		await flush()
		expect(instance.state).toBe("completed")
		// Nothing waits any more.
		expect(instance.deliverMessage("cancel-order")).toBe(false)
	})
})

describe("error boundary on a job", () => {
	it("job.throwError is caught by an error boundary event on the task", async () => {
		const { instance, events } = run(
			boundaryProcess(
				"",
				'<bpmn:errorEventDefinition errorRef="Err_1"/>',
				'<bpmn:error id="Err_1" errorCode="PAYMENT_DECLINED"/>',
			),
			"p",
			{},
			(engine) => {
				engine.registerJobWorker("hold", (j) => j.throwError("PAYMENT_DECLINED", "declined"))
			},
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toContain("side")
	})

	it("an uncaught job error still fails the instance with its message", async () => {
		const { instance } = run(
			boundaryProcess(
				"",
				'<bpmn:errorEventDefinition errorRef="Err_1"/>',
				'<bpmn:error id="Err_1" errorCode="OTHER"/>',
			),
			"p",
			{},
			(engine) => {
				engine.registerJobWorker("hold", (j) => j.throwError("PAYMENT_DECLINED", "declined"))
			},
		)
		await flush()
		expect(instance.state).toBe("failed")
		expect(instance.error).toBe("declined")
	})
})

// ── Event-based gateway ───────────────────────────────────────────────────────

describe("event-based gateway", () => {
	const xml = `<bpmn:message id="Msg_paid" name="paid"/>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:eventBasedGateway id="gw"/>
  <bpmn:intermediateCatchEvent id="onPaid"><bpmn:messageEventDefinition messageRef="Msg_paid"/></bpmn:intermediateCatchEvent>
  <bpmn:intermediateCatchEvent id="onTimeout">${timer("timeDuration", "PT10M")}</bpmn:intermediateCatchEvent>
  <bpmn:endEvent id="paidEnd"/>
  <bpmn:endEvent id="timeoutEnd"/>
  ${flow("f1", "start", "gw")}
  ${flow("f2", "gw", "onPaid")}
  ${flow("f3", "gw", "onTimeout")}
  ${flow("f4", "onPaid", "paidEnd")}
  ${flow("f5", "onTimeout", "timeoutEnd")}
</bpmn:process>`

	it("the message wins and the timer is cancelled", async () => {
		useFakeTimers()
		const { instance, events } = run(xml, "p")
		await flush()
		expect(instance.activeElements).toEqual(["gw"])
		instance.deliverMessage("paid", { amount: 5 })
		await flush()
		expect(instance.state).toBe("completed")
		await advance(20 * 60_000)
		expect(entered(events)).toEqual(["start", "gw", "onPaid", "paidEnd"])
		expect(instance.variables_snapshot).toMatchObject({ amount: 5 })
	})

	it("the timer wins and the message subscription is closed", async () => {
		useFakeTimers()
		const { instance, events } = run(xml, "p")
		await flush()
		await advance(10 * 60_000)
		expect(instance.state).toBe("completed")
		expect(entered(events)).toEqual(["start", "gw", "onTimeout", "timeoutEnd"])
		expect(instance.deliverMessage("paid")).toBe(false)
	})
})

// ── Call activities ───────────────────────────────────────────────────────────

describe("call activity", () => {
	function callXml(calledElement: string, ioMapping = ""): string {
		return `<bpmn:error id="Err_child" errorCode="CHILD_ERR"/>
<bpmn:process id="parent" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:callActivity id="call"><bpmn:extensionElements>${calledElement}${ioMapping}</bpmn:extensionElements></bpmn:callActivity>
  <bpmn:boundaryEvent id="onChildError" attachedToRef="call"><bpmn:errorEventDefinition errorRef="Err_child"/></bpmn:boundaryEvent>
  <bpmn:endEvent id="done"/>
  <bpmn:endEvent id="handled"/>
  ${flow("f1", "start", "call")}
  ${flow("f2", "call", "done")}
  ${flow("f3", "onChildError", "handled")}
</bpmn:process>
<bpmn:process id="child" isExecutable="true">
  <bpmn:startEvent id="cStart"/>
  ${job("double", "double")}
  <bpmn:exclusiveGateway id="cGw" default="cf4"/>
  <bpmn:endEvent id="cEnd"/>
  <bpmn:endEvent id="cError"><bpmn:errorEventDefinition errorRef="Err_child"/></bpmn:endEvent>
  ${flow("cf1", "cStart", "double")}
  ${flow("cf2", "double", "cGw")}
  ${flow("cf3", "cGw", "cError", "= result > 100")}
  ${flow("cf4", "cGw", "cEnd")}
</bpmn:process>`
	}

	function doubler(seen?: Array<Record<string, unknown>>): (engine: Engine) => void {
		return (engine) => {
			engine.registerJobWorker("double", (j) => {
				seen?.push(j.variables)
				j.complete({ result: (j.variables.x as number) * 2 })
			})
		}
	}

	it("runs the deployed process as a child and propagates all its variables back", async () => {
		const { instance, events } = run(
			callXml('<zeebe:calledElement processId="child"/>'),
			"parent",
			{ x: 2 },
			doubler(),
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toMatchObject({ x: 2, result: 4 })
		expect(entered(events)).toEqual(["start", "call", "done"])
	})

	it("resolves a FEEL processId", async () => {
		const { instance } = run(
			callXml('<zeebe:calledElement processId="= target"/>'),
			"parent",
			{ x: 3, target: "child" },
			doubler(),
		)
		await flush()
		expect(instance.variables_snapshot).toMatchObject({ result: 6 })
	})

	it("propagateAllChildVariables=false without output mappings returns nothing", async () => {
		const { instance } = run(
			callXml('<zeebe:calledElement processId="child" propagateAllChildVariables="false"/>'),
			"parent",
			{ x: 2 },
			doubler(),
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).not.toHaveProperty("result")
	})

	it("output mappings pick what reaches the caller; input mappings feed the child", async () => {
		const seen: Array<Record<string, unknown>> = []
		const { instance } = run(
			callXml(
				'<zeebe:calledElement processId="child" propagateAllParentVariables="false"/>',
				'<zeebe:ioMapping><zeebe:input source="= amount" target="x"/><zeebe:output source="= result" target="doubled"/></zeebe:ioMapping>',
			),
			"parent",
			{ amount: 21, secret: "s" },
			doubler(seen),
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(seen[0]).toEqual({ x: 21 })
		expect(instance.variables_snapshot).toMatchObject({ doubled: 42 })
		expect(instance.variables_snapshot).not.toHaveProperty("result")
	})

	it("an error the child does not catch is caught by a boundary event on the call activity", async () => {
		const { instance, events } = run(
			callXml('<zeebe:calledElement processId="child"/>'),
			"parent",
			{ x: 60 },
			doubler(),
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toContain("handled")
		expect(entered(events)).not.toContain("done")
	})

	it("a failed job in the child fails the caller", async () => {
		const { instance } = run(
			callXml('<zeebe:calledElement processId="child"/>'),
			"parent",
			{ x: 1 },
			(engine) => engine.registerJobWorker("double", (j) => j.fail("worker down")),
		)
		await flush()
		expect(instance.state).toBe("failed")
		expect(instance.error).toBe("worker down")
	})

	it("messages reach a waiting child through the parent", async () => {
		const xml = `<bpmn:message id="Msg_go" name="go"/>
<bpmn:process id="parent" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:callActivity id="call"><bpmn:extensionElements><zeebe:calledElement processId="child"/></bpmn:extensionElements></bpmn:callActivity>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "call")}
  ${flow("f2", "call", "done")}
</bpmn:process>
<bpmn:process id="child" isExecutable="true">
  <bpmn:startEvent id="cStart"/>
  <bpmn:intermediateCatchEvent id="wait"><bpmn:messageEventDefinition messageRef="Msg_go"/></bpmn:intermediateCatchEvent>
  <bpmn:endEvent id="cEnd"/>
  ${flow("cf1", "cStart", "wait")}
  ${flow("cf2", "wait", "cEnd")}
</bpmn:process>`
		const { instance } = run(xml, "parent")
		await flush()
		expect(instance.state).toBe("active")
		expect(instance.deliverMessage("go", { token: "t" })).toBe(true)
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toMatchObject({ token: "t" })
	})

	it("a process that is not deployed completes the call activity with a warning", async () => {
		const { instance, events } = run(
			callXml('<zeebe:calledElement processId="missing"/>'),
			"parent",
			{ x: 1 },
		)
		await flush()
		expect(instance.state).toBe("completed")
		const warning = events.find((e) => e.type === "element:warning")
		expect(warning).toMatchObject({ elementId: "call" })
		expect(warning?.type === "element:warning" && warning.message).toContain('"missing"')
	})
})

// ── Event sub-processes ───────────────────────────────────────────────────────

describe("event sub-processes", () => {
	it("interrupting message start: the main flow is terminated", async () => {
		const xml = `<bpmn:message id="Msg_abort" name="abort"/>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  ${job("work", "hold")}
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "work")}
  ${flow("f2", "work", "done")}
  <bpmn:subProcess id="esp" triggeredByEvent="true">
    <bpmn:startEvent id="espStart"><bpmn:messageEventDefinition messageRef="Msg_abort"/></bpmn:startEvent>
    <bpmn:endEvent id="espEnd"/>
    ${flow("ef1", "espStart", "espEnd")}
  </bpmn:subProcess>
</bpmn:process>`
		let jobs: Job[] = []
		const { instance, events } = run(xml, "p", {}, (engine) => {
			jobs = holdJobs(engine, "hold")
		})
		await flush()
		instance.deliverMessage("abort")
		await flush()
		expect(instance.state).toBe("completed")
		expect(terminated(events)).toEqual(["work"])
		expect(entered(events)).toEqual(["start", "work", "esp", "espStart", "espEnd"])
		jobs[0]?.complete()
		await flush()
		expect(entered(events)).not.toContain("done")
	})

	it("non-interrupting timer start: runs beside the main flow", async () => {
		useFakeTimers()
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  ${job("work", "hold")}
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "work")}
  ${flow("f2", "work", "done")}
  <bpmn:subProcess id="esp" triggeredByEvent="true">
    <bpmn:startEvent id="espStart" isInterrupting="false">${timer("timeDuration", "PT1M")}</bpmn:startEvent>
    <bpmn:endEvent id="espEnd"/>
    ${flow("ef1", "espStart", "espEnd")}
  </bpmn:subProcess>
</bpmn:process>`
		let jobs: Job[] = []
		const { instance, events } = run(xml, "p", {}, (engine) => {
			jobs = holdJobs(engine, "hold")
		})
		await flush()
		await advance(60_000)
		expect(entered(events)).toContain("espEnd")
		expect(instance.activeElements).toEqual(["work"])
		jobs[0]?.complete()
		await flush()
		expect(instance.state).toBe("completed")
		expect(terminated(events)).toEqual([])
	})

	it("an error event sub-process inside a sub-process catches a job error", async () => {
		const xml = `<bpmn:error id="Err_1" errorCode="BOOM"/>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:subProcess id="sub">
    <bpmn:startEvent id="subStart"/>
    ${job("work", "explode")}
    <bpmn:endEvent id="subEnd"/>
    ${flow("sf1", "subStart", "work")}
    ${flow("sf2", "work", "subEnd")}
    <bpmn:subProcess id="onError" triggeredByEvent="true">
      <bpmn:startEvent id="errStart"><bpmn:errorEventDefinition errorRef="Err_1"/></bpmn:startEvent>
      <bpmn:scriptTask id="note"><bpmn:extensionElements><zeebe:script expression="= &quot;recovered&quot;" resultVariable="status"/></bpmn:extensionElements></bpmn:scriptTask>
      <bpmn:endEvent id="errEnd"/>
      ${flow("ef1", "errStart", "note")}
      ${flow("ef2", "note", "errEnd")}
    </bpmn:subProcess>
  </bpmn:subProcess>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "sub")}
  ${flow("f2", "sub", "done")}
</bpmn:process>`
		const { instance, events } = run(xml, "p", { status: "new" }, (engine) => {
			engine.registerJobWorker("explode", (j) => j.throwError("BOOM", "exploded"))
		})
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toContain("errEnd")
		expect(entered(events)).toContain("done")
		expect(instance.variables_snapshot).toMatchObject({ status: "recovered" })
	})

	it("a non-interrupting escalation event sub-process runs while the thrower continues", async () => {
		const xml = `<bpmn:escalation id="Esc_1" escalationCode="LATE"/>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:intermediateThrowEvent id="raise"><bpmn:escalationEventDefinition escalationRef="Esc_1"/></bpmn:intermediateThrowEvent>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "raise")}
  ${flow("f2", "raise", "done")}
  <bpmn:subProcess id="esp" triggeredByEvent="true">
    <bpmn:startEvent id="escStart" isInterrupting="false"><bpmn:escalationEventDefinition escalationRef="Esc_1"/></bpmn:startEvent>
    <bpmn:endEvent id="escEnd"/>
    ${flow("ef1", "escStart", "escEnd")}
  </bpmn:subProcess>
</bpmn:process>`
		const { instance, events } = run(xml, "p")
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toContain("escEnd")
		expect(entered(events)).toContain("done")
	})
})

// ── Signals and escalations ───────────────────────────────────────────────────

describe("signals", () => {
	const signal = '<bpmn:signal id="Sig_go" name="go"/>'
	const waiter = `<bpmn:process id="waiter" isExecutable="true">
  <bpmn:startEvent id="wStart"/>
  <bpmn:intermediateCatchEvent id="wait"><bpmn:signalEventDefinition signalRef="Sig_go"/></bpmn:intermediateCatchEvent>
  <bpmn:endEvent id="wEnd"/>
  ${flow("wf1", "wStart", "wait")}
  ${flow("wf2", "wait", "wEnd")}
</bpmn:process>`

	it("engine.broadcastSignal reaches every waiting instance and passes variables", async () => {
		const engine = new Engine()
		engine.deploy({ bpmn: parse(`${signal}${waiter}`) })
		const a = engine.start("waiter")
		const b = engine.start("waiter")
		await flush()
		expect(a.state).toBe("active")
		engine.broadcastSignal("go", { at: 1 })
		await flush()
		expect(a.state).toBe("completed")
		expect(b.state).toBe("completed")
		expect(a.variables_snapshot).toMatchObject({ at: 1 })
	})

	it("a signal throw event in one instance releases another; a signal start event starts one", async () => {
		const engine = new Engine()
		engine.deploy({
			bpmn: parse(`${signal}${waiter}
<bpmn:process id="thrower" isExecutable="true">
  <bpmn:startEvent id="tStart"/>
  <bpmn:intermediateThrowEvent id="shout"><bpmn:signalEventDefinition signalRef="Sig_go"/></bpmn:intermediateThrowEvent>
  <bpmn:endEvent id="tEnd"/>
  ${flow("tf1", "tStart", "shout")}
  ${flow("tf2", "shout", "tEnd")}
</bpmn:process>
<bpmn:process id="listener" isExecutable="true">
  <bpmn:startEvent id="lStart"><bpmn:signalEventDefinition signalRef="Sig_go"/></bpmn:startEvent>
  <bpmn:endEvent id="lEnd"/>
  ${flow("lf1", "lStart", "lEnd")}
</bpmn:process>`),
		})
		const waiting = engine.start("waiter")
		await flush()
		const thrower = engine.start("thrower")
		await flush()
		expect(thrower.state).toBe("completed")
		expect(waiting.state).toBe("completed")

		const started = engine.broadcastSignal("go")
		expect(started.map((i) => i.processId)).toEqual(["listener"])
		await flush()
		expect(started[0]?.state).toBe("completed")
	})

	it("an interrupting signal boundary event ends the activity", async () => {
		const engine = new Engine()
		engine.deploy({
			bpmn: parse(boundaryProcess("", '<bpmn:signalEventDefinition signalRef="Sig_go"/>', signal)),
		})
		holdJobs(engine, "hold")
		const instance = engine.start("p")
		await flush()
		expect(instance.deliverSignal("go")).toBe(true)
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.deliverSignal("go")).toBe(false)
	})
})

describe("escalations", () => {
	function escalationXml(cancelActivity: string): string {
		return `<bpmn:escalation id="Esc_1" escalationCode="LATE"/>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:subProcess id="sub">
    <bpmn:startEvent id="subStart"/>
    <bpmn:intermediateThrowEvent id="raise"><bpmn:escalationEventDefinition escalationRef="Esc_1"/></bpmn:intermediateThrowEvent>
    <bpmn:endEvent id="subEnd"/>
    ${flow("sf1", "subStart", "raise")}
    ${flow("sf2", "raise", "subEnd")}
  </bpmn:subProcess>
  <bpmn:boundaryEvent id="onLate" attachedToRef="sub" ${cancelActivity}><bpmn:escalationEventDefinition escalationRef="Esc_1"/></bpmn:boundaryEvent>
  <bpmn:endEvent id="done"/>
  <bpmn:endEvent id="escalated"/>
  ${flow("f1", "start", "sub")}
  ${flow("f2", "sub", "done")}
  ${flow("f3", "onLate", "escalated")}
</bpmn:process>`
	}

	it("a non-interrupting boundary on the sub-process catches it and the sub-process continues", async () => {
		const { instance, events } = run(escalationXml('cancelActivity="false"'), "p")
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toEqual(
			expect.arrayContaining(["escalated", "subEnd", "done", "onLate"]),
		)
		expect(terminated(events)).toEqual([])
	})

	it("an interrupting boundary terminates the sub-process", async () => {
		const { instance, events } = run(escalationXml(""), "p")
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toContain("escalated")
		expect(entered(events)).not.toContain("subEnd")
		expect(entered(events)).not.toContain("done")
		expect(terminated(events)).toContain("sub")
	})

	it("an escalation nobody catches does not stop the thrower", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:intermediateThrowEvent id="raise"><bpmn:escalationEventDefinition/></bpmn:intermediateThrowEvent>
  <bpmn:endEvent id="done"><bpmn:escalationEventDefinition/></bpmn:endEvent>
  ${flow("f1", "start", "raise")}
  ${flow("f2", "raise", "done")}
</bpmn:process>`
		const { instance } = run(xml, "p")
		await flush()
		expect(instance.state).toBe("completed")
	})
})

// ── Multi-instance ────────────────────────────────────────────────────────────

describe("multi-instance", () => {
	function miXml(attrs: string, zeebe: string, inner = ""): string {
		return `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:serviceTask id="each">
    <bpmn:extensionElements><zeebe:taskDefinition type="w"/></bpmn:extensionElements>
    <bpmn:multiInstanceLoopCharacteristics ${attrs}>
      <bpmn:extensionElements>${zeebe}</bpmn:extensionElements>${inner}
    </bpmn:multiInstanceLoopCharacteristics>
  </bpmn:serviceTask>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "each")}
  ${flow("f2", "each", "done")}
</bpmn:process>`
	}
	const collect =
		'<zeebe:loopCharacteristics inputCollection="= items" inputElement="item" outputCollection="results" outputElement="= result"/>'

	it("parallel: one job per item, outputs collected in input order", async () => {
		let jobs: Job[] = []
		const { instance } = run(miXml("", collect), "p", { items: [1, 2, 3] }, (engine) => {
			jobs = holdJobs(engine, "w")
		})
		await flush()
		expect(jobs.map((j) => j.variables.item)).toEqual([1, 2, 3])
		// Complete out of order — the collection still follows the input order.
		for (const j of [...jobs].reverse()) j.complete({ result: (j.variables.item as number) * 10 })
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toMatchObject({ results: [10, 20, 30] })
		expect(instance.variables_snapshot).not.toHaveProperty("item")
	})

	it("sequential: one job at a time, with loopCounter", async () => {
		const seen: unknown[] = []
		const { instance } = run(
			miXml('isSequential="true"', collect),
			"p",
			{ items: ["a", "b"] },
			(engine) => {
				engine.registerJobWorker("w", (j) => {
					seen.push([j.variables.item, j.variables.loopCounter])
					j.complete({ result: `${String(j.variables.item)}!` })
				})
			},
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(seen).toEqual([
			["a", 1],
			["b", 2],
		])
		expect(instance.variables_snapshot).toMatchObject({ results: ["a!", "b!"] })
	})

	it("loopCardinality runs a fixed number of iterations", async () => {
		const counters: unknown[] = []
		const { instance } = run(
			miXml('isSequential="true"', "", "<bpmn:loopCardinality>3</bpmn:loopCardinality>"),
			"p",
			{},
			(engine) => {
				engine.registerJobWorker("w", (j) => {
					counters.push(j.variables.loopCounter)
					j.complete()
				})
			},
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(counters).toEqual([1, 2, 3])
	})

	it("a sequential completionCondition stops early", async () => {
		let calls = 0
		const { instance } = run(
			miXml(
				'isSequential="true"',
				collect,
				"<bpmn:completionCondition>= numberOfCompletedInstances >= 2</bpmn:completionCondition>",
			),
			"p",
			{ items: [1, 2, 3, 4] },
			(engine) => {
				engine.registerJobWorker("w", (j) => {
					calls++
					j.complete({ result: j.variables.item })
				})
			},
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(calls).toBe(2)
		expect(instance.variables_snapshot).toMatchObject({ results: [1, 2, null, null] })
	})

	it("a parallel completionCondition terminates the iterations still running", async () => {
		let jobs: Job[] = []
		const { instance, events } = run(
			miXml("", collect, '<bpmn:completionCondition>= result = "found"</bpmn:completionCondition>'),
			"p",
			{ items: [1, 2, 3] },
			(engine) => {
				jobs = holdJobs(engine, "w")
			},
		)
		await flush()
		jobs[1]?.complete({ result: "found" })
		await flush()
		expect(instance.state).toBe("completed")
		expect(terminated(events)).toEqual(["each", "each"])
		expect(instance.variables_snapshot).toMatchObject({ results: [null, "found", null] })
		jobs[0]?.complete({ result: "late" })
		await flush()
		expect(instance.variables_snapshot).toMatchObject({ results: [null, "found", null] })
	})

	it("an empty input collection skips the activity with an empty output collection", async () => {
		let calls = 0
		const { instance } = run(miXml("", collect), "p", { items: [] }, (engine) => {
			engine.registerJobWorker("w", (j) => {
				calls++
				j.complete()
			})
		})
		await flush()
		expect(instance.state).toBe("completed")
		expect(calls).toBe(0)
		expect(instance.variables_snapshot).toMatchObject({ results: [] })
	})

	it("an input collection that is not a list fails the instance", async () => {
		const { instance, events } = run(miXml("", collect), "p", { items: 5 })
		await flush()
		expect(instance.state).toBe("failed")
		expect(events.some((e) => e.type === "element:failed" && e.elementId === "each")).toBe(true)
	})

	it("a multi-instance sub-process runs its flow once per item", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:subProcess id="sub">
    <bpmn:multiInstanceLoopCharacteristics>
      <bpmn:extensionElements><zeebe:loopCharacteristics inputCollection="= items" inputElement="item" outputCollection="doubled" outputElement="= twice"/></bpmn:extensionElements>
    </bpmn:multiInstanceLoopCharacteristics>
    <bpmn:startEvent id="subStart"/>
    <bpmn:scriptTask id="calc"><bpmn:extensionElements><zeebe:script expression="= item * 2" resultVariable="twice"/></bpmn:extensionElements></bpmn:scriptTask>
    <bpmn:endEvent id="subEnd"/>
    ${flow("sf1", "subStart", "calc")}
    ${flow("sf2", "calc", "subEnd")}
  </bpmn:subProcess>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "sub")}
  ${flow("f2", "sub", "done")}
</bpmn:process>`
		const { instance } = run(xml, "p", { items: [1, 2, 3] })
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toMatchObject({ doubled: [2, 4, 6] })
	})

	it("runs more than the loop guard's limit of iterations", async () => {
		const items = Array.from({ length: 150 }, (_, i) => i)
		const { instance } = run(miXml('isSequential="true"', collect), "p", { items })
		await flush()
		expect(instance.state).toBe("completed")
	})
})

// ── Link events and complex gateway ───────────────────────────────────────────

describe("link events", () => {
	it("a link throw event continues at the catch event with the same name", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:intermediateThrowEvent id="goTo"><bpmn:linkEventDefinition name="A"/></bpmn:intermediateThrowEvent>
  <bpmn:intermediateCatchEvent id="other"><bpmn:linkEventDefinition name="B"/></bpmn:intermediateCatchEvent>
  <bpmn:intermediateCatchEvent id="landing"><bpmn:linkEventDefinition name="A"/></bpmn:intermediateCatchEvent>
  <bpmn:endEvent id="done"/>
  <bpmn:endEvent id="wrong"/>
  ${flow("f1", "start", "goTo")}
  ${flow("f2", "landing", "done")}
  ${flow("f3", "other", "wrong")}
</bpmn:process>`
		const { instance, events } = run(xml, "p")
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toEqual(["start", "goTo", "landing", "done"])
	})

	it("a link throw event without a matching catch event fails the instance", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:intermediateThrowEvent id="goTo"><bpmn:linkEventDefinition name="nowhere"/></bpmn:intermediateThrowEvent>
  ${flow("f1", "start", "goTo")}
</bpmn:process>`
		const { instance } = run(xml, "p")
		await flush()
		expect(instance.state).toBe("failed")
		expect(instance.error).toContain('"nowhere"')
	})
})

describe("complex gateway", () => {
	const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:complexGateway id="gw" default="fDefault"/>
  <bpmn:endEvent id="big"/>
  <bpmn:endEvent id="vip"/>
  <bpmn:endEvent id="normal"/>
  ${flow("f1", "start", "gw")}
  ${flow("fBig", "gw", "big", "= amount > 100")}
  ${flow("fVip", "gw", "vip", "= vip")}
  ${flow("fDefault", "gw", "normal")}
</bpmn:process>`

	it("splits like an inclusive gateway: every true condition is taken", async () => {
		const { instance, events } = run(xml, "p", { amount: 500, vip: true })
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toEqual(expect.arrayContaining(["big", "vip"]))
		expect(entered(events)).not.toContain("normal")
	})

	it("takes the default flow when no condition holds", async () => {
		const { events } = run(xml, "p", { amount: 1, vip: false })
		await flush()
		expect(entered(events)).toEqual(["start", "gw", "normal"])
	})
})

// ── Compensation ──────────────────────────────────────────────────────────────

describe("compensation", () => {
	function compensationXml(throwDef: string): string {
		return `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  ${job("A", "do")}
  <bpmn:boundaryEvent id="compA" attachedToRef="A"><bpmn:compensateEventDefinition/></bpmn:boundaryEvent>
  <bpmn:serviceTask id="undoA" isForCompensation="true"><bpmn:extensionElements><zeebe:taskDefinition type="undo"/><zeebe:taskHeaders><zeebe:header key="of" value="A"/></zeebe:taskHeaders></bpmn:extensionElements></bpmn:serviceTask>
  ${job("B", "do")}
  <bpmn:boundaryEvent id="compB" attachedToRef="B"><bpmn:compensateEventDefinition/></bpmn:boundaryEvent>
  <bpmn:serviceTask id="undoB" isForCompensation="true"><bpmn:extensionElements><zeebe:taskDefinition type="undo"/><zeebe:taskHeaders><zeebe:header key="of" value="B"/></zeebe:taskHeaders></bpmn:extensionElements></bpmn:serviceTask>
  <bpmn:intermediateThrowEvent id="rollback">${throwDef}</bpmn:intermediateThrowEvent>
  <bpmn:endEvent id="done"/>
  <bpmn:association id="as1" sourceRef="compA" targetRef="undoA"/>
  <bpmn:association id="as2" sourceRef="compB" targetRef="undoB"/>
  ${flow("f1", "start", "A")}
  ${flow("f2", "A", "B")}
  ${flow("f3", "B", "rollback")}
  ${flow("f4", "rollback", "done")}
</bpmn:process>`
	}

	function recordUndo(undone: string[]): (engine: Engine) => void {
		return (engine) => {
			engine.registerJobWorker("do", (j) => j.complete())
			engine.registerJobWorker("undo", (j) => {
				undone.push(j.headers.of ?? "?")
				j.complete()
			})
		}
	}

	it("a compensation throw event runs the handlers of completed activities in reverse order", async () => {
		const undone: string[] = []
		const { instance, events } = run(
			compensationXml("<bpmn:compensateEventDefinition/>"),
			"p",
			{},
			recordUndo(undone),
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(undone).toEqual(["B", "A"])
		const ids = entered(events)
		// The throw event waits for the handlers before it moves on.
		expect(ids.indexOf("undoA")).toBeLessThan(ids.indexOf("done"))
	})

	it("activityRef compensates only that activity", async () => {
		const undone: string[] = []
		const { instance } = run(
			compensationXml('<bpmn:compensateEventDefinition activityRef="A"/>'),
			"p",
			{},
			recordUndo(undone),
		)
		await flush()
		expect(instance.state).toBe("completed")
		expect(undone).toEqual(["A"])
	})
})

// ── Scope completion and controlled mode ──────────────────────────────────────

describe("scope completion", () => {
	it("a split whose first branch ends at once still runs its other branches", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:parallelGateway id="split"/>
  <bpmn:endEvent id="e1"/>
  ${job("work", "w")}
  <bpmn:endEvent id="e2"/>
  ${flow("f1", "start", "split")}
  ${flow("f2", "split", "e1")}
  ${flow("f3", "split", "work")}
  ${flow("f4", "work", "e2")}
</bpmn:process>`
		let called = false
		const { instance, events } = run(xml, "p", {}, (engine) => {
			engine.registerJobWorker("w", (j) => {
				called = true
				j.complete()
			})
		})
		await flush()
		expect(instance.state).toBe("completed")
		expect(called).toBe(true)
		expect(entered(events)).toContain("e2")
	})
})

describe("controlled mode (beforeComplete)", () => {
	it("an event-based gateway's timer does not wait for real time", async () => {
		useFakeTimers()
		const engine = new Engine()
		engine.deploy({
			bpmn: parse(`<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:eventBasedGateway id="gw"/>
  <bpmn:intermediateCatchEvent id="onTimeout">${timer("timeDuration", "PT1H")}</bpmn:intermediateCatchEvent>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "gw")}
  ${flow("f2", "gw", "onTimeout")}
  ${flow("f3", "onTimeout", "done")}
</bpmn:process>`),
		})
		const stepped: string[] = []
		const instance = engine.start(
			"p",
			{},
			{
				beforeComplete: async (id) => {
					stepped.push(id)
				},
			},
		)
		await flush()
		await advance(0)
		expect(instance.state).toBe("completed")
		expect(stepped).toEqual(["start", "gw", "onTimeout", "done"])
	})
})

// ── Message correlation keys ──────────────────────────────────────────────────

describe("message correlation keys", () => {
	function waitingFor(subscriptionOnMessage: string, subscriptionOnEvent: string): string {
		return `<bpmn:message id="Msg_paid" name="paid">${subscriptionOnMessage}</bpmn:message>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:intermediateCatchEvent id="wait">
    <bpmn:extensionElements>${subscriptionOnEvent}</bpmn:extensionElements>
    <bpmn:messageEventDefinition messageRef="Msg_paid"/>
  </bpmn:intermediateCatchEvent>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "wait")}
  ${flow("f2", "wait", "done")}
</bpmn:process>`
	}

	it("a key from the message's zeebe:subscription only matches its value", async () => {
		const { instance } = run(
			waitingFor(
				'<bpmn:extensionElements><zeebe:subscription correlationKey="= orderId"/></bpmn:extensionElements>',
				"",
			),
			"p",
			{ orderId: "A-1" },
		)
		await flush()
		expect(instance.deliverMessage("paid", {}, "B-2")).toBe(false)
		expect(instance.deliverMessage("paid", { total: 9 }, "A-1")).toBe(true)
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toMatchObject({ total: 9 })
	})

	it("a key on the event itself wins, and a delivery without a key still matches", async () => {
		const { instance } = run(
			waitingFor(
				'<bpmn:extensionElements><zeebe:subscription correlationKey="= orderId"/></bpmn:extensionElements>',
				'<zeebe:subscription correlationKey="= customer"/>',
			),
			"p",
			{ orderId: "A-1", customer: "c-7" },
		)
		await flush()
		expect(instance.deliverMessage("paid", {}, "A-1")).toBe(false)
		expect(instance.deliverMessage("paid")).toBe(true)
		await flush()
		expect(instance.state).toBe("completed")
	})
})

// ── Variable propagation ──────────────────────────────────────────────────────

describe("variable propagation", () => {
	it("a new job variable inside a sub-process reaches the process scope", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:subProcess id="sub">
    <bpmn:startEvent id="subStart"/>
    ${job("work", "w")}
    <bpmn:endEvent id="subEnd"/>
    ${flow("sf1", "subStart", "work")}
    ${flow("sf2", "work", "subEnd")}
  </bpmn:subProcess>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "sub")}
  ${flow("f2", "sub", "done")}
</bpmn:process>`
		const { instance } = run(xml, "p", {}, (engine) => {
			engine.registerJobWorker("w", (j) => j.complete({ approved: true }))
		})
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toMatchObject({ approved: true })
	})

	it("input mappings stay local; with output mappings only the mapped result leaves the task", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  ${job(
		"work",
		"w",
		'<zeebe:ioMapping><zeebe:input source="= amount * 2" target="doubled"/><zeebe:output source="= status" target="paymentStatus"/></zeebe:ioMapping>',
	)}
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "work")}
  ${flow("f2", "work", "done")}
</bpmn:process>`
		let seen: Record<string, unknown> = {}
		const { instance } = run(xml, "p", { amount: 5 }, (engine) => {
			engine.registerJobWorker("w", (j) => {
				seen = j.variables
				j.complete({ status: "ok", transactionId: "t-1" })
			})
		})
		await flush()
		expect(seen).toMatchObject({ amount: 5, doubled: 10 })
		expect(instance.variables_snapshot).toEqual({ amount: 5, paymentStatus: "ok" })
	})

	it("a sub-process output mapping carries a local variable out of it", async () => {
		const xml = `<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="start"/>
  <bpmn:subProcess id="sub">
    <bpmn:extensionElements><zeebe:ioMapping><zeebe:input source="= 0" target="n"/><zeebe:output source="= n" target="total"/></zeebe:ioMapping></bpmn:extensionElements>
    <bpmn:startEvent id="subStart"/>
    <bpmn:scriptTask id="inc"><bpmn:extensionElements><zeebe:script expression="= n + 3" resultVariable="n"/></bpmn:extensionElements></bpmn:scriptTask>
    <bpmn:endEvent id="subEnd"/>
    ${flow("sf1", "subStart", "inc")}
    ${flow("sf2", "inc", "subEnd")}
  </bpmn:subProcess>
  <bpmn:endEvent id="done"/>
  ${flow("f1", "start", "sub")}
  ${flow("f2", "sub", "done")}
</bpmn:process>`
		const { instance } = run(xml, "p")
		await flush()
		expect(instance.state).toBe("completed")
		expect(instance.variables_snapshot).toEqual({ total: 3 })
	})
})

// ── Start events ──────────────────────────────────────────────────────────────

describe("start events", () => {
	it("engine.start runs only the none start event when the process also has event start events", async () => {
		const xml = `<bpmn:signal id="Sig_go" name="go"/>
<bpmn:process id="p" isExecutable="true">
  <bpmn:startEvent id="plain"/>
  <bpmn:startEvent id="bySignal"><bpmn:signalEventDefinition signalRef="Sig_go"/></bpmn:startEvent>
  <bpmn:endEvent id="e1"/>
  <bpmn:endEvent id="e2"/>
  ${flow("f1", "plain", "e1")}
  ${flow("f2", "bySignal", "e2")}
</bpmn:process>`
		const { instance, events } = run(xml, "p")
		await flush()
		expect(instance.state).toBe("completed")
		expect(entered(events)).toEqual(["plain", "e1"])
	})
})

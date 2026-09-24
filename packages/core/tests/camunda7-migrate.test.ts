import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
	Bpmn,
	type BpmnDefinitions,
	type BpmnFlowElement,
	type Camunda7Finding,
	ValidationError,
	type XmlElement,
	analyzeCamunda7,
	convertCamunda7,
	lintDiagram,
	semanticHash,
} from "../src/index.js"
import { diffSignatures, formatChange, xmlSignature } from "./support/xml-signature.js"

const C7_NS = 'xmlns:camunda="http://camunda.org/schema/1.0/bpmn"'

/** A Camunda 7 document around `body`, as Camunda Modeler writes one. */
function c7(body: string, processAttributes = "", roots = ""): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ${C7_NS}
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:modeler="http://camunda.org/schema/modeler/1.0"
  id="Definitions_test" targetNamespace="http://bpmn.io/schema/bpmn"
  modeler:executionPlatform="Camunda Platform" modeler:executionPlatformVersion="7.22.0">
  ${roots}
  <bpmn:process id="p" isExecutable="true" ${processAttributes}>
    ${body}
  </bpmn:process>
</bpmn:definitions>`
}

interface Converted {
	definitions: BpmnDefinitions
	findings: Camunda7Finding[]
	element(id: string): BpmnFlowElement
	ext(id: string, name: string): XmlElement | undefined
	of(id: string): Camunda7Finding[]
}

function convert(xml: string, withSource = true): Converted {
	const { definitions, report } = convertCamunda7(
		Bpmn.parse(xml),
		withSource ? { sourceXml: xml } : {},
	)
	const all = (elements: BpmnFlowElement[]): BpmnFlowElement[] =>
		elements.flatMap((element) =>
			"flowElements" in element ? [element, ...all(element.flowElements)] : [element],
		)
	const element = (id: string): BpmnFlowElement => {
		const found = all(definitions.processes.flatMap((p) => p.flowElements)).find((e) => e.id === id)
		if (found === undefined) throw new Error(`no element ${id}`)
		return found
	}
	return {
		definitions,
		findings: report.findings,
		element,
		ext: (id, name) => element(id).extensionElements.find((e) => e.name === name),
		of: (id) => report.findings.filter((f) => f.elementId === id),
	}
}

function severities(findings: Camunda7Finding[]): string[] {
	return findings.map((f) => `${f.construct}:${f.severity}`)
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

describe("service task implementations", () => {
	it("turns an external task topic into a job type", () => {
		const c = convert(
			c7('<bpmn:serviceTask id="t" camunda:type="external" camunda:topic="charge-card"/>'),
		)
		expect(c.ext("t", "zeebe:taskDefinition")?.attributes).toEqual({ type: "charge-card" })
		expect(c.element("t").unknownAttributes).toEqual({})
		expect(severities(c.of("t"))).toEqual(["camunda:type=external:convertible"])
	})

	it("keeps a topic expression it cannot translate", () => {
		const c = convert(
			c7('<bpmn:serviceTask id="t" camunda:type="external" camunda:topic="${topics.pick()}"/>'),
		)
		expect(c.ext("t", "zeebe:taskDefinition")).toBeUndefined()
		expect(c.element("t").unknownAttributes["camunda:topic"]).toBe("${topics.pick()}")
		expect(severities(c.of("t"))).toEqual(["camunda:topic:manual"])
	})

	it("names the job type after the Spring bean a delegate class gets, and keeps the class as a header", () => {
		const c = convert(c7('<bpmn:serviceTask id="t" camunda:class="com.acme.ShipOrderDelegate"/>'))
		expect(c.ext("t", "zeebe:taskDefinition")?.attributes.type).toBe("shipOrderDelegate")
		expect(c.ext("t", "zeebe:taskHeaders")?.children[0]?.attributes).toEqual({
			key: "class",
			value: "com.acme.ShipOrderDelegate",
		})
		const [finding] = c.of("t")
		expect(finding).toMatchObject({ construct: "camunda:class", severity: "manual", applied: true })
		expect(c.element("t").unknownAttributes).toEqual({})
	})

	it("uses the bean of a simple delegate expression, and the element id otherwise", () => {
		const c = convert(
			c7(`<bpmn:serviceTask id="simple" camunda:delegateExpression="\${mailer}"/>
			<bpmn:serviceTask id="complex" camunda:delegateExpression="\${beans.mailer}"/>`),
		)
		expect(c.ext("simple", "zeebe:taskDefinition")?.attributes.type).toBe("mailer")
		expect(c.ext("complex", "zeebe:taskDefinition")?.attributes.type).toBe("complex")
	})

	it("carries an expression and its result variable as headers", () => {
		const c = convert(
			c7(
				'<bpmn:serviceTask id="t" camunda:expression="${calc.run(execution)}" camunda:resultVariable="r"/>',
			),
		)
		expect(c.ext("t", "zeebe:taskDefinition")?.attributes.type).toBe("t")
		expect(c.ext("t", "zeebe:taskHeaders")?.children.map((h) => h.attributes)).toEqual([
			{ key: "expression", value: "${calc.run(execution)}" },
			{ key: "resultVariable", value: "r" },
		])
	})

	it("turns static field injections into headers and leaves expression fields", () => {
		const c = convert(
			c7(`<bpmn:serviceTask id="t" camunda:class="com.acme.Check">
			  <bpmn:extensionElements>
			    <camunda:field name="threshold"><camunda:string>0.8</camunda:string></camunda:field>
			    <camunda:field name="mode" stringValue="strict"/>
			    <camunda:field name="region" expression="\${claim.region}"/>
			  </bpmn:extensionElements>
			</bpmn:serviceTask>`),
		)
		expect(c.ext("t", "zeebe:taskHeaders")?.children.map((h) => h.attributes.key)).toEqual([
			"class",
			"threshold",
			"mode",
		])
		expect(c.element("t").extensionElements.filter((e) => e.name === "camunda:field")).toHaveLength(
			1,
		)
		expect(severities(c.of("t"))).toEqual([
			"camunda:field:convertible",
			"camunda:field:convertible",
			"camunda:field:manual",
			"camunda:class:manual",
		])
	})

	it("reports a Camunda 7 connector and writes no job type for it", () => {
		const c = convert(
			c7(`<bpmn:serviceTask id="t"><bpmn:extensionElements>
			  <camunda:connector><camunda:connectorId>http-connector</camunda:connectorId></camunda:connector>
			</bpmn:extensionElements></bpmn:serviceTask>`),
		)
		expect(c.ext("t", "zeebe:taskDefinition")).toBeUndefined()
		expect(c.ext("t", "camunda:connector")).toBeDefined()
		expect(c.of("t")[0]).toMatchObject({
			severity: "manual",
			suggestion: expect.stringMatching(/REST connector/),
		})
	})

	it("implements a message end event from the attributes on its event definition", () => {
		const xml = c7(`<bpmn:endEvent id="e">
		  <bpmn:messageEventDefinition id="md" camunda:type="external" camunda:topic="notify"/>
		</bpmn:endEvent>`)
		expect(convert(xml).ext("e", "zeebe:taskDefinition")?.attributes.type).toBe("notify")
		const withoutSource = convert(xml, false)
		expect(withoutSource.ext("e", "zeebe:taskDefinition")).toBeUndefined()
		expect(severities(withoutSource.of("e"))).toEqual(["bpmn:messageEventDefinition:manual"])
	})
})

// ---------------------------------------------------------------------------
// Input/output mappings and conditions
// ---------------------------------------------------------------------------

describe("input/output mappings", () => {
	const io = (parameters: string) =>
		convert(
			c7(`<bpmn:serviceTask id="t" camunda:type="external" camunda:topic="x"><bpmn:extensionElements>
			  <camunda:inputOutput>${parameters}</camunda:inputOutput>
			</bpmn:extensionElements></bpmn:serviceTask>`),
		)
	const mappings = (c: Converted) =>
		c
			.ext("t", "zeebe:ioMapping")
			?.children.map((m) => `${m.name} ${m.attributes.target} ${m.attributes.source}`)

	it("translates expressions and turns text into FEEL string literals", () => {
		const c = io(`<camunda:inputParameter name="amount">\${order.total}</camunda:inputParameter>
		  <camunda:inputParameter name="currency">EUR</camunda:inputParameter>
		  <camunda:inputParameter name="nothing"/>
		  <camunda:outputParameter name="paymentId">\${transactionId}</camunda:outputParameter>`)
		expect(mappings(c)).toEqual([
			"zeebe:input amount =order.total",
			'zeebe:input currency ="EUR"',
			"zeebe:input nothing =null",
			"zeebe:output paymentId =transactionId",
		])
		expect(c.ext("t", "camunda:inputOutput")).toBeUndefined()
	})

	it("builds FEEL lists and contexts from camunda:list and camunda:map", () => {
		const c = io(`<camunda:inputParameter name="payout"><camunda:map>
		    <camunda:entry key="claimId">\${claim.id}</camunda:entry>
		    <camunda:entry key="tags"><camunda:list><camunda:value>a</camunda:value></camunda:list></camunda:entry>
		  </camunda:map></camunda:inputParameter>`)
		expect(mappings(c)).toEqual(['zeebe:input payout ={"claimId": claim.id, "tags": ["a"]}'])
	})

	it("keeps what it cannot translate, next to what it could", () => {
		const c = io(`<camunda:inputParameter name="ok">\${a}</camunda:inputParameter>
		  <camunda:inputParameter name="note">Paid \${claim.id}</camunda:inputParameter>
		  <camunda:inputParameter name="audit"><camunda:script scriptFormat="groovy">x.collect()</camunda:script></camunda:inputParameter>
		  <camunda:inputParameter name="feel"><camunda:script scriptFormat="feel">a + 1</camunda:script></camunda:inputParameter>
		  <camunda:outputParameter name="my-var">\${a}</camunda:outputParameter>`)
		expect(mappings(c)).toEqual(["zeebe:input ok =a", "zeebe:input feel =a + 1"])
		expect(c.ext("t", "camunda:inputOutput")?.children.map((p) => p.attributes.name)).toEqual([
			"note",
			"audit",
			"my-var",
		])
		expect(
			c
				.of("t")
				.filter((f) => f.severity === "manual")
				.map((f) => f.construct),
		).toEqual(["camunda:inputParameter", "camunda:inputParameter", "camunda:outputParameter"])
	})

	it("refuses mappings on an element Camunda 8 allows none on", () => {
		const c = convert(
			c7(`<bpmn:task id="t"><bpmn:extensionElements><camunda:inputOutput>
			  <camunda:inputParameter name="a">1</camunda:inputParameter>
			</camunda:inputOutput></bpmn:extensionElements></bpmn:task>`),
		)
		expect(c.ext("t", "zeebe:ioMapping")).toBeUndefined()
		expect(severities(c.of("t"))).toEqual(["camunda:inputOutput:manual"])
	})
})

describe("sequence flow conditions", () => {
	const flow = (condition: string) =>
		convert(
			c7(`<bpmn:exclusiveGateway id="g"/><bpmn:task id="a"/>
			<bpmn:sequenceFlow id="f" sourceRef="g" targetRef="a">${condition}</bpmn:sequenceFlow>`),
		)
	const text = (c: Converted) =>
		c.definitions.processes[0]?.sequenceFlows[0]?.conditionExpression?.text

	it("translates a provable JUEL condition", () => {
		const c = flow(
			'<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${amount &gt; 1000 &amp;&amp; !approved}</bpmn:conditionExpression>',
		)
		expect(text(c)).toBe("=amount > 1000 and not(approved)")
		expect(severities(c.of("f"))).toEqual(["conditionExpression:convertible"])
	})

	it("leaves script conditions and unprovable JUEL untouched", () => {
		const script = flow(
			'<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="groovy">amount &gt; 1</bpmn:conditionExpression>',
		)
		expect(text(script)).toBe("amount > 1")
		expect(script.of("f")[0]?.message).toMatch(/groovy/)
		const unprovable = flow(
			'<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${empty items}</bpmn:conditionExpression>',
		)
		expect(text(unprovable)).toBe("${empty items}")
		expect(severities(unprovable.of("f"))).toEqual(["conditionExpression:manual"])
	})

	it("reports a listener on taking a flow as unsupported", () => {
		const c = flow(
			'<bpmn:extensionElements><camunda:executionListener class="com.acme.L" event="take"/></bpmn:extensionElements>',
		)
		expect(severities(c.of("f"))).toEqual(["camunda:executionListener:unsupported"])
	})
})

// ---------------------------------------------------------------------------
// Async, retries, jobs
// ---------------------------------------------------------------------------

describe("asynchronous continuations and retries", () => {
	it("drops async markers and explains why", () => {
		const c = convert(
			c7(
				'<bpmn:serviceTask id="t" camunda:asyncBefore="true" camunda:asyncAfter="true" camunda:exclusive="false" camunda:jobPriority="5" camunda:type="external" camunda:topic="x"/>',
			),
		)
		expect(c.element("t").unknownAttributes).toEqual({})
		const [async] = c.of("t")
		expect(async).toMatchObject({ severity: "convertible", applied: true })
		expect(async?.construct).toBe(
			"camunda:asyncBefore, camunda:asyncAfter, camunda:exclusive, camunda:jobPriority",
		)
		expect(async?.message).toMatch(/no asynchronous continuations/)
	})

	const retry = (
		cycle: string,
		element = "serviceTask",
		attributes = 'camunda:type="external" camunda:topic="x"',
	) =>
		convert(
			c7(`<bpmn:${element} id="t" ${attributes}><bpmn:extensionElements>
			  <camunda:failedJobRetryTimeCycle>${cycle}</camunda:failedJobRetryTimeCycle>
			</bpmn:extensionElements></bpmn:${element}>`),
		)

	it("moves the retry count to the task definition and flags the interval", () => {
		const c = retry("R5/PT5M")
		expect(c.ext("t", "zeebe:taskDefinition")?.attributes.retries).toBe("5")
		expect(severities(c.of("t").slice(1))).toEqual([
			"camunda:failedJobRetryTimeCycle:convertible",
			"camunda:failedJobRetryTimeCycle:manual",
		])
	})

	it("needs no back-off for a zero interval", () => {
		const c = retry("R3/PT0S")
		expect(c.ext("t", "zeebe:taskDefinition")?.attributes.retries).toBe("3")
		expect(c.of("t").filter((f) => f.severity !== "convertible")).toEqual([])
	})

	it("counts a list of intervals", () => {
		expect(retry("PT1M,PT5M,PT10M").ext("t", "zeebe:taskDefinition")?.attributes.retries).toBe("3")
	})

	it("keeps a cycle it cannot read", () => {
		const c = retry("whenever")
		expect(c.ext("t", "camunda:failedJobRetryTimeCycle")).toBeDefined()
		expect(c.of("t").at(-1)?.severity).toBe("manual")
	})

	it("reports retries on an element that has no job as unsupported", () => {
		const c = retry("R3/PT1M", "userTask", 'camunda:asyncBefore="true"')
		expect(c.of("t").at(-1)).toMatchObject({
			construct: "camunda:failedJobRetryTimeCycle",
			severity: "unsupported",
		})
	})
})

// ---------------------------------------------------------------------------
// User tasks and forms
// ---------------------------------------------------------------------------

describe("user tasks", () => {
	const task = (attributes: string, body = "") =>
		convert(c7(`<bpmn:userTask id="u" ${attributes}>${body}</bpmn:userTask>`))

	it("becomes a Camunda user task with its assignment", () => {
		const c = task('camunda:assignee="${starter}" camunda:candidateGroups="sales,management"')
		expect(c.ext("u", "zeebe:userTask")).toBeDefined()
		expect(c.ext("u", "zeebe:assignmentDefinition")?.attributes).toEqual({
			assignee: "=starter",
			candidateGroups: "sales,management",
		})
		expect(c.of("u").every((f) => f.severity === "convertible")).toBe(true)
	})

	it("flags a candidate expression, since Camunda 8 needs a list", () => {
		const c = task('camunda:candidateUsers="${reviewers}"')
		expect(c.ext("u", "zeebe:assignmentDefinition")?.attributes.candidateUsers).toBe("=reviewers")
		expect(c.of("u").at(-1)).toMatchObject({ severity: "manual", applied: true })
	})

	it("schedules only ISO date-times with a zone or expressions", () => {
		const c = task('camunda:dueDate="2026-10-01T12:00:00Z" camunda:followUpDate="2026-10-01"')
		expect(c.ext("u", "zeebe:taskSchedule")?.attributes).toEqual({
			dueDate: "2026-10-01T12:00:00Z",
		})
		expect(c.element("u").unknownAttributes).toEqual({ "camunda:followUpDate": "2026-10-01" })
	})

	it("converts a priority within 0–100 and flags one outside it", () => {
		expect(
			task('camunda:priority="80"').ext("u", "zeebe:priorityDefinition")?.attributes.priority,
		).toBe("80")
		const high = task('camunda:priority="500"')
		expect(high.ext("u", "zeebe:priorityDefinition")).toBeUndefined()
		expect(high.of("u").at(-1)?.severity).toBe("manual")
	})

	it("links a Camunda Form by id and binding", () => {
		const c = task('camunda:formRef="review" camunda:formRefBinding="deployment"')
		expect(c.ext("u", "zeebe:formDefinition")?.attributes).toEqual({
			formId: "review",
			bindingType: "deployment",
		})
	})

	it("flags a form bound to a version number", () => {
		const c = task(
			'camunda:formRef="review" camunda:formRefBinding="version" camunda:formRefVersion="3"',
		)
		expect(c.ext("u", "zeebe:formDefinition")?.attributes).toEqual({ formId: "review" })
		expect(
			c.findings.some((f) => f.construct === "camunda:formRefBinding" && f.severity === "manual"),
		).toBe(true)
		expect(c.element("u").unknownAttributes).toMatchObject({ "camunda:formRefVersion": "3" })
	})

	it("maps form keys by kind", () => {
		const deployed = task('camunda:formKey="camunda-forms:deployment:review.form"')
		expect(deployed.ext("u", "zeebe:formDefinition")).toBeUndefined()
		expect(deployed.of("u").at(-1)?.severity).toBe("manual")

		const embedded = task('camunda:formKey="embedded:app:forms/review.html"')
		expect(embedded.ext("u", "zeebe:formDefinition")?.attributes.externalReference).toBe(
			"embedded:app:forms/review.html",
		)
		expect(embedded.of("u").at(-1)).toMatchObject({ severity: "manual", applied: true })

		const custom = task('camunda:formKey="app:review"')
		expect(custom.of("u").at(-1)).toMatchObject({ severity: "convertible", applied: true })
	})

	it("reports task listeners by what Camunda 8 offers", () => {
		const c = task(
			"",
			`<bpmn:extensionElements>
			  <camunda:taskListener class="com.acme.Notify" event="create"/>
			  <camunda:taskListener delegateExpression="\${escalate}" event="timeout"/>
			</bpmn:extensionElements>`,
		)
		const listeners = c.of("u").filter((f) => f.construct === "camunda:taskListener")
		expect(listeners.map((f) => f.severity)).toEqual(["manual", "unsupported"])
		expect(listeners[0]?.suggestion).toMatch(/eventType="creating"/)
	})
})

describe("start events", () => {
	it("links a start form and reports the initiator", () => {
		const c = convert(
			c7('<bpmn:startEvent id="s" camunda:initiator="starter" camunda:formRef="request"/>'),
		)
		expect(c.ext("s", "zeebe:formDefinition")?.attributes.formId).toBe("request")
		expect(severities(c.of("s"))).toEqual([
			"camunda:initiator:unsupported",
			"camunda:formRef:convertible",
		])
	})
})

// ---------------------------------------------------------------------------
// Decisions, call activities, scripts
// ---------------------------------------------------------------------------

describe("business rule tasks", () => {
	it("calls the decision and keeps the result variable", () => {
		const c = convert(
			c7(
				'<bpmn:businessRuleTask id="b" camunda:decisionRef="risk" camunda:resultVariable="risk" camunda:decisionRefBinding="versionTag" camunda:decisionRefVersionTag="v2" camunda:mapDecisionResult="singleEntry"/>',
			),
		)
		expect(c.ext("b", "zeebe:calledDecision")?.attributes).toEqual({
			decisionId: "risk",
			resultVariable: "risk",
			bindingType: "versionTag",
			versionTag: "v2",
		})
		expect(c.element("b").unknownAttributes).toEqual({})
		expect(c.of("b").every((f) => f.severity === "convertible")).toBe(true)
	})

	it("supplies a result variable and flags the default result mapper", () => {
		const c = convert(c7('<bpmn:businessRuleTask id="b" camunda:decisionRef="risk"/>'))
		expect(c.ext("b", "zeebe:calledDecision")?.attributes.resultVariable).toBe("decisionResult")
		expect(severities(c.of("b"))).toEqual([
			"camunda:decisionRef:manual",
			"camunda:mapDecisionResult:manual",
		])
	})
})

describe("call activities", () => {
	const call = (body: string, attributes = "") =>
		convert(
			c7(
				`<bpmn:callActivity id="c" calledElement="child" ${attributes}><bpmn:extensionElements>${body}</bpmn:extensionElements></bpmn:callActivity>`,
			),
		)

	it("maps camunda:in/out and pins Camunda 7's pass-nothing default", () => {
		const c = call(`<camunda:in source="orderId" target="orderId"/>
		  <camunda:in sourceExpression="\${order.total + 1}" target="total"/>
		  <camunda:out source="invoiceId" target="invoiceId"/>`)
		expect(c.ext("c", "zeebe:calledElement")?.attributes).toEqual({
			processId: "child",
			propagateAllParentVariables: "false",
		})
		expect(
			c
				.ext("c", "zeebe:ioMapping")
				?.children.map((m) => `${m.attributes.target}=${m.attributes.source}`),
		).toEqual(["orderId==orderId", "total==order.total + 1", "invoiceId==invoiceId"])
	})

	it("passes nothing back when Camunda 7 had no camunda:out", () => {
		const c = call('<camunda:in variables="all"/>')
		expect(c.ext("c", "zeebe:calledElement")?.attributes).toEqual({
			processId: "child",
			propagateAllChildVariables: "false",
		})
	})

	it("drops the default business-key hand-over and binds the version", () => {
		const c = call(
			'<camunda:in businessKey="#{execution.processBusinessKey}"/><camunda:out variables="all"/>',
			'camunda:calledElementBinding="deployment"',
		)
		expect(c.ext("c", "zeebe:calledElement")?.attributes).toEqual({
			processId: "child",
			bindingType: "deployment",
			propagateAllParentVariables: "false",
		})
		expect(c.element("c").extensionElements.some((e) => e.name.startsWith("camunda:"))).toBe(false)
	})

	it("flags a version-number binding", () => {
		const c = call("", 'camunda:calledElementBinding="version" camunda:calledElementVersion="4"')
		expect(
			c.findings.some(
				(f) => f.construct === "camunda:calledElementBinding" && f.severity === "manual",
			),
		).toBe(true)
	})
})

describe("script tasks", () => {
	const script = (format: string, text: string, attributes = 'camunda:resultVariable="r"') =>
		convert(
			c7(
				`<bpmn:scriptTask id="s" scriptFormat="${format}" ${attributes}><bpmn:script>${text}</bpmn:script></bpmn:scriptTask>`,
			),
		)

	it("turns a FEEL script into zeebe:script", () => {
		const c = script("feel", "a + b")
		expect(c.ext("s", "zeebe:script")?.attributes).toEqual({
			expression: "=a + b",
			resultVariable: "r",
		})
		expect(c.element("s").unknownAttributes).toEqual({})
		expect(c.element("s").unknownChildren ?? []).toEqual([])
	})

	it("translates a JUEL script", () => {
		expect(script("juel", "${a * 2}").ext("s", "zeebe:script")?.attributes.expression).toBe(
			"=a * 2",
		)
	})

	it("leaves Groovy, and a FEEL script without a result variable, for a person", () => {
		const groovy = script("groovy", "a.collect()")
		expect(groovy.ext("s", "zeebe:script")).toBeUndefined()
		expect(groovy.of("s")[0]?.severity).toBe("manual")
		const noResult = script("feel", "a", "")
		expect(noResult.of("s")[0]?.message).toMatch(/requires a result variable/)
	})
})

// ---------------------------------------------------------------------------
// Events and loops
// ---------------------------------------------------------------------------

describe("events", () => {
	it("asks for a correlation key on message catches", () => {
		const c = convert(
			c7(
				'<bpmn:receiveTask id="r" messageRef="m"/><bpmn:startEvent id="s"><bpmn:messageEventDefinition messageRef="m"/></bpmn:startEvent>',
				"",
				'<bpmn:message id="m" name="Paid"/>',
			),
		)
		expect(severities(c.of("r"))).toEqual(["message correlation:manual"])
		expect(c.of("s")).toEqual([])
	})

	it("translates timer expressions and flags cron cycles", () => {
		const c = convert(
			c7(`<bpmn:intermediateCatchEvent id="t1"><bpmn:timerEventDefinition>
			  <bpmn:timeDuration xsi:type="bpmn:tFormalExpression">\${wait}</bpmn:timeDuration>
			</bpmn:timerEventDefinition></bpmn:intermediateCatchEvent>
			<bpmn:intermediateCatchEvent id="t2"><bpmn:timerEventDefinition>
			  <bpmn:timeDate xsi:type="bpmn:tFormalExpression">\${dateTime().plusDays(1).toDate()}</bpmn:timeDate>
			</bpmn:timerEventDefinition></bpmn:intermediateCatchEvent>
			<bpmn:startEvent id="t3"><bpmn:timerEventDefinition>
			  <bpmn:timeCycle xsi:type="bpmn:tFormalExpression">0 0 9 * * ?</bpmn:timeCycle>
			</bpmn:timerEventDefinition></bpmn:startEvent>`),
		)
		const timer = (id: string) => {
			const element = c.element(id)
			return "eventDefinitions" in element ? element.eventDefinitions[0] : undefined
		}
		expect(timer("t1")).toMatchObject({ timeDuration: "=wait" })
		expect(severities(c.of("t2"))).toEqual(["timer timeDate:manual"])
		expect(severities(c.of("t3"))).toEqual(["timer timeCycle:manual"])
	})

	it("reports error variables recovered from the event definition", () => {
		const c = convert(
			c7(`<bpmn:task id="a"/><bpmn:boundaryEvent id="b" attachedToRef="a">
			  <bpmn:errorEventDefinition camunda:errorCodeVariable="code"/>
			</bpmn:boundaryEvent>`),
		)
		expect(severities(c.of("b"))).toEqual(["camunda:errorCodeVariable:manual"])
	})
})

describe("multi-instance", () => {
	const loop = (attributes: string, inner = "") =>
		c7(
			`<bpmn:userTask id="u"><bpmn:multiInstanceLoopCharacteristics ${attributes}>${inner}</bpmn:multiInstanceLoopCharacteristics></bpmn:userTask>`,
		)
	const zeebeLoop = (c: Converted) => {
		const element = c.element("u")
		return "loopCharacteristics" in element
			? element.loopCharacteristics?.extensionElements.find(
					(e) => e.name === "zeebe:loopCharacteristics",
				)
			: undefined
	}

	it("recovers the collection from the source and translates the completion condition", () => {
		const c = convert(
			loop(
				'camunda:collection="${items}" camunda:elementVariable="item"',
				'<bpmn:completionCondition xsi:type="bpmn:tFormalExpression">${nrOfCompletedInstances == 2}</bpmn:completionCondition>',
			),
		)
		expect(zeebeLoop(c)?.attributes).toEqual({ inputCollection: "=items", inputElement: "item" })
		const element = c.element("u")
		expect(
			"loopCharacteristics" in element && element.loopCharacteristics?.completionCondition?.text,
		).toBe("=numberOfCompletedInstances = 2")
	})

	it("accepts a bare variable name as collection", () => {
		expect(zeebeLoop(convert(loop('camunda:collection="items"')))?.attributes.inputCollection).toBe(
			"=items",
		)
	})

	it("reports a loop it cannot see the collection of", () => {
		const c = convert(loop('camunda:collection="${items}"'), false)
		expect(zeebeLoop(c)).toBeUndefined()
		expect(c.of("u").at(-1)?.construct).toBe("multiInstanceLoopCharacteristics")
	})

	it("reports a cardinality, which Camunda 8 does not have", () => {
		const c = convert(
			loop(
				"",
				'<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">${3}</bpmn:loopCardinality>',
			),
		)
		expect(c.of("u").at(-1)).toMatchObject({ construct: "loopCardinality", severity: "manual" })
	})

	it("reports a standard loop as unsupported", () => {
		const c = convert(c7('<bpmn:task id="t"><bpmn:standardLoopCharacteristics/></bpmn:task>'))
		expect(severities(c.of("t"))).toEqual(["bpmn:standardLoopCharacteristics:unsupported"])
	})
})

// ---------------------------------------------------------------------------
// Process and document
// ---------------------------------------------------------------------------

describe("process and document", () => {
	it("moves the version tag and reports what has no equivalent", () => {
		const c = convert(
			c7(
				"",
				'camunda:versionTag="2.0" camunda:historyTimeToLive="180" camunda:candidateStarterGroups="ops"',
			),
		)
		const process = c.definitions.processes[0]
		expect(process?.extensionElements).toEqual([
			{ name: "zeebe:versionTag", attributes: { value: "2.0" }, children: [] },
		])
		expect(severities(c.of("p"))).toEqual([
			"camunda:versionTag:convertible",
			"camunda:historyTimeToLive:unsupported",
			"camunda:candidateStarterGroups:unsupported",
		])
		expect(process?.unknownAttributes).toEqual({
			"camunda:historyTimeToLive": "180",
			"camunda:candidateStarterGroups": "ops",
		})
	})

	it("reports every Camunda 7 construct no rule knows, and keeps it", () => {
		const c = convert(
			c7(
				'<bpmn:task id="t" camunda:somethingNew="x"><bpmn:extensionElements><camunda:novel/></bpmn:extensionElements></bpmn:task>',
			),
		)
		expect(severities(c.of("t"))).toEqual(["camunda:somethingNew:manual", "camunda:novel:manual"])
		expect(c.element("t").unknownAttributes).toEqual({ "camunda:somethingNew": "x" })
	})

	it("targets Camunda 8 and declares the zeebe namespace", () => {
		const c = convert(c7(""))
		expect(c.definitions.unknownAttributes).toMatchObject({
			"modeler:executionPlatform": "Camunda Cloud",
			"modeler:executionPlatformVersion": "8.8.0",
		})
		expect(c.definitions.namespaces.zeebe).toBe("http://camunda.org/schema/zeebe/1.0")
		expect(
			convertCamunda7(Bpmn.parse(c7("")), { executionPlatformVersion: "8.9.0" }).definitions
				.unknownAttributes["modeler:executionPlatformVersion"],
		).toBe("8.9.0")
	})

	it("reads a Camunda 7 namespace bound to another prefix", () => {
		const xml = c7('<bpmn:serviceTask id="t" c7:type="external" c7:topic="x"/>').replace(
			C7_NS,
			'xmlns:c7="http://camunda.org/schema/1.0/bpmn"',
		)
		expect(convert(xml).ext("t", "zeebe:taskDefinition")?.attributes.type).toBe("x")
	})

	it("does not modify its input", () => {
		const input = Bpmn.parse(
			c7('<bpmn:serviceTask id="t" camunda:type="external" camunda:topic="x"/>'),
		)
		const before = semanticHash(input)
		convertCamunda7(input)
		expect(semanticHash(input)).toBe(before)
	})

	it("refuses a model that already targets Camunda 8", () => {
		const xml = c7("").replace(
			'modeler:executionPlatform="Camunda Platform"',
			'modeler:executionPlatform="Camunda Cloud"',
		)
		expect(() => convertCamunda7(Bpmn.parse(xml))).toThrow(ValidationError)
	})

	it("analyzes with the same findings it converts with", () => {
		const xml = c7('<bpmn:serviceTask id="t" camunda:class="com.acme.A"/>')
		expect(analyzeCamunda7(Bpmn.parse(xml), { sourceXml: xml })).toEqual(
			convertCamunda7(Bpmn.parse(xml), { sourceXml: xml }).report,
		)
	})
})

// ---------------------------------------------------------------------------
// End to end on Camunda Modeler exports
// ---------------------------------------------------------------------------

const fixtureDirectory = join(import.meta.dirname, "fixtures", "camunda7")
const FIXTURES = ["invoice-approval.bpmn", "order-fulfillment.bpmn", "claim-handling.bpmn"]

describe("fixture conversions", () => {
	for (const name of FIXTURES) {
		describe(name, () => {
			const source = readFileSync(join(fixtureDirectory, name), "utf-8")
			const { definitions, report } = convertCamunda7(Bpmn.parse(source), { sourceXml: source })
			const exported = Bpmn.export(definitions)

			it("deploy-lints clean everywhere it reported nothing to do by hand", () => {
				const needsWork = new Set(
					report.findings.filter((f) => f.severity !== "convertible").map((f) => f.elementId),
				)
				const errors = lintDiagram(Bpmn.parse(exported), { categories: ["deploy", "feel-syntax"] })
					.diagnostics.filter((d) => d.severity === "error")
					.filter((d) => d.elementIds.length === 0 || d.elementIds.some((id) => !needsWork.has(id)))
				expect(errors.map((d) => d.message)).toEqual([])
			})

			it("re-imports to the same model", () => {
				expect(semanticHash(Bpmn.parse(exported))).toBe(semanticHash(definitions))
			})

			it("re-exports identically", () => {
				const twice = Bpmn.export(Bpmn.parse(exported))
				expect(
					diffSignatures(xmlSignature(exported), xmlSignature(twice)).map(formatChange),
				).toEqual([])
			})

			it("is left with no convertible Camunda 7 attribute on any element", () => {
				const applied = new Set(
					report.findings.filter((f) => f.applied).map((f) => `${f.elementId} ${f.construct}`),
				)
				for (const process of definitions.processes) {
					for (const element of process.flowElements) {
						for (const key of Object.keys(element.unknownAttributes).filter((k) =>
							k.startsWith("camunda:"),
						)) {
							expect(applied.has(`${element.id} ${key}`), `${element.id} ${key}`).toBe(false)
						}
					}
				}
			})
		})
	}

	it("converts the invoice model completely", () => {
		const source = readFileSync(join(fixtureDirectory, "invoice-approval.bpmn"), "utf-8")
		const { definitions, report } = convertCamunda7(Bpmn.parse(source), { sourceXml: source })
		expect(report.counts).toEqual({ convertible: 17, manual: 0, unsupported: 0 })
		const lint = lintDiagram(definitions, { categories: ["deploy", "feel-syntax"] })
		expect(lint.counts.error).toBe(0)
	})

	it("reports the order model's manual work", () => {
		const source = readFileSync(join(fixtureDirectory, "order-fulfillment.bpmn"), "utf-8")
		const report = analyzeCamunda7(Bpmn.parse(source), { sourceXml: source })
		expect(report.counts).toEqual({ convertible: 19, manual: 8, unsupported: 2 })
		expect(
			report.findings
				.filter((f) => f.severity !== "convertible")
				.map((f) => `${f.elementId} ${f.construct}`),
		).toEqual([
			"order-fulfillment camunda:historyTimeToLive",
			"order-fulfillment camunda:executionListener",
			"StartEvent_order camunda:initiator",
			"Task_review camunda:taskListener",
			"Task_charge camunda:failedJobRetryTimeCycle",
			"Task_awaitPayment message correlation",
			"Task_ship camunda:class",
			'Task_summary scriptFormat="groovy"',
			"Task_notify camunda:delegateExpression",
			"Task_escalate camunda:expression",
		])
	})
})

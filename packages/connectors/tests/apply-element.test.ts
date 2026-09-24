import { Bpmn } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnFlowElement, XmlElement } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { applyTemplateToElement, getTemplate } from "../src/index.js"
import type { ElementTemplate } from "../src/index.js"

/** One of each element an inbound or linked-resource template targets. */
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="orders" isExecutable="true">
    <bpmn:startEvent id="start" name="Order in" />
    <bpmn:intermediateCatchEvent id="wait" name="Paid">
      <bpmn:extensionElements>
        <zeebe:subscription correlationKey="=staleKey" />
      </bpmn:extensionElements>
      <bpmn:timerEventDefinition id="TimerDef_1" />
    </bpmn:intermediateCatchEvent>
    <bpmn:receiveTask id="receive" name="Await queue" />
    <bpmn:serviceTask id="work" name="Work">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="work" />
      </bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="cancelled" attachedToRef="work" />
    <bpmn:task id="robot" name="Run the robot" />
    <bpmn:endEvent id="end" />
  </bpmn:process>
</bpmn:definitions>`

function fixture(): BpmnDefinitions {
	return Bpmn.parse(FIXTURE)
}

function template(id: string): ElementTemplate {
	const found = getTemplate(id)
	if (!found) throw new Error(`bundled template ${id} is missing`)
	return found
}

function element(definitions: BpmnDefinitions, id: string): BpmnFlowElement {
	const found = definitions.processes[0]?.flowElements.find((el) => el.id === id)
	if (!found) throw new Error(`no element ${id}`)
	return found
}

function extension(el: { extensionElements?: XmlElement[] }, name: string): XmlElement | undefined {
	return el.extensionElements?.find((x) => x.name === name)
}

function zeebeProperties(el: BpmnFlowElement): Record<string, string> {
	const props = extension(el, "zeebe:properties")?.children ?? []
	return Object.fromEntries(props.map((p) => [p.attributes.name, p.attributes.value]))
}

function messageRef(el: BpmnFlowElement): string | undefined {
	if (el.type === "receiveTask") return el.messageRef
	if (!("eventDefinitions" in el)) return undefined
	const def = el.eventDefinitions.find((d) => d.type === "message")
	return def?.type === "message" ? def.messageRef : undefined
}

/** Serialize, parse back and serialize again — what a saved and reopened file goes through. */
function roundTrip(definitions: BpmnDefinitions): BpmnDefinitions {
	const xml = Bpmn.export(definitions)
	const reparsed = Bpmn.parse(xml)
	expect(Bpmn.export(reparsed)).toBe(xml)
	return reparsed
}

function apply(
	definitions: BpmnDefinitions,
	elementId: string,
	templateId: string,
	values: Record<string, string> = {},
) {
	return applyTemplateToElement(definitions, elementId, template(templateId), values)
}

describe("applyTemplateToElement — inbound connectors", () => {
	it("Webhook message start: message event, generated message name, inbound properties, stamps", () => {
		const id = "io.camunda.connectors.webhook.WebhookConnectorStartMessage.v1"
		const { definitions, problems } = apply(fixture(), "start", id, {
			"inbound.context": "orders",
		})
		expect(problems).toEqual([])

		const saved = roundTrip(definitions)
		const start = element(saved, "start")
		expect(start.type).toBe("startEvent")
		expect(start.name).toBe("Order in")
		expect(start.unknownAttributes["zeebe:modelerTemplate"]).toBe(id)
		expect(start.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("1")
		expect(start.unknownAttributes["zeebe:modelerTemplateIcon"]).toMatch(/^data:image/)

		const props = zeebeProperties(start)
		expect(props["inbound.type"]).toBe("io.camunda:webhook:1")
		expect(props["inbound.context"]).toBe("orders")

		const message = saved.messages.find((m) => m.id === messageRef(start))
		expect(message?.name).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		)
		// Correlation is not required by default, so the message carries no subscription.
		expect(message?.extensionElements).toBeUndefined()
	})

	it("derives the generated message name from template and element, never at random", () => {
		const id = "io.camunda.connectors.webhook.WebhookConnectorStartMessage.v1"
		const values = { "inbound.context": "orders" }
		const first = apply(fixture(), "start", id, values).definitions
		const second = apply(fixture(), "start", id, values).definitions
		expect(Bpmn.export(first)).toBe(Bpmn.export(second))

		const intermediate = apply(
			fixture(),
			"wait",
			"io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1",
			{ "inbound.context": "x", "message.correlationKey": "=id", correlationKeyExpression: "=id" },
		).definitions
		const startName = first.messages[0]?.name
		const waitName = intermediate.messages[0]?.name
		expect(startName).toBeDefined()
		expect(waitName).not.toBe(startName)
	})

	it("is idempotent — applying twice gives the model applying once does", () => {
		const id = "io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1"
		const values = {
			"inbound.context": "paid",
			"message.correlationKey": "=orderId",
			correlationKeyExpression: "=request.body.orderId",
		}
		const once = apply(fixture(), "wait", id, values).definitions
		const twice = applyTemplateToElement(once, "wait", template(id), values).definitions
		expect(Bpmn.export(twice)).toBe(Bpmn.export(once))
		expect(twice.messages).toHaveLength(1)
	})

	it("Webhook intermediate catch: message event, correlation key on the message's zeebe:subscription", () => {
		const { definitions, problems } = apply(
			fixture(),
			"wait",
			"io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1",
			{
				"inbound.context": "paid",
				"message.correlationKey": "=orderId",
				correlationKeyExpression: "=request.body.orderId",
			},
		)
		expect(problems).toEqual([])

		const saved = roundTrip(definitions)
		const wait = element(saved, "wait")
		expect(wait.type).toBe("intermediateCatchEvent")
		if (wait.type !== "intermediateCatchEvent") return
		// The timer definition is replaced by the template's message definition.
		expect(wait.eventDefinitions.map((d) => d.type)).toEqual(["message"])
		// Camunda reads the correlation key from the message, so the stale copy on the event goes.
		expect(extension(wait, "zeebe:subscription")).toBeUndefined()
		expect(zeebeProperties(wait)["inbound.type"]).toBe("io.camunda:webhook:1")
		expect(zeebeProperties(wait).correlationKeyExpression).toBe("=request.body.orderId")

		const message = saved.messages.find((m) => m.id === messageRef(wait))
		expect(message && extension(message, "zeebe:subscription")?.attributes).toEqual({
			correlationKey: "=orderId",
		})
		expect(Bpmn.export(saved)).toContain('<zeebe:subscription correlationKey="=orderId"')
	})

	it("Webhook boundary: stays attached, becomes a message boundary event", () => {
		const { definitions, problems } = apply(
			fixture(),
			"cancelled",
			"io.camunda.connectors.webhook.WebhookConnectorBoundary.v1",
			{
				"inbound.context": "cancel",
				"message.correlationKey": "=orderId",
				correlationKeyExpression: "=request.body.orderId",
			},
		)
		expect(problems).toEqual([])
		const saved = roundTrip(definitions)
		const boundary = element(saved, "cancelled")
		expect(boundary.type).toBe("boundaryEvent")
		if (boundary.type !== "boundaryEvent") return
		expect(boundary.attachedToRef).toBe("work")
		expect(boundary.eventDefinitions.map((d) => d.type)).toEqual(["message"])
		expect(zeebeProperties(boundary)["inbound.type"]).toBe("io.camunda:webhook:1")
		const message = saved.messages.find((m) => m.id === messageRef(boundary))
		expect(message && extension(message, "zeebe:subscription")?.attributes.correlationKey).toBe(
			"=orderId",
		)
	})

	it("Webhook start without a message: a plain start event, no message created", () => {
		const withMessage = apply(
			fixture(),
			"start",
			"io.camunda.connectors.webhook.WebhookConnectorStartMessage.v1",
			{ "inbound.context": "a" },
		).definitions
		const { definitions, problems } = applyTemplateToElement(
			withMessage,
			"start",
			template("io.camunda.connectors.webhook.WebhookConnector.v1"),
			{ "inbound.context": "a" },
		)
		expect(problems).toEqual([])
		const start = element(roundTrip(definitions), "start")
		if (start.type !== "startEvent") throw new Error("not a start event")
		expect(start.eventDefinitions).toEqual([])
		expect(start.unknownAttributes["zeebe:modelerTemplate"]).toBe(
			"io.camunda.connectors.webhook.WebhookConnector.v1",
		)
	})

	it("RabbitMQ receive task: messageRef on the task, properties by dropdown", () => {
		const { definitions, problems } = apply(
			fixture(),
			"receive",
			"io.camunda.connectors.inbound.RabbitMQ.Receive.v1",
			{
				"authentication.uri": "amqp://localhost",
				queueName: "orders",
				correlationKeyProcess: "=orderId",
				correlationKeyPayload: "=message.body.orderId",
			},
		)
		expect(problems).toEqual([])
		const saved = roundTrip(definitions)
		const receive = element(saved, "receive")
		expect(receive.type).toBe("receiveTask")
		const props = zeebeProperties(receive)
		expect(props["inbound.type"]).toBe("io.camunda:connector-rabbitmq-inbound:1")
		expect(props.queueName).toBe("orders")
		expect(props["authentication.uri"]).toBe("amqp://localhost")
		// Gated on the other dropdown choice, so not written.
		expect(props["authentication.userName"]).toBeUndefined()
		const message = saved.messages.find((m) => m.id === messageRef(receive))
		expect(message && extension(message, "zeebe:subscription")?.attributes.correlationKey).toBe(
			"=orderId",
		)
	})

	it("Kafka intermediate on a throw event converts it to a catch event", () => {
		const base = Bpmn.parse(
			FIXTURE.replace(
				'<bpmn:endEvent id="end" />',
				'<bpmn:intermediateThrowEvent id="throw" /><bpmn:endEvent id="end" />',
			),
		)
		const { definitions, problems } = apply(
			base,
			"throw",
			"io.camunda.connectors.inbound.KafkaIntermediate.v1",
			{
				"topic.bootstrapServers": "kafka:9092",
				"topic.topicName": "orders",
				"message.correlationKey": "=orderId",
				correlationKeyExpression: "=value.orderId",
			},
		)
		expect(problems).toEqual([])
		const converted = element(roundTrip(definitions), "throw")
		expect(converted.type).toBe("intermediateCatchEvent")
		expect(zeebeProperties(converted)["inbound.type"]).toBe("io.camunda:connector-kafka-inbound:1")
		expect(messageRef(converted)).toBeDefined()
	})

	it("reuses a message already carrying the name, and renames an unshared one in place", () => {
		const id = "io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1"
		const values = (name: string) => ({
			"inbound.context": "c",
			"message.name": name,
			"message.correlationKey": "=k",
			correlationKeyExpression: "=k",
		})
		const first = apply(fixture(), "wait", id, values("paid")).definitions
		expect(first.messages.map((m) => m.name)).toEqual(["paid"])

		const renamed = applyTemplateToElement(first, "wait", template(id), values("settled"))
		expect(renamed.definitions.messages.map((m) => m.name)).toEqual(["settled"])
		expect(renamed.definitions.messages[0]?.id).toBe(first.messages[0]?.id)

		const shared = applyTemplateToElement(
			renamed.definitions,
			"cancelled",
			template("io.camunda.connectors.webhook.WebhookConnectorBoundary.v1"),
			values("settled"),
		).definitions
		expect(shared.messages).toHaveLength(1)
		expect(messageRef(element(shared, "cancelled"))).toBe(messageRef(element(shared, "wait")))
	})

	it("reports a missing required correlation key and still applies the rest", () => {
		const { definitions, problems } = apply(
			fixture(),
			"wait",
			"io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1",
			{ "inbound.context": "paid", correlationKeyExpression: "=k" },
		)
		expect(problems).toEqual([
			expect.objectContaining({ key: "message.correlationKey", kind: "missing-required" }),
		])
		const wait = element(definitions, "wait")
		expect(zeebeProperties(wait)["inbound.context"]).toBe("paid")
		expect(definitions.messages[0]?.extensionElements).toBeUndefined()
	})
})

describe("applyTemplateToElement — linked resources", () => {
	it("RPA on a plain task: a service task with zeebe:linkedResources", () => {
		const { definitions, problems } = apply(fixture(), "robot", "camunda.connectors.rpa", {
			"linkedResource.RPAScript.resourceId": "invoice-bot",
		})
		expect(problems).toEqual([])
		const robot = element(roundTrip(definitions), "robot")
		expect(robot.type).toBe("serviceTask")
		expect(robot.name).toBe("Run the robot")
		const links = extension(robot, "zeebe:linkedResources")?.children ?? []
		expect(links.map((l) => l.attributes)).toEqual([
			{
				linkName: "RPAScript",
				resourceType: "RPA",
				resourceId: "invoice-bot",
				bindingType: "latest",
			},
		])
		expect(extension(robot, "zeebe:taskDefinition")?.attributes.type).toMatch(/^=/)
	})

	it("writes the Boolean-gated pre-run script and its version tag", () => {
		const { definitions, problems } = apply(fixture(), "robot", "camunda.connectors.rpa", {
			"linkedResource.RPAScript.resourceId": "invoice-bot",
			enablePreRun: "true",
			"linkedResource.Before.resourceId": "login-bot",
			bindingTypePreRun: "versionTag",
			"linkedResource.Before.versionTag": "v2",
		})
		expect(problems).toEqual([])
		const robot = element(roundTrip(definitions), "robot")
		const links = extension(robot, "zeebe:linkedResources")?.children ?? []
		expect(links.map((l) => l.attributes.linkName)).toEqual(["RPAScript", "Before"])
		expect(links[1]?.attributes).toEqual({
			linkName: "Before",
			resourceType: "RPA",
			resourceId: "login-bot",
			bindingType: "versionTag",
			versionTag: "v2",
		})
	})
})

describe("applyTemplateToElement — re-applying", () => {
	it("removes what a switched-off property had written", () => {
		const on = apply(fixture(), "robot", "camunda.connectors.rpa", {
			"linkedResource.RPAScript.resourceId": "invoice-bot",
			enablePreRun: "true",
			"linkedResource.Before.resourceId": "login-bot",
		}).definitions
		const off = applyTemplateToElement(on, "robot", template("camunda.connectors.rpa"), {
			"linkedResource.RPAScript.resourceId": "invoice-bot",
		}).definitions
		const links = extension(element(off, "robot"), "zeebe:linkedResources")?.children ?? []
		expect(links.map((l) => l.attributes.linkName)).toEqual(["RPAScript"])
	})
})

describe("applyTemplateToElement — refusals", () => {
	it("leaves the model untouched for an unknown element", () => {
		const model = fixture()
		const result = apply(model, "nope", "io.camunda.connectors.webhook.WebhookConnector.v1")
		expect(result.definitions).toBe(model)
		expect(result.problems[0]?.message).toMatch(/No flow element "nope"/)
	})

	it("refuses a template whose appliesTo does not cover the element", () => {
		const model = fixture()
		const result = apply(model, "work", "io.camunda.connectors.webhook.WebhookConnector.v1")
		expect(result.definitions).toBe(model)
		expect(result.problems[0]?.message).toMatch(/applies to bpmn:StartEvent/)
	})

	it("never mutates the model it is given", () => {
		const model = fixture()
		const before = Bpmn.export(model)
		apply(model, "wait", "io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1", {
			"inbound.context": "c",
			"message.correlationKey": "=k",
			correlationKeyExpression: "=k",
		})
		expect(Bpmn.export(model)).toBe(before)
	})
})

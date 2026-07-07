import { describe, expect, it } from "vitest"
import { applyConnectorTemplate } from "../src/index.js"

describe("applyConnectorTemplate", () => {
	it("returns a problem for an unknown template id", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.DoesNotExist.v1", {})
		expect(result.problems).toHaveLength(1)
		expect(result.problems[0]?.message).toMatch(/Unknown connector template/)
	})

	it("applies the Slack connector: taskDefinition, zeebe:input bindings, no problems when all required values are given", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.Slack.v1", {
			method: "chat.postMessage",
			token: "{{secrets.SLACK_OAUTH_TOKEN}}",
			"data.channel": "#ops",
			"data.text": "Order failed validation",
		})
		expect(result.problems).toEqual([])
		expect(result.serviceTask?.taskType).toBe("io.camunda:slack:1")
		expect(result.serviceTask?.modelerTemplate).toBe("io.camunda.connectors.Slack.v1")
		const inputs = result.serviceTask?.ioMapping?.inputs ?? []
		expect(inputs).toContainEqual({ source: "chat.postMessage", target: "method" })
		expect(inputs).toContainEqual({
			source: "{{secrets.SLACK_OAUTH_TOKEN}}",
			target: "token",
		})
		expect(inputs).toContainEqual({ source: "#ops", target: "data.channel" })
	})

	it("flags a missing required value, tagged kind: missing-required", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.Slack.v1", {
			method: "chat.postMessage",
			"data.channel": "#ops",
			// token omitted
		})
		expect(result.problems.some((p) => p.key === "token" && p.kind === "missing-required")).toBe(
			true,
		)
	})

	it("flags an unknown value key, tagged kind: unknown-key (not missing-required)", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.Slack.v1", {
			method: "chat.postMessage",
			token: "x",
			"data.channel": "#ops",
			bogusKey: "nope",
		})
		const problem = result.problems.find((p) => p.key === "bogusKey")
		expect(problem?.kind).toBe("unknown-key")
	})

	it("a bound key that doesn't match any property's lookup key never surfaces as missing-required", () => {
		// Regression: a raw zeebe:input binding-name key that isn't a property's actual
		// lookup key (propertyKey()) must not be misreported as "missing required" — that's
		// what caused the deploy lint's connector/missing-required rule to false-positive on
		// SendGrid's "mailType" property (id "mailType", but bound to the unrelated-looking
		// zeebe:input name "unMappedFieldNotUseInModel.mailType").
		const result = applyConnectorTemplate("io.camunda.connectors.SendGrid.v2", {
			"unMappedFieldNotUseInModel.mailType": "x",
		})
		expect(
			result.problems.some(
				(p) => p.key === "unMappedFieldNotUseInModel.mailType" && p.kind === "missing-required",
			),
		).toBe(false)
	})

	it("flags an invalid FEEL expression on a FEEL-tagged value", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.Slack.v1", {
			method: "chat.postMessage",
			token: "x",
			"data.channel": "=this is not ) valid feel (",
		})
		expect(result.problems.some((p) => /Invalid FEEL expression/.test(p.message))).toBe(true)
	})

	it("maps an inbound start-event template's zeebe:property bindings onto startEvent", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.AWSEventBridge.startEvent.v1", {
			webhookId: "wh-123",
			"inbound.context": "orders",
		})
		expect(result.startEvent).toBeDefined()
		const props = result.startEvent?.zeebeProperties ?? []
		expect(props).toContainEqual({ name: "inbound.type", value: "io.camunda:webhook:1" })
		expect(props).toContainEqual({ name: "inbound.context", value: "orders" })
	})

	it("maps the AI Agent Sub-process template onto adHocSubProcess with the real resultVariable output binding", () => {
		const result = applyConnectorTemplate("io.camunda.connectors.agenticai.aiagent.jobworker.v1", {
			"provider.type": "anthropic",
			"provider.anthropic.model.model": "claude-sonnet-5",
			"provider.anthropic.authentication.apiKey": "{{secrets.ANTHROPIC_API_KEY}}",
			"data.systemPrompt.prompt": "You are helpful.",
			"data.userPrompt.prompt": "=userMessage",
			resultVariable: "triageResult",
		})
		expect(result.adHocSubProcess?.taskDefinition?.type).toBe(
			"io.camunda.agenticai:aiagent-job-worker:1",
		)
		const outputs = result.adHocSubProcess?.ioMapping?.outputs ?? []
		expect(outputs).toContainEqual({ source: "=agent", target: "triageResult" })
		const adHocOutputCollection = result.adHocSubProcess?.outputCollection
		expect(adHocOutputCollection).toBe("toolCallResults")
	})
})

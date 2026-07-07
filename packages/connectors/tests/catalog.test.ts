import { describe, expect, it } from "vitest"
import { getTemplate, listConnectors, searchConnectors } from "../src/index.js"

describe("listConnectors", () => {
	it("returns all 116+ bundled OOTB connector templates as summaries", () => {
		const summaries = listConnectors()
		expect(summaries.length).toBeGreaterThan(100)
		const ids = new Set(summaries.map((s) => s.id))
		expect(ids.size).toBe(summaries.length)
	})

	it("classifies the Slack connector as outbound with taskType io.camunda:slack:1", () => {
		const slack = listConnectors().find((s) => s.id === "io.camunda.connectors.Slack.v1")
		expect(slack).toBeDefined()
		expect(slack?.direction).toBe("outbound")
		expect(slack?.taskType).toBe("io.camunda:slack:1")
		expect(slack?.requiredInputs.some((i) => i.key === "token")).toBe(true)
		expect(slack?.requiredInputs.find((i) => i.key === "token")?.isSecret).toBe(true)
	})

	it("classifies the AI Agent Sub-process connector as agentic", () => {
		const agent = listConnectors().find(
			(s) => s.id === "io.camunda.connectors.agenticai.aiagent.jobworker.v1",
		)
		expect(agent).toBeDefined()
		expect(agent?.direction).toBe("agentic")
		expect(agent?.taskType).toBe("io.camunda.agenticai:aiagent-job-worker:1")
	})
})

describe("getTemplate", () => {
	it("returns the full element template for a known id", () => {
		const template = getTemplate("io.camunda.connectors.Slack.v1")
		expect(template?.properties.length).toBeGreaterThan(0)
	})

	it("returns undefined for an unknown id", () => {
		expect(getTemplate("io.camunda.connectors.DoesNotExist.v1")).toBeUndefined()
	})
})

describe("searchConnectors", () => {
	it("finds Slack when searching 'slack'", () => {
		const results = searchConnectors("slack")
		expect(results[0]?.id).toBe("io.camunda.connectors.Slack.v1")
	})

	it("finds email-capable connectors when searching 'send email'", () => {
		const results = searchConnectors("send email")
		expect(results.length).toBeGreaterThan(0)
		expect(results.some((r) => /email|sendgrid/i.test(r.id))).toBe(true)
	})

	it("returns an empty array for a query with no matches", () => {
		expect(searchConnectors("zzzznonexistentzzz")).toEqual([])
	})
})

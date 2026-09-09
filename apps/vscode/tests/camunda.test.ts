import { describe, expect, it } from "vitest"
import { DeployError, deployedProcesses, parseVariables } from "../src/host/camunda.js"

describe("deployedProcesses", () => {
	const response = {
		deploymentKey: "1",
		tenantId: "<default>",
		deployments: [
			{
				processDefinition: {
					processDefinitionId: "order",
					processDefinitionKey: "2251799813685249",
					processDefinitionVersion: 3,
					resourceName: "order.bpmn",
				},
			},
		],
	}

	it("reads the definitions a deploy produced", () => {
		expect(deployedProcesses(response)).toEqual([
			{ processDefinitionId: "order", processDefinitionKey: "2251799813685249", version: 3 },
		])
	})

	it("ignores deployment items that are not processes", () => {
		// The response type declares every kind on every item, but a DMN-only
		// deployment carries no processDefinition at all.
		const mixed = {
			deployments: [
				{ decisionDefinition: { decisionDefinitionId: "risk" } },
				response.deployments[0],
				{ form: { formId: "approval" } },
			],
		}
		expect(deployedProcesses(mixed).map((p) => p.processDefinitionId)).toEqual(["order"])
	})

	it("skips an item whose key or id is missing rather than inventing one", () => {
		const broken = { deployments: [{ processDefinition: { processDefinitionId: "order" } }] }
		expect(deployedProcesses(broken)).toEqual([])
	})

	it("defaults a missing version to 0 rather than printing undefined", () => {
		const noVersion = {
			deployments: [{ processDefinition: { processDefinitionId: "o", processDefinitionKey: "1" } }],
		}
		expect(deployedProcesses(noVersion)[0]?.version).toBe(0)
	})

	it("returns nothing for a response with no deployments", () => {
		expect(deployedProcesses({})).toEqual([])
		expect(deployedProcesses(null)).toEqual([])
		expect(deployedProcesses({ deployments: "not an array" })).toEqual([])
	})
})

describe("parseVariables", () => {
	it("reads a JSON object", () => {
		expect(parseVariables('{"amount": 100}')).toEqual({ amount: 100 })
	})

	it("treats empty as no variables, not as an error", () => {
		// Starting an instance with no data is the common case; making the user
		// type {} to say nothing would be a worse prompt.
		expect(parseVariables("")).toEqual({})
		expect(parseVariables("   ")).toEqual({})
	})

	it("keeps nested values intact", () => {
		expect(parseVariables('{"order": {"lines": [1, 2]}}')).toEqual({ order: { lines: [1, 2] } })
	})

	it("rejects JSON that is not an object", () => {
		expect(() => parseVariables("[1, 2]")).toThrow(DeployError)
		expect(() => parseVariables('"text"')).toThrow(DeployError)
		expect(() => parseVariables("null")).toThrow(DeployError)
	})

	it("rejects text that is not JSON, and says why", () => {
		expect(() => parseVariables("{amount: 100}")).toThrow(/Variables must be JSON/)
	})
})

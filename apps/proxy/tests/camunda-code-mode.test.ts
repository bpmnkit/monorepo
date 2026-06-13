import { describe, expect, it } from "vitest"
import { handleCamundaSearch } from "../src/aikit-mcp.js"
import { CAMUNDA_SPEC } from "../src/camunda-spec.js"

describe("CAMUNDA_SPEC", () => {
	it("contains at least 20 resource groups", () => {
		expect(Object.keys(CAMUNDA_SPEC).length).toBeGreaterThanOrEqual(20)
	})

	it("processInstance resource has searchProcessInstances", () => {
		expect(CAMUNDA_SPEC.processInstance?.searchProcessInstances).toBeDefined()
		expect(CAMUNDA_SPEC.processInstance.searchProcessInstances.endpoint).toContain(
			"process-instances",
		)
	})

	it("incident resource has resolveIncident", () => {
		expect(CAMUNDA_SPEC.incident?.resolveIncident).toBeDefined()
	})

	it("job resource has activateJobs", () => {
		expect(CAMUNDA_SPEC.job?.activateJobs).toBeDefined()
	})

	it("every method spec has all required fields", () => {
		for (const [resource, methods] of Object.entries(CAMUNDA_SPEC)) {
			for (const [method, s] of Object.entries(methods)) {
				expect(s.description, `${resource}.${method}.description`).toBeTruthy()
				expect(s.endpoint, `${resource}.${method}.endpoint`).toBeDefined()
				expect(s.params, `${resource}.${method}.params`).toBeTruthy()
				expect(s.returns, `${resource}.${method}.returns`).toBeTruthy()
			}
		}
	})
})

describe("camunda_search", () => {
	it("filters resource keys by substring", async () => {
		const result = await handleCamundaSearch(
			`return Object.keys(spec).filter(k => k.toLowerCase().includes('process'))`,
		)
		const keys = JSON.parse(result)
		expect(keys).toContain("processInstance")
		expect(keys).toContain("processDefinition")
	})

	it("returns method list for a resource", async () => {
		const result = await handleCamundaSearch("return Object.keys(spec.incident ?? {})")
		const methods = JSON.parse(result)
		expect(Array.isArray(methods)).toBe(true)
		expect(methods.length).toBeGreaterThan(0)
	})

	it("returns full spec for a single method", async () => {
		const result = await handleCamundaSearch("return spec.incident.resolveIncident")
		const s = JSON.parse(result)
		expect(s.description).toBeTruthy()
		expect(s.endpoint).toBeTruthy()
	})

	it("times out on infinite loop", async () => {
		await expect(handleCamundaSearch("while(true){}")).rejects.toThrow()
	}, 10000)
})

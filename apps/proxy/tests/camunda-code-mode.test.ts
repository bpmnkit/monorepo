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

import { vi } from "vitest"
import { handleCamundaExecute } from "../src/aikit-mcp.js"

vi.mock("@bpmnkit/api", () => ({
	CamundaClient: vi.fn().mockImplementation(() => ({
		processInstance: {
			searchProcessInstances: vi.fn().mockResolvedValue({
				items: [{ processInstanceKey: "123", state: "ACTIVE" }],
				total: 1,
			}),
		},
		incident: {
			resolveIncident: vi.fn().mockResolvedValue(undefined),
		},
	})),
}))

vi.mock("@bpmnkit/profiles", async (orig) => ({
	...(await orig<typeof import("@bpmnkit/profiles")>()),
	getActiveProfile: vi.fn().mockReturnValue({
		name: "test",
		apiType: "c8" as const,
		config: { baseUrl: "http://localhost:8080", auth: { type: "none" as const } },
		createdAt: null,
	}),
}))

describe("camunda_execute", () => {
	it("runs code with camunda proxy and returns JSON", async () => {
		const result = await handleCamundaExecute(
			`const r = await camunda.processInstance.searchProcessInstances({ filter: { state: 'ACTIVE' } })
       return r.items`,
		)
		const parsed = JSON.parse(result)
		expect(parsed).toEqual([{ processInstanceKey: "123", state: "ACTIVE" }])
	})

	it("throws when no active profile", async () => {
		const { getActiveProfile } = await import("@bpmnkit/profiles")
		vi.mocked(getActiveProfile).mockReturnValueOnce(null)
		await expect(handleCamundaExecute("return 1")).rejects.toThrow("No active Camunda profile")
	})

	it("propagates API errors from the host function", async () => {
		const { CamundaClient } = await import("@bpmnkit/api")
		vi.mocked(CamundaClient).mockImplementationOnce(
			() =>
				({
					incident: {
						resolveIncident: vi.fn().mockRejectedValue(new Error("404 Not Found")),
					},
				}) as never,
		)
		await expect(
			handleCamundaExecute(`await camunda.incident.resolveIncident({ incidentKey: 'bad' })`),
		).rejects.toThrow()
	})
})

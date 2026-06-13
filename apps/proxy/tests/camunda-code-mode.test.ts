import { describe, expect, it } from "vitest"
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
				expect(s.params, `${resource}.${method}.params`).toBeTruthy()
				expect(s.returns, `${resource}.${method}.returns`).toBeTruthy()
			}
		}
	})
})

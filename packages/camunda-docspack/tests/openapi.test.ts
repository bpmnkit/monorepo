import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { readOperations } from "../src/openapi.js"

const entry = fileURLToPath(new URL("fixtures/main.yaml", import.meta.url))
const operations = readOperations(entry)
const activate = operations.find((operation) => operation.operationId === "activateJobs")

describe("readOperations", () => {
	it("follows a $ref from the entry document into a sibling file", () => {
		expect(operations.map((operation) => operation.operationId)).toEqual(["activateJobs", "getJob"])
	})

	it("uses the slug Camunda publishes the operation's page at", () => {
		expect(activate?.slug).toBe("activate-jobs")
	})

	it("states the address the call is made to", () => {
		expect(activate?.digest).toContain("`POST /jobs/activation`")
	})

	// These three are encoded as [[MARKER:...]] in the description and rendered as admonitions
	// on Camunda's own site. Stripping them would drop the answer to "what may call this?".
	it("decodes the base64 permissions marker", () => {
		expect(activate?.digest).toContain(
			"Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.",
		)
	})

	it("decodes the version and consistency markers", () => {
		expect(activate?.digest).toContain("Added in Camunda 8.6.")
		expect(activate?.digest).toContain("Consistency: strong.")
	})

	it("leaves no marker syntax in the prose", () => {
		expect(activate?.digest).not.toMatch(/\[\[/)
		expect(activate?.digest).toContain("Iterate through all known partitions.")
	})

	it("names the request body schema and its fields", () => {
		expect(activate?.digest).toContain("application/json: JobActivationRequest (required)")
		expect(activate?.digest).toContain("type (string, required)")
		expect(activate?.digest).toContain("tenantIds (string[])")
	})

	it("cuts a long field note at a word boundary, not at an abbreviation's full stop", () => {
		expect(activate?.digest).toContain("(e.g. a payment service)")
		expect(activate?.digest).toMatch(/…/)
	})

	it("resolves a response that references another file", () => {
		expect(activate?.digest).toContain("400 ProblemDetail — The provided data is not valid.")
	})

	it("lists the authentication schemes", () => {
		expect(activate?.digest).toContain("Authentication: bearerAuth or basicAuth")
	})

	it("describes path parameters", () => {
		const job = operations.find((operation) => operation.operationId === "getJob")
		expect(job?.digest).toContain("jobKey (path, string, required)")
	})

	// Without these the digest loses every query to the concept pages that merely mention jobs.
	it("carries the words someone would search for as tags", () => {
		expect(activate?.tags).toEqual(expect.arrayContaining(["activate", "jobs", "post", "job"]))
	})

	it("carries both spellings of the operation's address as entities", () => {
		expect(activate?.entities).toEqual(["activateJobs", "POST /jobs/activation"])
	})
})

import { describe, expect, it } from "vitest"
import { resolveConnectorRequirements } from "./lint.js"

describe("resolveConnectorRequirements", () => {
	it("does not report a bound key as missing when it doesn't match any property's lookup key", () => {
		// Regression: SendGrid.v2's "mailType" property has id "mailType" (its lookup key),
		// but is bound to the unrelated-looking zeebe:input name
		// "unMappedFieldNotUseInModel.mailType" — the compiled element's actual bound key.
		// resolveConnectorRequirements() must not misreport that mismatch as "missing required".
		const missing = resolveConnectorRequirements("io.camunda.connectors.SendGrid.v2", [
			"unMappedFieldNotUseInModel.mailType",
			"apiKey",
			"from.name",
			"from.email",
			"to.name",
			"to.email",
			"content.subject",
			"content.type",
			"content.value",
		])
		expect(missing).toEqual([])
	})

	it("still reports a genuinely missing required key", () => {
		const missing = resolveConnectorRequirements("io.camunda.connectors.Slack.v1", [
			"method",
			"data.channel",
			// token omitted
		])
		expect(missing).toContain("token")
	})
})

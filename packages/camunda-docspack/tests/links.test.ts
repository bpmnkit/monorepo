import { describe, expect, it } from "vitest"
import { absoluteLinks } from "../src/links.js"

const slug = "components/best-practices/modeling/naming-bpmn-elements"

describe("absoluteLinks", () => {
	it("rewrites a root-relative page link and keeps its anchor", () => {
		const out = absoluteLinks("[jobs](/components/concepts/job-workers.md#completing)", slug)
		expect(out).toBe(
			"[jobs](https://docs.camunda.io/docs/next/components/concepts/job-workers#completing)",
		)
	})

	it("resolves a relative link against the linking page's own directory", () => {
		const out = absoluteLinks("[ids](../naming-technically-relevant-ids/)", slug)
		expect(out).toBe(
			"[ids](https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-technically-relevant-ids)",
		)
	})

	it("resolves a link that climbs past its own section", () => {
		const out = absoluteLinks("[x](../../development/writing-good-workers)", slug)
		expect(out).toBe(
			"[x](https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers)",
		)
	})

	// The two forms resolve differently, and applying either rule to both breaks about a third
	// of the corpus's links. These two cases are the regression guard for that.
	it("resolves a .md link against the file's directory", () => {
		const out = absoluteLinks(
			"[x](./sizing-your-environment.md)",
			"components/architecture/data-flow",
		)
		expect(out).toBe(
			"[x](https://docs.camunda.io/docs/next/components/architecture/sizing-your-environment)",
		)
	})

	it("resolves an extensionless link against the page's own trailing-slash URL", () => {
		const out = absoluteLinks("[x](../naming-bpmn-elements/)", "components/modeling/naming-ids")
		expect(out).toBe(
			"[x](https://docs.camunda.io/docs/next/components/modeling/naming-bpmn-elements)",
		)
	})

	it("leaves an external link alone", () => {
		const source = "[spec](https://www.omg.org/spec/BPMN/2.0/)"
		expect(absoluteLinks(source, slug)).toBe(source)
	})

	it("leaves an in-page anchor alone", () => {
		expect(absoluteLinks("[top](#naming-events)", slug)).toBe("[top](#naming-events)")
	})

	it("leaves an asset alone, since it is not served from the docs tree", () => {
		expect(absoluteLinks("![x](/img/diagram.png)", slug)).toBe("![x](/img/diagram.png)")
	})

	it("keeps a link title", () => {
		const out = absoluteLinks('[x](/reference/glossary.md "Glossary")', slug)
		expect(out).toBe('[x](https://docs.camunda.io/docs/next/reference/glossary "Glossary")')
	})
})

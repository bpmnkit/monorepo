import { Bpmn } from "@bpmnkit/core"

/**
 * A one-task process in the builder's own output — laid out, so the editor
 * can draw it. `taskName` varies it, to make an edit.
 */
export function orderXml(taskName = "Check stock"): string {
	return Bpmn.export(
		Bpmn.createProcess("order-process")
			.name("Order process")
			.withAutoLayout()
			.startEvent("start", { name: "Order received" })
			.serviceTask("check", { name: taskName, taskType: "check-stock" })
			.endEvent("end", { name: "Done" })
			.build(),
	)
}

/** Scenarios for {@link orderXml}; `expectInStock` decides whether the second one passes. */
export function orderTests(expectInStock: boolean): string {
	return `${JSON.stringify(
		[
			{
				id: "s1",
				name: "happy path",
				mocks: { "check-stock": { outputs: { inStock: true } } },
				expect: { path: ["start", "check", "end"], variables: { inStock: true } },
			},
			{
				id: "s2",
				name: "out of stock",
				mocks: { "check-stock": { outputs: { inStock: false } } },
				expect: { variables: { inStock: expectInStock } },
			},
		],
		null,
		2,
	)}\n`
}

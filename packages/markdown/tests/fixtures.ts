import { Bpmn } from "@bpmnkit/core"

/** A single process in the compact shorthand (no `processes` wrapper). */
export const COMPACT = JSON.stringify({
	id: "order",
	name: "Order fulfilment",
	elements: [
		{ id: "start", type: "startEvent", name: "Order received" },
		{ id: "check", type: "serviceTask", name: "Check stock", jobType: "check-stock" },
		{ id: "gw", type: "exclusiveGateway", name: "In stock?" },
		{ id: "ship", type: "userTask", name: "Ship order" },
		{ id: "end", type: "endEvent", name: "Shipped" },
		{ id: "cancel", type: "endEvent", name: "Cancelled" },
	],
	flows: [
		{ id: "f1", from: "start", to: "check" },
		{ id: "f2", from: "check", to: "gw" },
		{ id: "f3", from: "gw", to: "ship", condition: "=inStock" },
		{ id: "f4", from: "gw", to: "cancel", isDefault: true },
		{ id: "f5", from: "ship", to: "end" },
	],
})

/** The same process as a full `CompactDiagram`. */
export const COMPACT_FULL = JSON.stringify({
	id: "Definitions_order",
	processes: [JSON.parse(COMPACT)],
})

/** BPMN XML with diagram interchange. */
export const XML_WITH_DI = Bpmn.export(
	Bpmn.createProcess("invoice")
		.name("Invoice approval")
		.startEvent("received", { name: "Invoice received" })
		.userTask("approve", { name: "Approve <invoice> & pay" })
		.endEvent("done", { name: "Done" })
		.withAutoLayout()
		.build(),
)

/** BPMN XML with no `<bpmndi:BPMNDiagram>` at all. */
export const XML_WITHOUT_DI = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="leave" name="Leave request" isExecutable="true">
    <bpmn:startEvent id="s" name="Requested" />
    <bpmn:userTask id="t" name="Review request" />
    <bpmn:endEvent id="e" name="Decided" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`

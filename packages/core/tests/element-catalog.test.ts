import { describe, expect, it } from "vitest"
import type { BpmnElementType } from "../src/bpmn/bpmn-model.js"
import { compactify, expand } from "../src/bpmn/compact.js"
import {
	ELEMENT_GROUP_ORDER,
	ELEMENT_TYPE_GROUPS,
	allElementTypes,
	elementTypesInGroup,
} from "../src/bpmn/element-catalog.js"
import { createFlowElement, retypeElement } from "../src/bpmn/element-shape.js"
import { Bpmn } from "../src/bpmn/index.js"
import { ELEMENT_SIZES } from "../src/layout/types.js"

/**
 * Three surfaces that used to drift from the element model, and now cannot.
 *
 * - `ELEMENT_TYPE_GROUPS` is what tool schemas and prompts render their type
 *   lists from, instead of each writing its own string. The MCP schema listed
 *   18 of the 23 types the compact path accepted; five constructs worked but
 *   were undiscoverable.
 * - `expand()` ended in `default: type: "task"`, so the three data types
 *   round-tripped through the compact format as bare tasks.
 * - `retypeElement` is the operation an agent needs to change a task's type.
 *   Without it the only way was to edit the XML.
 */

describe("element catalog", () => {
	it("groups every element type", () => {
		expect(allElementTypes().length).toBe(26)
		for (const type of allElementTypes()) {
			expect(ELEMENT_GROUP_ORDER).toContain(ELEMENT_TYPE_GROUPS[type])
		}
	})

	it("partitions the types — every type in exactly one group", () => {
		const fromGroups = ELEMENT_GROUP_ORDER.flatMap((group) => elementTypesInGroup(group))
		expect(fromGroups.slice().sort()).toEqual(allElementTypes().slice().sort())
		expect(new Set(fromGroups).size).toBe(fromGroups.length)
	})

	it("leaves no group empty", () => {
		for (const group of ELEMENT_GROUP_ORDER) {
			expect(elementTypesInGroup(group).length, `${group} is empty`).toBeGreaterThan(0)
		}
	})

	it("gives every element type a layout size", () => {
		// ELEMENT_SIZES is a Record<string, …> for callers' sake, so the compiler
		// cannot require it to be total. A missing entry falls back to 100×80 —
		// an activity's size — which silently draws data elements as tasks.
		const unsized = allElementTypes().filter((type) => ELEMENT_SIZES[type] === undefined)
		expect(unsized, "These types would fall back to the default activity size.").toEqual([])
	})

	it("covers the types that were missing from the tool schema", () => {
		// The five that worked but were not advertised.
		for (const type of [
			"receiveTask",
			"task",
			"complexGateway",
			"transaction",
			"eventSubProcess",
		] satisfies BpmnElementType[]) {
			expect(allElementTypes()).toContain(type)
		}
	})
})

describe("createFlowElement", () => {
	it("builds every element type with the right discriminant", () => {
		for (const type of allElementTypes()) {
			expect(createFlowElement(`el_${type}`, type).type).toBe(type)
		}
	})

	it("gives containers their nested collections", () => {
		for (const type of elementTypesInGroup("container")) {
			const el = createFlowElement("c", type)
			expect("flowElements" in el, `${type} has no flowElements`).toBe(true)
		}
	})

	it("gives events an empty eventDefinitions list", () => {
		for (const type of elementTypesInGroup("event")) {
			const el = createFlowElement("e", type)
			expect("eventDefinitions" in el, `${type} has no eventDefinitions`).toBe(true)
		}
	})
})

describe("retypeElement", () => {
	function taskIn(xml: string, id: string) {
		const el = Bpmn.parse(xml).processes[0]?.flowElements.find((e) => e.id === id)
		if (!el) throw new Error(`no element ${id}`)
		return el
	}

	const XML = Bpmn.export(
		Bpmn.createProcess("P")
			.startEvent("s")
			.serviceTask("t", { name: "Charge", taskType: "payment" })
			.endEvent("e")
			.build(),
	)

	it("keeps id, name and wiring when the type changes", () => {
		const before = taskIn(XML, "t")
		const after = retypeElement(before, "manualTask")

		expect(after.type).toBe("manualTask")
		expect(after.id).toBe("t")
		expect(after.name).toBe("Charge")
		expect(after.incoming).toEqual(before.incoming)
		expect(after.outgoing).toEqual(before.outgoing)
		expect(after.incoming.length).toBe(1)
		expect(after.outgoing.length).toBe(1)
	})

	it("drops a job worker the new type cannot carry", () => {
		const before = taskIn(XML, "t")
		expect(before.extensionElements.some((x) => x.name === "zeebe:taskDefinition")).toBe(true)

		const after = retypeElement(before, "manualTask")
		expect(after.extensionElements.some((x) => x.name === "zeebe:taskDefinition")).toBe(false)
	})

	it("keeps a job worker when the new type can still carry it", () => {
		const after = retypeElement(taskIn(XML, "t"), "serviceTask")
		expect(after.type).toBe("serviceTask")
	})

	it("does not mutate the element it is given", () => {
		const before = taskIn(XML, "t")
		retypeElement(before, "userTask")
		expect(before.type).toBe("serviceTask")
	})

	it("returns the same element when the type already matches", () => {
		const before = taskIn(XML, "t")
		expect(retypeElement(before, "serviceTask")).toBe(before)
	})

	it("carries nested content between container types", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("P")
				.startEvent("s")
				.subProcess("sub", (b) => {
					b.startEvent("ss").serviceTask("inner", { taskType: "x" }).endEvent("se")
				})
				.endEvent("e")
				.build(),
		)
		const after = retypeElement(taskIn(xml, "sub"), "transaction")

		expect(after.type).toBe("transaction")
		expect("flowElements" in after ? after.flowElements.map((el) => el.id) : []).toContain("inner")
	})

	it("produces a document that still round-trips", () => {
		const defs = Bpmn.parse(XML)
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		const index = proc.flowElements.findIndex((el) => el.id === "t")
		const current = proc.flowElements[index]
		if (!current) throw new Error("no element")
		proc.flowElements[index] = retypeElement(current, "userTask")

		const xml = Bpmn.export(defs)
		expect(xml).toContain('<bpmn:userTask id="t"')
		expect(xml).not.toContain("<bpmn:serviceTask")
		// The sequence flows around it must survive untouched.
		expect(Bpmn.parse(xml).processes[0]?.sequenceFlows.length).toBe(2)
	})
})

describe("the compact path keeps data elements", () => {
	const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="t">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:task id="t" name="Do"/>
    <bpmn:dataObject id="do" name="Order" isCollection="true"/>
    <bpmn:dataObjectReference id="dor" name="Order Ref" dataObjectRef="do" isCollection="true"/>
    <bpmn:dataStoreReference id="dsr" name="Store" dataStoreRef="store"/>
  </bpmn:process>
</bpmn:definitions>`

	it("round-trips their types through compactify → expand", () => {
		const restored = expand(compactify(Bpmn.parse(XML))).processes[0]
		const byId = new Map(restored?.flowElements.map((el) => [el.id, el]) ?? [])

		// Each of these used to come back as "task".
		expect(byId.get("do")?.type).toBe("dataObject")
		expect(byId.get("dor")?.type).toBe("dataObjectReference")
		expect(byId.get("dsr")?.type).toBe("dataStoreReference")
	})

	it("round-trips the references they carry", () => {
		const restored = expand(compactify(Bpmn.parse(XML))).processes[0]
		const dor = restored?.flowElements.find((el) => el.id === "dor")
		const dsr = restored?.flowElements.find((el) => el.id === "dsr")

		expect(dor && "dataObjectRef" in dor ? dor.dataObjectRef : undefined).toBe("do")
		expect(dor && "isCollection" in dor ? dor.isCollection : undefined).toBe(true)
		expect(dsr && "dataStoreRef" in dsr ? dsr.dataStoreRef : undefined).toBe("store")
	})

	it("expands every element type to itself", () => {
		// expand() used to end in `default: type: "task"`. Its switch is now
		// exhaustive, and this proves no type takes a wrong branch on the way.
		for (const type of allElementTypes()) {
			const restored = expand({
				id: "d",
				processes: [{ id: "p", elements: [{ id: "x", type }], flows: [] }],
			})
			expect(restored.processes[0]?.flowElements[0]?.type, `${type} expanded wrongly`).toBe(type)
		}
	})
})

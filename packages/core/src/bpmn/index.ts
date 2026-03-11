import { applyAutoLayout } from "./auto-layout.js"
import { ProcessBuilder } from "./bpmn-builder.js"
import type { BpmnDefinitions } from "./bpmn-model.js"
import { parseBpmn } from "./bpmn-parser.js"
import { serializeBpmn } from "./bpmn-serializer.js"

/** A minimal 3-element BPMN diagram useful for first-launch or "New Diagram" defaults. */
export const SAMPLE_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task1" name="Process Order">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="152" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task1_di" bpmnElement="task1">
        <dc:Bounds x="260" y="180" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="188" y="220"/>
        <di:waypoint x="260" y="220"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="360" y="220"/>
        <di:waypoint x="432" y="220"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

/**
 * Entry point for all BPMN operations — parsing, building, exporting, and
 * creating empty diagrams.
 *
 * @example
 * ```typescript
 * import { Bpmn } from "@bpmn-sdk/core"
 *
 * // Parse existing XML
 * const defs = Bpmn.parse(xml)
 *
 * // Build a new process
 * const defs2 = Bpmn.createProcess("order")
 *   .startEvent("start")
 *   .serviceTask("task", { name: "Process", taskType: "process" })
 *   .endEvent("end")
 *   .withAutoLayout()
 *   .build()
 *
 * const xml2 = Bpmn.export(defs2)
 * ```
 */
export const Bpmn = {
	/**
	 * Create a new BPMN process using the fluent builder API.
	 *
	 * @param processId - Unique identifier for the process (used as the XML `id` attribute).
	 *
	 * @example
	 * ```typescript
	 * const defs = Bpmn.createProcess("order-process")
	 *   .startEvent("start", { name: "Order received" })
	 *   .serviceTask("validate", { name: "Validate", taskType: "validate-order" })
	 *   .endEvent("end")
	 *   .withAutoLayout()
	 *   .build()
	 * ```
	 */
	createProcess(processId: string): ProcessBuilder {
		return new ProcessBuilder(processId)
	},

	/**
	 * Parse a BPMN 2.0 XML string into a typed {@link BpmnDefinitions} model.
	 *
	 * @param xml - BPMN 2.0 XML string (must contain a `<bpmn:definitions>` root).
	 * @returns Typed definitions object.
	 * @throws {ParseError} If the XML is malformed or a required attribute is missing.
	 *
	 * @example
	 * ```typescript
	 * import { Bpmn, ParseError } from "@bpmn-sdk/core"
	 *
	 * try {
	 *   const defs = Bpmn.parse(xmlString)
	 *   console.log(defs.processes[0].id)
	 * } catch (err) {
	 *   if (err instanceof ParseError) console.error(err.message)
	 * }
	 * ```
	 */
	parse(xml: string): BpmnDefinitions {
		return parseBpmn(xml)
	},

	/**
	 * Serialise a {@link BpmnDefinitions} model back to BPMN 2.0 XML.
	 *
	 * @param definitions - The typed BPMN model to export.
	 * @returns A BPMN 2.0 XML string.
	 *
	 * @example
	 * ```typescript
	 * const xml = Bpmn.export(defs)
	 * fs.writeFileSync("diagram.bpmn", xml, "utf-8")
	 * ```
	 */
	export(definitions: BpmnDefinitions): string {
		return serializeBpmn(definitions)
	},

	/**
	 * Returns a minimal valid BPMN XML string containing one process with a
	 * single start event. Useful for "New Diagram" / empty-canvas actions.
	 *
	 * @param processId - Process id (defaults to a random string).
	 * @param processName - Human-readable process name (defaults to `"New Process"`).
	 *
	 * @example
	 * ```typescript
	 * const xml = Bpmn.makeEmpty("order-process", "Order Process")
	 * editor.loadXml(xml)
	 * ```
	 */
	makeEmpty(
		processId = `Process_${Math.random().toString(36).slice(2, 9)}`,
		processName = "New Process",
	): string {
		const startId = `StartEvent_${processId}`
		return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="${processName}" isExecutable="true">
    <bpmn:startEvent id="${startId}"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">
    <bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="${startId}_di" bpmnElement="${startId}">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
	},

	/** A minimal 3-element sample diagram. Re-exported for convenience. */
	SAMPLE_XML: SAMPLE_BPMN_XML,

	/**
	 * Apply auto-layout to a BPMN XML string.
	 *
	 * Parses the XML, runs the Sugiyama layered layout algorithm on every process,
	 * replaces all BPMNDi positions with the computed layout, and returns the
	 * updated XML.  Works for plain processes and collaborations with pools/lanes.
	 *
	 * @param xml - BPMN 2.0 XML string
	 * @returns BPMN 2.0 XML string with updated diagram interchange
	 */
	autoLayout(xml: string): string {
		const defs = parseBpmn(xml)
		const laid = applyAutoLayout(defs)
		return serializeBpmn(laid)
	},
} as const

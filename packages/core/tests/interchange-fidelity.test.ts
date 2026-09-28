import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/index.js"

/**
 * Constructs the OMG MIWG reference models use that the parser used to reject or
 * drop. The corpus gate (`roundtrip-corpus.test.ts`) catches them at file level;
 * these pin down what the model holds.
 */

const NS = `xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
	xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
	xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
	xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`

function doc(body: string, attrs = ""): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${NS} id="d" targetNamespace="urn:t" ${attrs}>${body}</definitions>`
}

describe("diagram interchange", () => {
	const xml = doc(`
		<process id="p"><task id="t"/></process>
		<bpmndi:BPMNDiagram name="Main" resolution="96">
			<bpmndi:BPMNPlane bpmnElement="p" extra="1">
				<bpmndi:BPMNShape bpmnElement="t">
					<dc:Bounds x="0" y="0" width="100" height="80"/>
					<bpmndi:BPMNLabel labelStyle="LS1"/>
				</bpmndi:BPMNShape>
				<bpmndi:BPMNEdge>
					<di:waypoint xsi:type="dc:Point" x="1" y="2"/>
				</bpmndi:BPMNEdge>
			</bpmndi:BPMNPlane>
			<bpmndi:BPMNLabelStyle id="LS1"><dc:Font name="Arial" size="9"/></bpmndi:BPMNLabelStyle>
		</bpmndi:BPMNDiagram>`)

	it("parses DI elements that omit the optional id and bpmnElement", () => {
		const diagram = Bpmn.parse(xml).diagrams[0]
		expect(diagram?.id).toBe("")
		expect(diagram?.plane.id).toBe("")
		expect(diagram?.plane.edges[0]?.bpmnElement).toBe("")
	})

	it("keeps diagram, plane, label and waypoint attributes and label styles", () => {
		const diagram = Bpmn.parse(xml).diagrams[0]
		expect(diagram?.unknownAttributes).toEqual({ name: "Main", resolution: "96" })
		expect(diagram?.plane.unknownAttributes).toEqual({ extra: "1" })
		expect(diagram?.plane.shapes[0]?.label?.unknownAttributes).toEqual({ labelStyle: "LS1" })
		expect(diagram?.plane.edges[0]?.waypoints[0]?.unknownAttributes).toEqual({
			"xsi:type": "dc:Point",
		})
		expect(diagram?.unknownChildren?.[0]?.name).toBe("bpmndi:BPMNLabelStyle")
	})

	it("writes absent ids back absent", () => {
		const out = Bpmn.export(Bpmn.parse(xml))
		expect(out).toMatch(/<bpmndi:BPMNDiagram name="Main" resolution="96">/)
		expect(out).toMatch(/<bpmndi:BPMNEdge>/)
		expect(out).toContain('labelStyle="LS1"')
		expect(out).toContain("<bpmndi:BPMNLabelStyle")
	})

	it("adds no empty objects to a plain diagram", () => {
		const plain = doc(`
			<process id="p"><task id="t"/></process>
			<bpmndi:BPMNDiagram id="D"><bpmndi:BPMNPlane id="P" bpmnElement="p">
				<bpmndi:BPMNShape id="S" bpmnElement="t"><dc:Bounds x="0" y="0" width="1" height="1"/></bpmndi:BPMNShape>
			</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`)
		const diagram = Bpmn.parse(plain).diagrams[0]
		expect(diagram && "unknownAttributes" in diagram).toBe(false)
		expect(diagram && "unknownAttributes" in diagram.plane).toBe(false)
	})
})

describe("default namespace", () => {
	it("writes BPMN back unprefixed when the document made it the default", () => {
		const xml = doc(`<process id="p"><task id="t"/></process>`)
		const out = Bpmn.export(Bpmn.parse(xml))
		expect(out).toContain('<process id="p"')
		expect(out).not.toMatch(/<:|<\/:/)
		expect(Bpmn.parse(out).processes[0]?.flowElements[0]?.id).toBe("t")
	})
})

describe("semantic content", () => {
	it("keeps the name on definitions and collaborations", () => {
		const xml = doc(
			`<collaboration id="c" name="Order handling"><participant id="pa" processRef="p"/></collaboration>
			<process id="p"/>`,
			'name="Model"',
		)
		const defs = Bpmn.parse(xml)
		expect(defs.unknownAttributes.name).toBe("Model")
		expect(defs.collaborations[0]?.name).toBe("Order handling")
		const out = Bpmn.export(defs)
		expect(out).toContain('name="Model"')
		expect(out).toContain('name="Order handling"')
	})

	it("keeps an empty timer part and an empty condition", () => {
		const xml = doc(`<process id="p">
			<startEvent id="s1"><timerEventDefinition><timeDate/></timerEventDefinition></startEvent>
			<startEvent id="s2"><conditionalEventDefinition><condition xsi:type="tFormalExpression"/></conditionalEventDefinition></startEvent>
		</process>`)
		const elements = Bpmn.parse(xml).processes[0]?.flowElements ?? []
		const timer = elements[0]?.type === "startEvent" ? elements[0].eventDefinitions[0] : undefined
		const conditional =
			elements[1]?.type === "startEvent" ? elements[1].eventDefinitions[0] : undefined
		expect(timer).toMatchObject({ type: "timer", timeDate: "" })
		expect(conditional).toMatchObject({
			type: "conditional",
			condition: "",
			conditionAttributes: { "xsi:type": "tFormalExpression" },
		})
		const out = Bpmn.export(Bpmn.parse(xml))
		// BPMN is the default namespace in this document, so names come back unprefixed.
		expect(out).toMatch(/<timeDate ?\/>|<timeDate><\/timeDate>/)
		expect(out).toContain('<condition xsi:type="tFormalExpression"')
	})

	it("keeps a default flow on an activity, but not twice on a gateway", () => {
		const xml = doc(`<process id="p">
			<task id="t" default="f1"/>
			<exclusiveGateway id="g" default="f2"/>
			<sequenceFlow id="f1" sourceRef="t" targetRef="g"/>
			<sequenceFlow id="f2" sourceRef="g" targetRef="t"/>
		</process>`)
		const [task, gateway] = Bpmn.parse(xml).processes[0]?.flowElements ?? []
		expect(task?.unknownAttributes.default).toBe("f1")
		expect(gateway?.type === "exclusiveGateway" && gateway.default).toBe("f2")
		expect(gateway?.unknownAttributes.default).toBeUndefined()
		expect(Bpmn.export(Bpmn.parse(xml)).match(/default="/g)).toHaveLength(2)
	})

	it("keeps documentation and unknown children on a sequence flow", () => {
		const xml = doc(`<process id="p" xmlns:v="urn:v">
			<task id="a"/><task id="b"/>
			<sequenceFlow id="f" sourceRef="a" targetRef="b">
				<documentation>Why this path</documentation>
				<v:note/>
			</sequenceFlow>
		</process>`)
		const flow = Bpmn.parse(xml).processes[0]?.sequenceFlows[0]
		expect(flow?.documentation).toBe("Why this path")
		expect(flow?.unknownChildren?.[0]?.name).toBe("v:note")
		const out = Bpmn.export(Bpmn.parse(xml))
		expect(out).toContain("<documentation>Why this path</documentation>")
		expect(out).toContain("<v:note")
	})

	it("keeps extensions on data associations and the id of a loop", () => {
		const xml = doc(`<process id="p" xmlns:v="urn:v">
			<dataObject id="do"/>
			<task id="t">
				<multiInstanceLoopCharacteristics id="mi"/>
				<dataOutputAssociation id="a">
					<extensionElements><v:style color="red"/></extensionElements>
					<targetRef>do</targetRef>
				</dataOutputAssociation>
			</task>
		</process>`)
		const task = Bpmn.parse(xml).processes[0]?.flowElements.find((e) => e.id === "t")
		expect(task?.dataOutputAssociations?.[0]?.extensionElements?.[0]?.name).toBe("v:style")
		expect(task && "loopCharacteristics" in task && task.loopCharacteristics?.id).toBe("mi")
		const out = Bpmn.export(Bpmn.parse(xml))
		expect(out).toContain('<v:style color="red"')
		expect(out).toContain('multiInstanceLoopCharacteristics id="mi"')
	})
})

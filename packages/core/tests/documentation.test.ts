// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { Dmn } from "../src/dmn/index.js"
import { renderDocumentationDocx } from "../src/doc/docx.js"
import { renderDocumentationHtml } from "../src/doc/html.js"
import { renderDocumentationMarkdown } from "../src/doc/markdown.js"
import { buildProcessDocumentation } from "../src/doc/model.js"
import { humanizeDuration } from "../src/doc/model.js"
import { Form } from "../src/form/index.js"
import { parseXml } from "../src/xml/index.js"

/**
 * XML order is deliberately scrambled — end event first, the join before the
 * branches — so the flow order the document uses cannot come from the file.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="defs" targetNamespace="http://example.com">
  <bpmn:collaboration id="collab">
    <bpmn:participant id="pool" name="Claims &amp; Co" processRef="claims"/>
    <bpmn:participant id="customer" name="Customer"/>
    <bpmn:messageFlow id="mf1" sourceRef="customer" targetRef="start" messageRef="msg"/>
  </bpmn:collaboration>
  <bpmn:message id="msg" name="Claim filed">
    <bpmn:extensionElements><zeebe:subscription correlationKey="=claimId"/></bpmn:extensionElements>
  </bpmn:message>
  <bpmn:error id="err" name="Fraud" errorCode="FRAUD"/>
  <bpmn:process id="claims" isExecutable="true">
    <bpmn:documentation>Handles a claim.
Second line.</bpmn:documentation>
    <bpmn:laneSet id="ls">
      <bpmn:lane id="lane_ops" name="Operations">
        <bpmn:flowNodeRef>start</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>score</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>gw</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>end</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>join</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>pay</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="lane_adj" name="Adjusters">
        <bpmn:flowNodeRef>review</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>remind</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:endEvent id="end" name="Claim closed"/>
    <bpmn:exclusiveGateway id="join"/>
    <bpmn:userTask id="review" name="Review &lt;script&gt;alert(1)&lt;/script&gt;">
      <bpmn:documentation># not a heading | pipe *star*</bpmn:documentation>
      <bpmn:extensionElements>
        <zeebe:userTask/>
        <zeebe:formDefinition formId="review-form"/>
        <zeebe:assignmentDefinition candidateGroups="adjusters"/>
      </bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:boundaryEvent id="remind" name="Reminder" attachedToRef="review" cancelActivity="false">
      <bpmn:timerEventDefinition><bpmn:timeDuration>PT48H</bpmn:timeDuration></bpmn:timerEventDefinition>
    </bpmn:boundaryEvent>
    <bpmn:serviceTask id="pay" name="Pay out">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="payment-charge" retries="5"/>
        <zeebe:ioMapping><zeebe:input source="=amount" target="value"/></zeebe:ioMapping>
        <zeebe:taskHeaders><zeebe:header key="currency" value="EUR"/></zeebe:taskHeaders>
      </bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:exclusiveGateway id="gw" name="Risky?" default="f_low"/>
    <bpmn:businessRuleTask id="score" name="Score claim">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="risk" resultVariable="risk"/>
      </bpmn:extensionElements>
    </bpmn:businessRuleTask>
    <bpmn:startEvent id="start" name="Claim received">
      <bpmn:messageEventDefinition messageRef="msg"/>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="f_end" sourceRef="join" targetRef="end"/>
    <bpmn:sequenceFlow id="f_pay" sourceRef="pay" targetRef="join"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="score"/>
    <bpmn:sequenceFlow id="f2" sourceRef="score" targetRef="gw"/>
    <bpmn:sequenceFlow id="f_high" name="High" sourceRef="gw" targetRef="review">
      <bpmn:conditionExpression>= risk = "high"</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f_low" name="Low" sourceRef="gw" targetRef="pay"/>
    <bpmn:sequenceFlow id="f_rev" sourceRef="review" targetRef="join"/>
    <bpmn:sequenceFlow id="f_back" sourceRef="remind" targetRef="score"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d"><bpmndi:BPMNPlane id="p" bpmnElement="collab">
    <bpmndi:BPMNShape id="s_pool" bpmnElement="pool"><dc:Bounds x="0" y="0" width="900" height="300"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s_start" bpmnElement="start"><dc:Bounds x="60" y="80" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s_score" bpmnElement="score"><dc:Bounds x="140" y="58" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

const DMN = Dmn.createDecisionTable("risk")
	.name("Risk <level>")
	.hitPolicy("FIRST")
	.input({ label: "Amount", expression: "amount", typeRef: "number" })
	.output({ label: "Risk", name: "risk", typeRef: "string" })
	.rule({ inputs: ["> 1000"], outputs: ['"high"'], description: "Large | claims" })
	.rule({ inputs: ["-"], outputs: ['"low"'] })
	.build()

const FORM = Form.parse(
	JSON.stringify({
		id: "review-form",
		type: "default",
		components: [
			{ id: "t", type: "text", text: "# Intro" },
			{
				id: "a",
				type: "textfield",
				label: "Approved amount",
				key: "approved",
				validate: { required: true },
			},
			{
				id: "g",
				type: "group",
				label: "Outcome",
				components: [
					{
						id: "d",
						type: "select",
						label: "Decision",
						key: "decision",
						values: [
							{ label: "Pay", value: "pay" },
							{ label: "Reject", value: "reject" },
						],
					},
				],
			},
		],
	}),
)

const defs = () => Bpmn.parse(XML)
const options = () => ({ decisions: [DMN], forms: [FORM] })

describe("buildProcessDocumentation", () => {
	it("orders elements by the flow, not the XML", () => {
		const doc = buildProcessDocumentation(defs())
		const ids = doc.processes[0]?.elements.map((e) => e.id)
		// First branch (High → review) before the default branch, boundary after
		// its host's normal path, the join after both branches, end last.
		expect(ids).toEqual(["start", "score", "gw", "review", "remind", "pay", "join", "end"])
		expect(doc.processes[0]?.elements.map((e) => e.number)).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
		])
	})

	it("uses the pool name, lanes and element facts", () => {
		const doc = buildProcessDocumentation(defs(), options())
		const p = doc.processes[0]
		expect(doc.title).toBe("Claims & Co")
		expect(p?.participant).toBe("Claims & Co")
		expect(p?.documentation).toBe("Handles a claim.\nSecond line.")
		expect(p?.lanes.map((l) => [l.name, l.elements])).toEqual([
			[
				"Operations",
				["Claim received", "Score claim", "Risky?", "Pay out", "join", "Claim closed"],
			],
			["Adjusters", ["Review <script>alert(1)</script>", "Reminder"]],
		])
		const byId = new Map(p?.elements.map((e) => [e.id, e]))
		const props = (id: string) =>
			Object.fromEntries((byId.get(id)?.properties ?? []).map((q) => [q.label, q.value]))

		expect(byId.get("start")?.typeLabel).toBe("Message start event")
		expect(props("start")).toMatchObject({ Message: "Claim filed", "Correlation key": "=claimId" })
		expect(props("pay")).toMatchObject({
			"Job type": "payment-charge",
			Retries: "5",
			"Task headers": ["currency = EUR"],
			Inputs: ["value ← =amount"],
		})
		expect(props("score")).toMatchObject({ "Called decision": "risk", "Result variable": "risk" })
		expect(byId.get("score")?.properties[0]?.link).toEqual({ kind: "decision", id: "risk" })
		expect(props("review")).toMatchObject({ Form: "review-form", "Candidate groups": "adjusters" })
		expect(byId.get("remind")?.typeLabel).toBe("Timer boundary event (non-interrupting)")
		expect(props("remind")).toMatchObject({
			"Attached to": "Review <script>alert(1)</script>",
			"Timer duration": "PT48H (48 hours)",
		})
		expect(props("gw")["Next steps"]).toEqual([
			'High → Review <script>alert(1)</script> when = risk = "high"',
			"Low → Pay out (default)",
		])
		expect(byId.get("review")?.lane).toBe("Adjusters")
		expect(doc.messageFlows).toEqual([
			{ id: "mf1", from: "Customer", to: "Claim received", message: "Claim filed" },
		])
	})

	it("documents linked decisions and forms with their callers", () => {
		const doc = buildProcessDocumentation(defs(), options())
		expect(doc.decisions).toEqual([
			{
				id: "risk",
				name: "Risk <level>",
				hitPolicy: "FIRST",
				inputs: ["Amount"],
				outputs: ["Risk"],
				rules: [
					["> 1000", '"high"', "Large | claims"],
					["-", '"low"', ""],
				],
				calledBy: ["Score claim"],
			},
		])
		expect(doc.forms).toEqual([
			{
				id: "review-form",
				usedBy: ["Review <script>alert(1)</script>"],
				fields: [
					{
						label: "Approved amount",
						key: "approved",
						type: "textfield",
						required: true,
						options: "",
					},
					{
						label: "Outcome / Decision",
						key: "decision",
						type: "select",
						required: false,
						options: "Pay, Reject",
					},
				],
			},
		])
	})

	it("numbers sub-process children under their parent", () => {
		const built = Bpmn.createProcess("p")
			.startEvent("s")
			.subProcess(
				"sub",
				(b) => b.startEvent("in").serviceTask("work", { taskType: "w" }).endEvent("out"),
				{
					name: "Sub",
				},
			)
			.endEvent("e")
			.build()
		const els = buildProcessDocumentation(built).processes[0]?.elements ?? []
		expect(els.map((e) => [e.number, e.id, e.depth])).toEqual([
			["1", "s", 0],
			["2", "sub", 0],
			["2.1", "in", 1],
			["2.2", "work", 1],
			["2.3", "out", 1],
			["3", "e", 0],
		])
	})

	it("humanises ISO durations and leaves anything else alone", () => {
		expect(humanizeDuration("PT48H")).toBe("48 hours")
		expect(humanizeDuration("P1DT30M")).toBe("1 day 30 minutes")
		expect(humanizeDuration("P2M")).toBe("2 months")
		expect(humanizeDuration("=dueDate")).toBeUndefined()
		expect(humanizeDuration("P")).toBeUndefined()
	})
})

describe("renderDocumentationHtml", () => {
	it("is a self-contained document with contents, diagram and print styles", () => {
		const html = renderDocumentationHtml(defs(), options())
		expect(html.startsWith("<!DOCTYPE html>")).toBe(true)
		expect(html).toContain("@media print")
		expect(html).toContain("@page diagram")
		expect(html).not.toMatch(/<script|<link|@import|https?:\/\/(?!www\.w3\.org)/)
	})

	it("escapes every piece of model text", () => {
		const html = renderDocumentationHtml(defs(), options())
		expect(html).toContain("Review &lt;script&gt;alert(1)&lt;/script&gt;")
		expect(html).toContain("Risk &lt;level&gt;")
		expect(html).toContain("Claims &amp; Co")
	})

	it("renders into the sections a reader navigates by", () => {
		const html = renderDocumentationHtml(defs(), options())
		// happy-dom's HTML parser loses everything after a <style> nested in an
		// inline SVG (browsers do not), so the diagram is checked on its own.
		const svg = /<svg[\s\S]*<\/svg>/.exec(html)?.[0] ?? ""
		expect(() => parseXml(svg)).not.toThrow()
		const doc = new DOMParser().parseFromString(html.replace(svg, "<svg></svg>"), "text/html")
		expect(doc.querySelectorAll("script")).toHaveLength(0)
		expect(doc.querySelector("h1")?.textContent).toBe("Claims & Co")
		expect(doc.querySelector("#diagram")).not.toBeNull()
		expect(doc.querySelector("figure.diagram svg")).not.toBeNull()
		// Every contents link lands on something.
		const links = [...doc.querySelectorAll("nav.toc a")].map((a) => a.getAttribute("href") ?? "")
		expect(links.length).toBeGreaterThan(5)
		for (const href of links) expect(doc.getElementById(href.slice(1)), href).not.toBeNull()
		// Element cards in flow order; the hostile name is text, not markup.
		const titles = [...doc.querySelectorAll("article.element h4")].map((h) => h.textContent)
		expect(titles[3]).toBe("Review <script>alert(1)</script>")
		expect(titles).toHaveLength(8)
		// Decision and form links resolve.
		expect(doc.querySelector('a[href="#decision-risk"]')).not.toBeNull()
		expect(doc.getElementById("decision-risk")?.textContent).toBe("Risk <level>")
		expect(doc.getElementById("form-review-form")).not.toBeNull()
		expect(doc.querySelectorAll("section.decisions tbody tr")).toHaveLength(2)
	})

	it("is deterministic", () => {
		expect(renderDocumentationHtml(defs(), options())).toBe(
			renderDocumentationHtml(defs(), options()),
		)
	})

	it("leaves the diagram out on request, or when the model has no layout", () => {
		expect(renderDocumentationHtml(defs(), { diagram: false })).not.toContain("<svg")
		const noDi = Bpmn.createProcess("p").startEvent("s").endEvent("e").build()
		expect(renderDocumentationHtml(noDi)).not.toContain("<svg")
	})
})

describe("renderDocumentationMarkdown", () => {
	const md = renderDocumentationMarkdown(defs(), options())

	it("has headings and tables in flow order", () => {
		expect(md.startsWith("# Claims &amp; Co\n")).toBe(true)
		expect(md).toContain("### Steps at a glance")
		const details = [...md.matchAll(/^#### (\S+) /gm)].map((m) => m[1])
		expect(details).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"])
		expect(md).toContain("## Decisions")
		expect(md).toContain("## Forms")
	})

	it("escapes HTML and Markdown syntax in model text", () => {
		expect(md).toContain("Review &lt;script&gt;alert(1)&lt;/script&gt;")
		expect(md).not.toContain("<script>")
		expect(md).toContain("\\# not a heading \\| pipe \\*star\\*")
		expect(md).toContain("Large \\| claims")
		expect(md).not.toContain("<svg")
	})

	it("is deterministic", () => {
		expect(renderDocumentationMarkdown(defs(), options())).toBe(md)
	})
})

/** Reads a STORE-only zip back into its files. */
function unzip(bytes: Uint8Array): Map<string, string> {
	const files = new Map<string, string>()
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const dec = new TextDecoder()
	let pos = 0
	while (view.getUint32(pos, true) === 0x04034b50) {
		expect(view.getUint16(pos + 8, true)).toBe(0) // STORE
		const size = view.getUint32(pos + 18, true)
		const nameLen = view.getUint16(pos + 26, true)
		const extra = view.getUint16(pos + 28, true)
		const name = dec.decode(bytes.subarray(pos + 30, pos + 30 + nameLen))
		const start = pos + 30 + nameLen + extra
		files.set(name, dec.decode(bytes.subarray(start, start + size)))
		pos = start + size
	}
	return files
}

describe("renderDocumentationDocx", () => {
	it("writes a well-formed OOXML package", () => {
		const files = unzip(renderDocumentationDocx(defs(), options()))
		expect([...files.keys()]).toEqual([
			"[Content_Types].xml",
			"_rels/.rels",
			"word/document.xml",
			"word/styles.xml",
			"word/_rels/document.xml.rels",
			"word/media/diagram.svg",
		])
		for (const [name, content] of files) {
			if (name.endsWith(".xml") || name.endsWith(".rels"))
				expect(() => parseXml(content), name).not.toThrow()
		}
		const document = files.get("word/document.xml") ?? ""
		expect(document).toContain("Review &lt;script&gt;alert(1)&lt;/script&gt;")
		expect(document).toContain('w:orient="landscape"')
		expect(document).toContain("payment-charge")
		expect(document).toContain("Large | claims")
	})

	it("uses the requested paper size and is deterministic", () => {
		const a = renderDocumentationDocx(defs(), { paper: "letter" })
		const doc = unzip(a).get("word/document.xml") ?? ""
		expect(doc).toContain('w:w="12240" w:h="15840"')
		expect(renderDocumentationDocx(defs(), { paper: "letter" })).toEqual(a)
	})

	it("drops the image part when there is no diagram", () => {
		const files = unzip(renderDocumentationDocx(defs(), { diagram: false }))
		expect(files.has("word/media/diagram.svg")).toBe(false)
		expect(files.get("word/_rels/document.xml.rels")).not.toContain("rIdDiagram")
	})

	it("drops control characters XML cannot carry", () => {
		// Form JSON is not XML, so nothing upstream has rejected these.
		const form = Form.parse(
			JSON.stringify({
				id: "f",
				type: "default",
				components: [{ id: "a", type: "textfield", label: "Bell\u0007 here", key: "k" }],
			}),
		)
		const document = unzip(renderDocumentationDocx(defs(), { forms: [form] })).get(
			"word/document.xml",
		)
		expect(document).toContain("Bell here")
		expect(() => parseXml(document ?? "")).not.toThrow()
	})
})

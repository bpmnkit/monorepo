import type { FileKind } from "../shared/constants.js"
import { DEMO_SHARE_ID } from "../shared/constants.js"
import type { DropRow, FileInfo } from "./db.js"
import { sha256Hex } from "./ids.js"
import { validateFile } from "./validate.js"

export { DEMO_SHARE_ID }

/** True when a share id refers to the built-in demo (served from memory, never in D1). */
export function isDemo(shareId: string): boolean {
	return shareId === DEMO_SHARE_ID
}

// A three-file loan-approval process: a BPMN whose user task and business-rule
// task reference the bundled Form and DMN — so the demo shows cross-file links,
// tabs, and all three viewers. Kept in memory: no seeding, works on a fresh deploy.
const DEMO_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="loan_definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="loan-approval" name="Loan Approval" isExecutable="true">
    <bpmn:startEvent id="start" name="Application Received">
      <bpmn:outgoing>f1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="fillForm" name="Fill Application Form">
      <bpmn:extensionElements>
        <zeebe:formDefinition formId="loanApplicationForm"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:businessRuleTask id="assessRisk" name="Assess Credit Risk">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="creditRiskDecision" resultVariable="risk"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f2</bpmn:incoming>
      <bpmn:outgoing>f3</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:exclusiveGateway id="approved" name="Approved?">
      <bpmn:incoming>f3</bpmn:incoming>
      <bpmn:outgoing>f4</bpmn:outgoing>
      <bpmn:outgoing>f5</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="disburse" name="Disburse Funds">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="disburse-funds"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f4</bpmn:incoming>
      <bpmn:outgoing>f6</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="reject" name="Send Rejection Notice">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="send-email"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f5</bpmn:incoming>
      <bpmn:outgoing>f7</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="endApproved" name="Loan Approved">
      <bpmn:incoming>f6</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="endRejected" name="Loan Rejected">
      <bpmn:incoming>f7</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="fillForm"/>
    <bpmn:sequenceFlow id="f2" sourceRef="fillForm" targetRef="assessRisk"/>
    <bpmn:sequenceFlow id="f3" sourceRef="assessRisk" targetRef="approved"/>
    <bpmn:sequenceFlow id="f4" sourceRef="approved" targetRef="disburse" name="approved"/>
    <bpmn:sequenceFlow id="f5" sourceRef="approved" targetRef="reject" name="rejected"/>
    <bpmn:sequenceFlow id="f6" sourceRef="disburse" targetRef="endApproved"/>
    <bpmn:sequenceFlow id="f7" sourceRef="reject" targetRef="endRejected"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_loan-approval">
    <bpmndi:BPMNPlane id="BPMNPlane_loan-approval" bpmnElement="loan-approval">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="57" y="52" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="5" y="92" width="140" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fillForm_di" bpmnElement="fillForm">
        <dc:Bounds x="175" y="30" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="assessRisk_di" bpmnElement="assessRisk">
        <dc:Bounds x="325" y="30" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="approved_di" bpmnElement="approved">
        <dc:Bounds x="500" y="45" width="50" height="50"/>
        <bpmndi:BPMNLabel><dc:Bounds x="493.5" y="99" width="63" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="disburse_di" bpmnElement="disburse">
        <dc:Bounds x="625" y="30" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="endApproved_di" bpmnElement="endApproved">
        <dc:Bounds x="807" y="52" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="779.5" y="92" width="91" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="reject_di" bpmnElement="reject">
        <dc:Bounds x="625" y="170" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="endRejected_di" bpmnElement="endRejected">
        <dc:Bounds x="807" y="192" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="779.5" y="232" width="91" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="93" y="70"/><di:waypoint x="175" y="70"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f2_di" bpmnElement="f2"><di:waypoint x="275" y="70"/><di:waypoint x="325" y="70"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f3_di" bpmnElement="f3"><di:waypoint x="425" y="70"/><di:waypoint x="500" y="70"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f4_di" bpmnElement="f4"><di:waypoint x="550" y="70"/><di:waypoint x="625" y="70"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f5_di" bpmnElement="f5"><di:waypoint x="525" y="95"/><di:waypoint x="525" y="210"/><di:waypoint x="625" y="210"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f6_di" bpmnElement="f6"><di:waypoint x="725" y="70"/><di:waypoint x="807" y="70"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f7_di" bpmnElement="f7"><di:waypoint x="725" y="210"/><di:waypoint x="807" y="210"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const DEMO_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="creditRisk_defs" name="Credit Risk" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="creditRiskDecision" name="Credit Risk Assessment">
    <decisionTable id="creditRiskTable" hitPolicy="FIRST">
      <input id="in_score" label="Credit Score">
        <inputExpression id="ie_score" typeRef="number"><text>creditScore</text></inputExpression>
      </input>
      <input id="in_amount" label="Loan Amount">
        <inputExpression id="ie_amount" typeRef="number"><text>amount</text></inputExpression>
      </input>
      <output id="out_risk" label="Risk" name="risk" typeRef="string"/>
      <rule id="r1"><inputEntry id="r1i1"><text>&gt;= 700</text></inputEntry><inputEntry id="r1i2"><text>&lt; 50000</text></inputEntry><outputEntry id="r1o1"><text>"low"</text></outputEntry></rule>
      <rule id="r2"><inputEntry id="r2i1"><text>[600..700)</text></inputEntry><inputEntry id="r2i2"><text>-</text></inputEntry><outputEntry id="r2o1"><text>"medium"</text></outputEntry></rule>
      <rule id="r3"><inputEntry id="r3i1"><text>&lt; 600</text></inputEntry><inputEntry id="r3i2"><text>-</text></inputEntry><outputEntry id="r3o1"><text>"high"</text></outputEntry></rule>
    </decisionTable>
  </decision>
</definitions>`

const DEMO_FORM = `{"components":[{"label":"Applicant name","type":"textfield","key":"applicantName","id":"Field_name","validate":{"required":true}},{"label":"Requested amount","type":"number","key":"amount","id":"Field_amount"},{"label":"Credit score","type":"number","key":"creditScore","id":"Field_score"},{"label":"Employment status","type":"select","key":"employment","id":"Field_emp","values":[{"label":"Employed","value":"employed"},{"label":"Self-employed","value":"self"},{"label":"Unemployed","value":"none"}]},{"label":"I confirm the information is accurate","type":"checkbox","key":"confirmed","id":"Field_confirm"}],"type":"default","id":"loanApplicationForm","executionPlatform":"Camunda Cloud","executionPlatformVersion":"8.5.0","schemaVersion":16}`

const DEMO_FILES: Array<{ filename: string; content: string }> = [
	{ filename: "loan-approval.bpmn", content: DEMO_BPMN },
	{ filename: "credit-risk.dmn", content: DEMO_DMN },
	{ filename: "loan-application.form", content: DEMO_FORM },
]

// Fixed "created" date so the demo share page shows a stable timestamp.
const DEMO_CREATED_AT = 1_752_019_200_000 // 2025-07-09

interface DemoData {
	drop: DropRow
	files: FileInfo[]
	bodies: Map<string, { kind: FileKind; original: string; json: string; hash: string }>
}

let cached: DemoData | null = null

async function build(): Promise<DemoData> {
	const files: FileInfo[] = []
	const bodies = new Map<string, { kind: FileKind; original: string; json: string; hash: string }>()
	let sizeTotal = 0
	DEMO_FILES.forEach((f, position) => {
		const v = validateFile(f.filename, f.content)
		files.push({
			id: `demo-${position}`,
			position,
			kind: v.kind,
			filename: v.filename,
			name: v.name,
			sizeOriginal: v.sizeOriginal,
			sizeJson: v.sizeJson,
			meta: v.meta,
		})
		sizeTotal += v.sizeOriginal
	})
	for (const f of DEMO_FILES) {
		const v = validateFile(f.filename, f.content)
		bodies.set(v.filename, {
			kind: v.kind,
			original: v.original,
			json: v.json,
			hash: await sha256Hex(v.original),
		})
	}
	const drop: DropRow = {
		id: DEMO_SHARE_ID,
		file_count: files.length,
		size_total: sizeTotal,
		tos_version: "demo",
		created_at: DEMO_CREATED_AT,
		last_viewed_at: DEMO_CREATED_AT,
		view_count: 0,
		expires_at: null,
	}
	return { drop, files, bodies }
}

/** The demo drop's metadata + file list, built once per isolate. */
export async function demoDrop(): Promise<{ drop: DropRow; files: FileInfo[] }> {
	if (!cached) cached = await build()
	return { drop: cached.drop, files: cached.files }
}

/** One representation of a demo file, or null if the filename is unknown. */
export async function demoFileBody(
	filename: string,
	rep: "original" | "json",
): Promise<{ kind: FileKind; body: string; hash: string } | null> {
	if (!cached) cached = await build()
	const b = cached.bodies.get(filename)
	if (!b) return null
	return { kind: b.kind, body: rep === "json" ? b.json : b.original, hash: b.hash }
}

import type {
	DashboardData,
	DecisionDefinitionResult,
	IncidentResult,
	JobSearchResult,
	MessageSubscriptionResult,
	ProcessDefinitionResult,
	ProcessInstanceResult,
	UserTaskResult,
	VariableResult,
} from "./types.js"

// ── BPMN XML for the demo canvas ─────────────────────────────────────────────

export const MOCK_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="order-process" name="Order Processing" isExecutable="true">
    <startEvent id="start" name="Order Received"/>
    <sequenceFlow id="sf1" sourceRef="start" targetRef="review"/>
    <userTask id="review" name="Review Order"/>
    <sequenceFlow id="sf2" sourceRef="review" targetRef="gw1"/>
    <exclusiveGateway id="gw1" name="Approved?"/>
    <sequenceFlow id="sf3" sourceRef="gw1" targetRef="payment" name="Yes"/>
    <sequenceFlow id="sf4" sourceRef="gw1" targetRef="notify" name="No"/>
    <serviceTask id="payment" name="Process Payment"/>
    <sequenceFlow id="sf5" sourceRef="payment" targetRef="ship"/>
    <serviceTask id="ship" name="Ship Order"/>
    <sequenceFlow id="sf6" sourceRef="ship" targetRef="end"/>
    <serviceTask id="notify" name="Notify Customer"/>
    <sequenceFlow id="sf7" sourceRef="notify" targetRef="end"/>
    <endEvent id="end" name="Done"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="order-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="152" y="152" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="review_di" bpmnElement="review"><dc:Bounds x="240" y="130" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw1_di" bpmnElement="gw1" isMarkerVisible="true"><dc:Bounds x="395" y="145" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="payment_di" bpmnElement="payment"><dc:Bounds x="500" y="130" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ship_di" bpmnElement="ship"><dc:Bounds x="660" y="130" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="notify_di" bpmnElement="notify"><dc:Bounds x="500" y="250" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="822" y="152" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="sf1_di" bpmnElement="sf1"><di:waypoint x="188" y="170"/><di:waypoint x="240" y="170"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sf2_di" bpmnElement="sf2"><di:waypoint x="340" y="170"/><di:waypoint x="395" y="170"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sf3_di" bpmnElement="sf3"><di:waypoint x="445" y="170"/><di:waypoint x="500" y="170"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sf4_di" bpmnElement="sf4"><di:waypoint x="420" y="195"/><di:waypoint x="420" y="290"/><di:waypoint x="500" y="290"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sf5_di" bpmnElement="sf5"><di:waypoint x="600" y="170"/><di:waypoint x="660" y="170"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sf6_di" bpmnElement="sf6"><di:waypoint x="760" y="170"/><di:waypoint x="822" y="170"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sf7_di" bpmnElement="sf7"><di:waypoint x="600" y="290"/><di:waypoint x="840" y="290"/><di:waypoint x="840" y="188"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
	return new Date(Date.now() - n * 86_400_000).toISOString()
}
function hoursAgo(n: number): string {
	return new Date(Date.now() - n * 3_600_000).toISOString()
}
function minutesAgo(n: number): string {
	return new Date(Date.now() - n * 60_000).toISOString()
}

// ── Mock data generators ──────────────────────────────────────────────────────

export function getMockDashboard(): DashboardData {
	return {
		activeInstances: 24,
		openIncidents: 3,
		activeJobs: 8,
		pendingTasks: 5,
		definitions: 4,
	}
}

export const MOCK_DEFINITIONS: ProcessDefinitionResult[] = [
	{
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		name: "Order Processing",
		version: 3,
		versionTag: "v3.1",
		tenantId: "<default>",
		resourceName: "order-process.bpmn",
		hasStartForm: false,
	},
	{
		processDefinitionKey: "pd-1b",
		processDefinitionId: "order-process",
		name: "Order Processing",
		version: 2,
		versionTag: "v2.0",
		tenantId: "<default>",
		resourceName: "order-process.bpmn",
		hasStartForm: false,
	},
	{
		processDefinitionKey: "pd-1c",
		processDefinitionId: "order-process",
		name: "Order Processing",
		version: 1,
		versionTag: null,
		tenantId: "<default>",
		resourceName: "order-process.bpmn",
		hasStartForm: false,
	},
	{
		processDefinitionKey: "pd-2",
		processDefinitionId: "customer-onboarding",
		name: "Customer Onboarding",
		version: 1,
		versionTag: null,
		tenantId: "<default>",
		resourceName: "customer-onboarding.bpmn",
		hasStartForm: true,
	},
	{
		processDefinitionKey: "pd-3",
		processDefinitionId: "invoice-approval",
		name: "Invoice Approval",
		version: 2,
		versionTag: "stable",
		tenantId: "<default>",
		resourceName: "invoice-approval.bpmn",
		hasStartForm: false,
	},
	{
		processDefinitionKey: "pd-4",
		processDefinitionId: "data-pipeline",
		name: "Data Pipeline",
		version: 1,
		versionTag: null,
		tenantId: "<default>",
		resourceName: "data-pipeline.bpmn",
		hasStartForm: false,
	},
]

export const MOCK_INSTANCES: ProcessInstanceResult[] = [
	{
		processInstanceKey: "pi-1",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processDefinitionName: "Order Processing",
		processDefinitionVersion: 3,
		processDefinitionVersionTag: "v3.1",
		state: "ACTIVE",
		hasIncident: false,
		startDate: hoursAgo(2),
		endDate: null,
		tenantId: "<default>",
		parentProcessInstanceKey: "",
		parentElementInstanceKey: "",
		rootProcessInstanceKey: "pi-1",
		tags: [],
		businessId: "ORD-10042",
	},
	{
		processInstanceKey: "pi-2",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processDefinitionName: "Order Processing",
		processDefinitionVersion: 3,
		processDefinitionVersionTag: "v3.1",
		state: "ACTIVE",
		hasIncident: true,
		startDate: hoursAgo(5),
		endDate: null,
		tenantId: "<default>",
		parentProcessInstanceKey: "",
		parentElementInstanceKey: "",
		rootProcessInstanceKey: "pi-2",
		tags: [],
		businessId: "ORD-10041",
	},
	{
		processInstanceKey: "pi-3",
		processDefinitionKey: "pd-2",
		processDefinitionId: "customer-onboarding",
		processDefinitionName: "Customer Onboarding",
		processDefinitionVersion: 1,
		processDefinitionVersionTag: null,
		state: "COMPLETED",
		hasIncident: false,
		startDate: daysAgo(2),
		endDate: daysAgo(1),
		tenantId: "<default>",
		parentProcessInstanceKey: "",
		parentElementInstanceKey: "",
		rootProcessInstanceKey: "pi-3",
		tags: [],
		businessId: "CUST-882",
	},
	{
		processInstanceKey: "pi-4",
		processDefinitionKey: "pd-3",
		processDefinitionId: "invoice-approval",
		processDefinitionName: "Invoice Approval",
		processDefinitionVersion: 2,
		processDefinitionVersionTag: "stable",
		state: "ACTIVE",
		hasIncident: false,
		startDate: hoursAgo(1),
		endDate: null,
		tenantId: "<default>",
		parentProcessInstanceKey: "",
		parentElementInstanceKey: "",
		rootProcessInstanceKey: "pi-4",
		tags: [],
		businessId: "INV-5503",
	},
	{
		processInstanceKey: "pi-5",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processDefinitionName: "Order Processing",
		processDefinitionVersion: 2,
		processDefinitionVersionTag: null,
		state: "TERMINATED",
		hasIncident: false,
		startDate: daysAgo(3),
		endDate: daysAgo(3),
		tenantId: "<default>",
		parentProcessInstanceKey: "",
		parentElementInstanceKey: "",
		rootProcessInstanceKey: "pi-5",
		tags: [],
		businessId: "ORD-10038",
	},
]

export const MOCK_INCIDENTS: IncidentResult[] = [
	{
		incidentKey: "inc-1",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processInstanceKey: "pi-2",
		rootProcessInstanceKey: "pi-2",
		elementInstanceKey: "ei-payment",
		jobKey: "job-3",
		elementId: "payment",
		errorType: "JOB_NO_RETRIES",
		errorMessage: "Payment gateway timeout after 3 retries",
		state: "ACTIVE",
		creationTime: hoursAgo(4),
		tenantId: "<default>",
	},
	{
		incidentKey: "inc-2",
		processDefinitionKey: "pd-3",
		processDefinitionId: "invoice-approval",
		processInstanceKey: "pi-4",
		rootProcessInstanceKey: "pi-4",
		elementInstanceKey: "ei-validate",
		jobKey: "job-5",
		elementId: "validate",
		errorType: "IO_MAPPING_ERROR",
		errorMessage: "Failed to map variable 'invoiceAmount': null value",
		state: "ACTIVE",
		creationTime: minutesAgo(45),
		tenantId: "<default>",
	},
	{
		incidentKey: "inc-3",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processInstanceKey: "pi-5",
		rootProcessInstanceKey: "pi-5",
		elementInstanceKey: "ei-ship",
		jobKey: "job-6",
		elementId: "ship",
		errorType: "CALLED_ELEMENT_ERROR",
		errorMessage: "Sub-process 'shipping-service' not deployed",
		state: "RESOLVED",
		creationTime: daysAgo(3),
		tenantId: "<default>",
	},
]

export const MOCK_JOBS: JobSearchResult[] = [
	{
		jobKey: "job-1",
		type: "io.camunda:http-json:1",
		state: "CREATED",
		retries: 3,
		elementId: "payment",
		elementInstanceKey: "ei-payment-2",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		worker: "payment-worker",
		deadline: hoursAgo(-1),
		customHeaders: {},
		hasFailedWithRetriesLeft: false,
		kind: "BPMN_ELEMENT",
		listenerEventType: "UNSPECIFIED",
		tenantId: "<default>",
	},
	{
		jobKey: "job-2",
		type: "ship-order",
		state: "FAILED",
		retries: 0,
		elementId: "ship",
		elementInstanceKey: "ei-ship-2",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		worker: "shipping-worker",
		deadline: null,
		errorMessage: "Shipping provider unreachable",
		customHeaders: {},
		hasFailedWithRetriesLeft: false,
		kind: "BPMN_ELEMENT",
		listenerEventType: "UNSPECIFIED",
		tenantId: "<default>",
	},
	{
		jobKey: "job-3",
		type: "io.camunda:http-json:1",
		state: "FAILED",
		retries: 0,
		elementId: "payment",
		elementInstanceKey: "ei-payment",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processInstanceKey: "pi-2",
		rootProcessInstanceKey: "pi-2",
		worker: "payment-worker",
		deadline: null,
		errorMessage: "Payment gateway timeout after 3 retries",
		customHeaders: {},
		hasFailedWithRetriesLeft: false,
		kind: "BPMN_ELEMENT",
		listenerEventType: "UNSPECIFIED",
		tenantId: "<default>",
	},
]

export const MOCK_TASKS: UserTaskResult[] = [
	{
		userTaskKey: "ut-1",
		name: "Review Order",
		state: "CREATED",
		assignee: null,
		elementId: "review",
		elementInstanceKey: "ei-review-1",
		processDefinitionKey: "pd-1",
		processDefinitionId: "order-process",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		processName: "Order Processing",
		candidateGroups: ["order-managers"],
		candidateUsers: [],
		dueDate: hoursAgo(-2),
		followUpDate: null,
		completionDate: null,
		externalFormReference: null,
		formKey: "",
		tags: [],
		customHeaders: {},
		priority: 50,
		creationDate: hoursAgo(2),
		tenantId: "<default>",
	},
	{
		userTaskKey: "ut-2",
		name: "Approve Invoice",
		state: "CREATED",
		assignee: "alice@example.com",
		elementId: "approve",
		elementInstanceKey: "ei-approve-1",
		processDefinitionKey: "pd-3",
		processDefinitionId: "invoice-approval",
		processInstanceKey: "pi-4",
		rootProcessInstanceKey: "pi-4",
		processName: "Invoice Approval",
		candidateGroups: ["finance"],
		candidateUsers: ["alice@example.com", "bob@example.com"],
		dueDate: hoursAgo(-24),
		followUpDate: null,
		completionDate: null,
		externalFormReference: null,
		formKey: "",
		tags: [],
		customHeaders: {},
		priority: 80,
		creationDate: hoursAgo(1),
		tenantId: "<default>",
	},
]

export const MOCK_VARIABLES: Array<VariableResult & { value: string }> = [
	{
		variableKey: "var-1",
		name: "orderId",
		value: '"ORD-10042"',
		scopeKey: "pi-1",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		tenantId: "<default>",
	},
	{
		variableKey: "var-2",
		name: "customerId",
		value: '"CUST-5512"',
		scopeKey: "pi-1",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		tenantId: "<default>",
	},
	{
		variableKey: "var-3",
		name: "amount",
		value: "149.99",
		scopeKey: "pi-1",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		tenantId: "<default>",
	},
	{
		variableKey: "var-4",
		name: "approved",
		value: "true",
		scopeKey: "pi-1",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		tenantId: "<default>",
	},
]

export const MOCK_DECISIONS: DecisionDefinitionResult[] = [
	{
		decisionDefinitionId: "approve-order",
		decisionDefinitionKey: "dd-1",
		decisionRequirementsId: "order-decisions",
		decisionRequirementsKey: "drg-1",
		decisionRequirementsName: "Order Decisions",
		decisionRequirementsVersion: 2,
		name: "Approve Order",
		version: 2,
		tenantId: "<default>",
	},
	{
		decisionDefinitionId: "approve-order",
		decisionDefinitionKey: "dd-1b",
		decisionRequirementsId: "order-decisions",
		decisionRequirementsKey: "drg-1b",
		decisionRequirementsName: "Order Decisions",
		decisionRequirementsVersion: 1,
		name: "Approve Order",
		version: 1,
		tenantId: "<default>",
	},
	{
		decisionDefinitionId: "discount-tier",
		decisionDefinitionKey: "dd-2",
		decisionRequirementsId: "order-decisions",
		decisionRequirementsKey: "drg-1",
		decisionRequirementsName: "Order Decisions",
		decisionRequirementsVersion: 2,
		name: "Discount Tier",
		version: 2,
		tenantId: "<default>",
	},
	{
		decisionDefinitionId: "credit-check",
		decisionDefinitionKey: "dd-3",
		decisionRequirementsId: "credit-decisions",
		decisionRequirementsKey: "drg-2",
		decisionRequirementsName: "Credit Decisions",
		decisionRequirementsVersion: 1,
		name: "Credit Check",
		version: 1,
		tenantId: "<default>",
	},
]

export const MOCK_MESSAGE_SUBSCRIPTIONS: MessageSubscriptionResult[] = [
	{
		messageSubscriptionKey: "ms-1",
		processDefinitionId: "order-process",
		processDefinitionKey: "pd-1",
		processInstanceKey: "pi-1",
		rootProcessInstanceKey: "pi-1",
		elementId: "msg-payment-confirmed",
		elementInstanceKey: "ei-msg-1",
		messageSubscriptionState: "CREATED",
		messageName: "PaymentConfirmed",
		correlationKey: "ORD-10042",
		tenantId: "<default>",
		lastUpdatedDate: minutesAgo(30),
	},
	{
		messageSubscriptionKey: "ms-2",
		processDefinitionId: "order-process",
		processDefinitionKey: "pd-1",
		processInstanceKey: "pi-2",
		rootProcessInstanceKey: "pi-2",
		elementId: "msg-payment-confirmed",
		elementInstanceKey: "ei-msg-2",
		messageSubscriptionState: "CREATED",
		messageName: "PaymentConfirmed",
		correlationKey: "ORD-10041",
		tenantId: "<default>",
		lastUpdatedDate: hoursAgo(5),
	},
	{
		messageSubscriptionKey: "ms-3",
		processDefinitionId: "invoice-approval",
		processDefinitionKey: "pd-3",
		processInstanceKey: "pi-4",
		rootProcessInstanceKey: "pi-4",
		elementId: "msg-approval-override",
		elementInstanceKey: "ei-msg-3",
		messageSubscriptionState: "CREATED",
		messageName: "ApprovalOverride",
		correlationKey: "INV-5503",
		tenantId: "<default>",
		lastUpdatedDate: minutesAgo(45),
	},
]

/** Active element IDs for mock instance pi-1 (at "payment" step) */
export const MOCK_ACTIVE_ELEMENTS = ["review"]
/** Visited sequence flow / element IDs for mock instance pi-1 */
export const MOCK_VISITED_ELEMENTS = ["start", "sf1"]

import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnFlowElement } from "@bpmnkit/core"
import {
	aiAgentToolLoop,
	aiEvaluatorOptimizer,
	aiHumanApprovalGate,
	aiOrchestratorWorkers,
	aiParallelization,
	aiPromptChaining,
	aiRouting,
} from "./ai-agents.js"
import { contractApproval, expenseApproval, purchaseRequestApproval } from "./approvals.js"
import { documentClassification, documentSignature, invoiceCapture } from "./documents.js"
import { contentReview, fourEyesReview } from "./human-in-the-loop.js"
import { incidentEscalation, securityAlertTriage } from "./incident.js"
import { customerKycOnboarding, employeeOnboarding } from "./onboarding.js"
import { orderToCash, paymentCollection } from "./order-to-cash.js"
import { paymentSaga, travelBookingSaga } from "./saga.js"
import { scheduledReport, supportTicketSla } from "./sla.js"
import type {
	ProcessTemplate,
	TemplateCategory,
	TemplateCategoryInfo,
	TemplateFile,
} from "./types.js"

export type {
	ProcessTemplate,
	TemplateCategory,
	TemplateCategoryInfo,
	TemplateFile,
	TemplateScenario,
	TemplateScenarioMock,
} from "./types.js"
export { AI_AGENT_TASK_TYPE, TEMPLATE_API_KEY, TEMPLATE_MODEL, aiTask } from "./ai-task.js"

/** Gallery categories, in display order. */
export const TEMPLATE_CATEGORIES: readonly TemplateCategoryInfo[] = [
	{
		id: "order-to-cash",
		label: "Order to cash",
		description: "From order to shipped goods and money in the bank.",
	},
	{
		id: "approvals",
		label: "Approvals",
		description: "Routing requests to the people who sign them off.",
	},
	{
		id: "onboarding",
		label: "Onboarding",
		description: "Bringing employees and customers on board.",
	},
	{ id: "incident", label: "Incident & escalation", description: "Alerts, paging and escalation." },
	{
		id: "documents",
		label: "Document processing",
		description: "Capture, classify and sign documents.",
	},
	{
		id: "sla",
		label: "SLA & timers",
		description: "Deadlines, schedules and time-driven escalation.",
	},
	{
		id: "saga",
		label: "Sagas & error handling",
		description: "Multi-step work that undoes itself on failure.",
	},
	{
		id: "human-in-the-loop",
		label: "Human in the loop",
		description: "Reviews, four-eyes checks and forms.",
	},
	{
		id: "ai-agents",
		label: "AI agent patterns",
		description: "Anthropic's agent patterns — chaining, routing, tools — as BPMN.",
	},
]

/** Every template in the gallery, grouped by category. */
export const ALL_TEMPLATES: readonly ProcessTemplate[] = [
	orderToCash,
	paymentCollection,
	purchaseRequestApproval,
	expenseApproval,
	contractApproval,
	employeeOnboarding,
	customerKycOnboarding,
	incidentEscalation,
	securityAlertTriage,
	invoiceCapture,
	documentSignature,
	documentClassification,
	supportTicketSla,
	scheduledReport,
	travelBookingSaga,
	paymentSaga,
	fourEyesReview,
	contentReview,
	aiPromptChaining,
	aiRouting,
	aiParallelization,
	aiOrchestratorWorkers,
	aiEvaluatorOptimizer,
	aiHumanApprovalGate,
	aiAgentToolLoop,
]

/** Look a template up by id. */
export function getTemplate(id: string): ProcessTemplate | undefined {
	return ALL_TEMPLATES.find((t) => t.id === id)
}

/** Templates filed under one category, in gallery order. */
export function templatesInCategory(category: TemplateCategory): ProcessTemplate[] {
	return ALL_TEMPLATES.filter((t) => t.category === category)
}

/**
 * The files a template consists of: `<id>.bpmn`, the `<id>.bpmn.tests.json`
 * scenarios `casen test` runs, and one `.dmn` / `.form` per decision and form.
 */
export function templateFiles(template: ProcessTemplate): TemplateFile[] {
	const files: TemplateFile[] = [
		{ path: `${template.id}.bpmn`, content: Bpmn.export(template.build()) },
		{
			path: `${template.id}.bpmn.tests.json`,
			content: `${JSON.stringify(template.scenarios, null, 2)}\n`,
		},
	]
	for (const dmn of template.decisions?.() ?? []) {
		const id = dmn.decisions[0]?.id ?? template.id
		files.push({ path: `${id}.dmn`, content: Dmn.export(dmn) })
	}
	for (const form of template.forms?.() ?? []) {
		files.push({ path: `${form.id ?? template.id}.form`, content: Form.export(form) })
	}
	return files
}

/** A Zeebe job type and the tasks that use it. */
export interface TemplateJobType {
	type: string
	/** Names (or ids) of the elements with this job type. */
	elements: string[]
}

/** Every job type a model's workers must serve, sorted by type. */
export function listJobTypes(defs: BpmnDefinitions): TemplateJobType[] {
	const byType = new Map<string, string[]>()
	const visit = (elements: BpmnFlowElement[]): void => {
		for (const el of elements) {
			const def = el.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
			const type = def?.attributes.type
			if (type !== undefined) {
				const names = byType.get(type) ?? []
				names.push(el.name ?? el.id)
				byType.set(type, names)
			}
			if ("flowElements" in el) visit(el.flowElements)
		}
	}
	for (const process of defs.processes) visit(process.flowElements)
	return [...byType]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([type, elements]) => ({ type, elements }))
}

import { Bpmn, Dmn } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const supportTicketSla: ProcessTemplate = {
	id: "support-ticket-sla",
	title: "Support Ticket SLA",
	description:
		"Handles a support ticket against a response-time SLA. A DMN table sets the priority and the queue from the customer's plan and the reported impact, a knowledge-base search answers what it can, and a first-line agent takes the rest. If the ticket is still open after four hours an interrupting timer moves it to second line.",
	category: "sla",
	tags: ["dmn", "timer boundary", "sla", "customer support"],
	build: () =>
		Bpmn.createProcess("support-ticket-sla")
			.name("Support Ticket SLA")
			.versionTag("1.0.0")
			.startEvent("ticket-created", { name: "Ticket created" })
			.businessRuleTask("prioritise", {
				name: "Set priority and queue",
				decisionId: "ticket-priority",
				resultVariable: "routing",
			})
			.serviceTask("search-kb", {
				name: "Search knowledge base",
				taskType: "kb-search",
				ioMapping: {
					outputs: [
						{ source: "=match", target: "kbMatch" },
						{ source: "=articleUrl", target: "kbArticle" },
					],
				},
			})
			.exclusiveGateway("known-fix", { name: "Known fix?" })
			.branch("self-service", (b) =>
				b
					.condition('=kbMatch and routing.priority != "P1"')
					.serviceTask("send-article", {
						name: "Send self-service answer",
						taskType: "email-send",
						taskHeaders: { template: "kb-answer" },
					})
					.endEvent("resolved-self-service", { name: "Resolved by self-service" }),
			)
			.branch("agent", (b) =>
				b
					.defaultFlow()
					.userTask("resolve-l1", {
						name: "Resolve ticket",
						zeebeUserTask: true,
						candidateGroups: "=routing.queue",
					})
					.connectTo("close-merge"),
			)
			.boundaryEvent("sla-breached", {
				attachedTo: "resolve-l1",
				name: "SLA breached (4h)",
				timerDuration: "PT4H",
			})
			.userTask("resolve-l2", {
				name: "Resolve at second line",
				zeebeUserTask: true,
				candidateGroups: "support-l2",
				priority: 90,
			})
			.connectTo("close-merge")
			.exclusiveGateway("close-merge")
			.serviceTask("close-ticket", {
				name: "Close ticket",
				taskType: "helpdesk-ticket-close",
			})
			.endEvent("ticket-closed", { name: "Ticket closed" })
			.withAutoLayout()
			.build(),
	decisions: () => [
		Dmn.createDecisionTable("ticket-priority")
			.name("Ticket priority")
			.hitPolicy("FIRST")
			.input({ label: "Plan", expression: "plan", typeRef: "string" })
			.input({ label: "Impact", expression: "impact", typeRef: "string" })
			.output({ label: "Priority", name: "priority", typeRef: "string" })
			.output({ label: "Queue", name: "queue", typeRef: "string" })
			.rule({
				description: "Enterprise outage",
				inputs: ['"enterprise"', '"outage"'],
				outputs: ['"P1"', '"support-vip"'],
			})
			.rule({
				description: "Any outage",
				inputs: ["-", '"outage"'],
				outputs: ['"P2"', '"support-l1"'],
			})
			.rule({
				description: "Enterprise question",
				inputs: ['"enterprise"', "-"],
				outputs: ['"P3"', '"support-vip"'],
			})
			.rule({
				description: "Everything else",
				inputs: ["-", "-"],
				outputs: ['"P4"', '"support-l1"'],
			})
			.build(),
	],
	scenarios: [
		{
			id: "agent-resolves",
			name: "An enterprise outage goes to the VIP queue and is resolved",
			inputs: { ticketId: "T-1", plan: "enterprise", impact: "outage" },
			mocks: {
				"kb-search": { outputs: { match: true, articleUrl: "https://kb.example.com/restart" } },
				userTask: {},
				"helpdesk-ticket-close": {},
			},
			expect: {
				path: ["prioritise", "known-fix", "resolve-l1", "close-ticket", "ticket-closed"],
				variables: { routing: { priority: "P1", queue: "support-vip" } },
			},
		},
		{
			id: "self-service",
			name: "A how-to question is answered from the knowledge base",
			inputs: { ticketId: "T-2", plan: "starter", impact: "question" },
			mocks: {
				"kb-search": { outputs: { match: true, articleUrl: "https://kb.example.com/export" } },
				"email-send": {},
			},
			expect: {
				path: ["search-kb", "send-article", "resolved-self-service"],
				variables: { kbArticle: "https://kb.example.com/export" },
			},
		},
	],
}

export const scheduledReport: ProcessTemplate = {
	id: "scheduled-report",
	title: "Scheduled KPI Report",
	description:
		"A timer start event runs this process every day. It queries the warehouse, renders the KPI report and mails it to the distribution list; when the query comes back empty — usually a late upstream load — it alerts the data team instead of sending an empty report.",
	category: "sla",
	tags: ["timer start", "reporting", "batch", "data"],
	build: () =>
		Bpmn.createProcess("scheduled-report")
			.name("Scheduled KPI Report")
			.versionTag("1.0.0")
			.startEvent("every-day", { name: "Every day", timerCycle: "R/P1D" })
			.serviceTask("query-kpis", {
				name: "Query KPIs",
				taskType: "warehouse-query",
				taskHeaders: { query: "daily_kpis" },
				ioMapping: { outputs: [{ source: "=rows", target: "kpiRows" }] },
			})
			.exclusiveGateway("has-data", { name: "Any rows?" })
			.branch("report", (b) =>
				b
					.condition("=count(kpiRows) > 0")
					.serviceTask("render-report", {
						name: "Render report",
						taskType: "report-render",
						ioMapping: { outputs: [{ source: "=url", target: "reportUrl" }] },
					})
					.serviceTask("distribute-report", {
						name: "Mail to distribution list",
						taskType: "email-send",
						taskHeaders: { template: "daily-kpis" },
					})
					.endEvent("report-sent", { name: "Report sent" }),
			)
			.branch("empty", (b) =>
				b
					.defaultFlow()
					.serviceTask("alert-data-team", {
						name: "Alert data team",
						taskType: "chat-post",
						taskHeaders: { channel: "#data-alerts" },
					})
					.endEvent("no-data", { name: "No data" }),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "report-sent",
			name: "Yesterday's KPIs are rendered and mailed",
			mocks: {
				"warehouse-query": { outputs: { rows: [{ kpi: "orders", value: 1284 }] } },
				"report-render": { outputs: { url: "https://reports.example.com/daily.pdf" } },
				"email-send": {},
			},
			expect: {
				path: ["query-kpis", "render-report", "distribute-report", "report-sent"],
				variables: { reportUrl: "https://reports.example.com/daily.pdf" },
			},
		},
		{
			id: "no-data",
			name: "An empty query alerts the data team",
			mocks: { "warehouse-query": { outputs: { rows: [] } }, "chat-post": {} },
			expect: { path: ["query-kpis", "alert-data-team", "no-data"] },
		},
	],
}

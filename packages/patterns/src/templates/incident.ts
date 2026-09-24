import { Bpmn, Dmn } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const incidentEscalation: ProcessTemplate = {
	id: "incident-escalation",
	title: "Incident Escalation",
	description:
		"Turns a monitoring alert into a managed incident. A DMN table classifies severity from customer impact and error rate; minor alerts become backlog tickets, everything else pages the on-call engineer. If nobody acknowledges within 15 minutes an interrupting timer escalates to the incident commander, and a Sev 1 ends with a post-mortem.",
	category: "incident",
	tags: ["dmn", "timer boundary", "escalation", "on-call", "sre"],
	build: () =>
		Bpmn.createProcess("incident-escalation")
			.name("Incident Escalation")
			.versionTag("1.0.0")
			.startEvent("alert-fired", { name: "Alert fired" })
			.businessRuleTask("classify-severity", {
				name: "Classify severity",
				decisionId: "incident-severity",
				resultVariable: "severity",
			})
			.exclusiveGateway("minor", { name: "Sev 3?" })
			.branch("ticket", (b) =>
				b
					.condition('=severity = "sev3"')
					.serviceTask("create-ticket", {
						name: "Create backlog ticket",
						taskType: "ticket-create",
						ioMapping: { outputs: [{ source: "=ticketId", target: "ticketId" }] },
					})
					.endEvent("ticket-created", { name: "Ticket created" }),
			)
			.branch("page", (b) =>
				b
					.defaultFlow()
					.serviceTask("page-on-call", {
						name: "Page on-call engineer",
						taskType: "pager-page",
						taskHeaders: { escalationPolicy: "primary" },
					})
					.userTask("acknowledge", {
						name: "Acknowledge incident",
						zeebeUserTask: true,
						candidateGroups: "on-call",
						priority: 90,
					})
					.connectTo("ack-merge"),
			)
			.boundaryEvent("ack-overdue", {
				attachedTo: "acknowledge",
				name: "15 min unacknowledged",
				timerDuration: "PT15M",
			})
			.serviceTask("page-commander", {
				name: "Page incident commander",
				taskType: "pager-page",
				taskHeaders: { escalationPolicy: "incident-commander" },
			})
			.connectTo("ack-merge")
			.exclusiveGateway("ack-merge")
			.userTask("mitigate", {
				name: "Mitigate and resolve",
				zeebeUserTask: true,
				candidateGroups: "on-call",
			})
			.serviceTask("update-status-page", {
				name: "Publish status update",
				taskType: "statuspage-update",
				taskHeaders: { status: "resolved" },
			})
			.exclusiveGateway("needs-postmortem", { name: "Sev 1?" })
			.branch("postmortem", (b) =>
				b
					.condition('=severity = "sev1"')
					.userTask("write-postmortem", {
						name: "Write post-mortem",
						zeebeUserTask: true,
						candidateGroups: "sre",
						dueDate: '=now() + duration("P5D")',
					})
					.endEvent("postmortem-done", { name: "Post-mortem published" }),
			)
			.branch("done", (b) => b.defaultFlow().endEvent("resolved", { name: "Incident resolved" }))
			.withAutoLayout()
			.build(),
	decisions: () => [
		Dmn.createDecisionTable("incident-severity")
			.name("Incident severity")
			.hitPolicy("FIRST")
			.input({ label: "Customers affected", expression: "affectedCustomers", typeRef: "number" })
			.input({ label: "Error rate", expression: "errorRate", typeRef: "number" })
			.output({ label: "Severity", name: "severity", typeRef: "string" })
			.rule({
				description: "Broad customer outage",
				inputs: [">= 100", ">= 0.05"],
				outputs: ['"sev1"'],
			})
			.rule({
				description: "Customer-facing degradation",
				inputs: ["> 0", "-"],
				outputs: ['"sev2"'],
			})
			.rule({ description: "Internal but severe", inputs: ["-", ">= 0.2"], outputs: ['"sev2"'] })
			.rule({ description: "Everything else", inputs: ["-", "-"], outputs: ['"sev3"'] })
			.build(),
	],
	scenarios: [
		{
			id: "sev1",
			name: "A customer outage is paged, resolved and gets a post-mortem",
			inputs: { service: "checkout", affectedCustomers: 5000, errorRate: 0.3 },
			mocks: { "pager-page": {}, "statuspage-update": {}, userTask: {} },
			expect: {
				path: ["classify-severity", "page-on-call", "acknowledge", "mitigate", "write-postmortem"],
				variables: { severity: "sev1" },
			},
		},
		{
			id: "sev2",
			name: "A degradation is resolved without a post-mortem",
			inputs: { service: "search", affectedCustomers: 40, errorRate: 0.01 },
			mocks: { "pager-page": {}, "statuspage-update": {}, userTask: {} },
			expect: { path: ["acknowledge", "mitigate", "needs-postmortem", "resolved"] },
		},
		{
			id: "sev3",
			name: "A minor internal alert becomes a ticket",
			inputs: { service: "batch-export", affectedCustomers: 0, errorRate: 0.02 },
			mocks: { "ticket-create": { outputs: { ticketId: "OPS-42" } } },
			expect: {
				path: ["classify-severity", "create-ticket", "ticket-created"],
				variables: { severity: "sev3", ticketId: "OPS-42" },
			},
		},
	],
}

export const securityAlertTriage: ProcessTemplate = {
	id: "security-alert-triage",
	title: "Security Alert Triage",
	description:
		"Triages alerts from a SIEM. Each alert is enriched with threat intelligence and scored with a FEEL script; low scores are closed as false positives. Real threats are contained in a sub-process that isolates the host and resets credentials — if isolation fails it throws CONTAINMENT_FAILED and a tier-2 analyst contains it by hand — and every contained alert opens a case.",
	category: "incident",
	tags: ["error boundary", "sub-process", "security", "soc"],
	build: () =>
		Bpmn.createProcess("security-alert-triage")
			.name("Security Alert Triage")
			.versionTag("1.0.0")
			.startEvent("alert-received", { name: "Security alert received" })
			.serviceTask("enrich-alert", {
				name: "Enrich with threat intel",
				taskType: "threat-intel-enrich",
				ioMapping: {
					outputs: [
						{ source: "=reputation", target: "reputationScore" },
						{ source: "=criticality", target: "assetCriticality" },
					],
				},
			})
			.scriptTask("score-alert", {
				name: "Score alert",
				expression: "=reputationScore * assetCriticality",
				resultVariable: "riskScore",
			})
			.exclusiveGateway("real-threat", { name: "Risk score ≥ 20?" })
			.branch("false-positive", (b) =>
				b
					.condition("=riskScore < 20")
					.serviceTask("close-alert", {
						name: "Close as false positive",
						taskType: "siem-alert-close",
					})
					.endEvent("alert-closed", { name: "Closed as false positive" }),
			)
			.branch("threat", (b) => b.defaultFlow().connectTo("contain"))
			.subProcess(
				"contain",
				(s) =>
					s
						.startEvent("contain-start")
						.serviceTask("isolate-host", {
							name: "Isolate host",
							taskType: "edr-host-isolate",
							ioMapping: { outputs: [{ source: "=isolated", target: "hostIsolated" }] },
						})
						.exclusiveGateway("isolation-ok", { name: "Isolated?" })
						.branch("yes", (y) =>
							y
								.condition("=hostIsolated")
								.serviceTask("reset-credentials", {
									name: "Reset credentials",
									taskType: "iam-credentials-reset",
								})
								.endEvent("contained"),
						)
						.branch("no", (n) =>
							n.defaultFlow().endEvent("containment-failed", { errorCode: "CONTAINMENT_FAILED" }),
						),
				{ name: "Contain threat" },
			)
			.withBoundary(
				"on-containment-failed",
				{ name: "Containment failed", errorCode: "CONTAINMENT_FAILED" },
				(b) =>
					b
						.userTask("manual-containment", {
							name: "Contain manually",
							zeebeUserTask: true,
							candidateGroups: "soc-tier2",
							priority: 95,
						})
						.connectTo("case-merge"),
			)
			.exclusiveGateway("case-merge")
			.serviceTask("open-case", {
				name: "Open incident case",
				taskType: "case-create",
				ioMapping: { outputs: [{ source: "=caseId", target: "caseId" }] },
			})
			.endEvent("case-opened", { name: "Case opened" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "contained",
			name: "A malicious login is contained automatically",
			inputs: { alertId: "A-1", hostId: "wks-17" },
			mocks: {
				"threat-intel-enrich": { outputs: { reputation: 9, criticality: 4 } },
				"edr-host-isolate": { outputs: { isolated: true } },
				"iam-credentials-reset": {},
				"case-create": { outputs: { caseId: "CASE-5" } },
			},
			expect: {
				path: ["score-alert", "isolate-host", "reset-credentials", "open-case", "case-opened"],
				variables: { riskScore: 36, caseId: "CASE-5" },
			},
		},
		{
			id: "false-positive",
			name: "A low-scoring alert is closed",
			inputs: { alertId: "A-2", hostId: "wks-3" },
			mocks: {
				"threat-intel-enrich": { outputs: { reputation: 2, criticality: 3 } },
				"siem-alert-close": {},
			},
			expect: { path: ["score-alert", "close-alert", "alert-closed"], variables: { riskScore: 6 } },
		},
		{
			id: "isolation-failed",
			name: "Isolation fails and an analyst contains the host by hand",
			inputs: { alertId: "A-3", hostId: "srv-db-1" },
			mocks: {
				"threat-intel-enrich": { outputs: { reputation: 8, criticality: 5 } },
				"edr-host-isolate": { outputs: { isolated: false } },
				userTask: {},
				"case-create": { outputs: { caseId: "CASE-6" } },
			},
			expect: {
				path: [
					"isolate-host",
					"containment-failed",
					"on-containment-failed",
					"manual-containment",
					"open-case",
				],
			},
		},
	],
}

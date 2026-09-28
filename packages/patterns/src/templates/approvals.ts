import { Bpmn, Dmn } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const purchaseRequestApproval: ProcessTemplate = {
	id: "purchase-request-approval",
	title: "Purchase Request Approval",
	description:
		"Routes a purchase request through a delegation-of-authority matrix kept in DMN, so finance can change who approves what without touching the process. Small requests are approved automatically; the rest go to the approver group the table names, and an approved request becomes a purchase order in the ERP.",
	category: "approvals",
	tags: ["dmn", "user task", "candidate groups", "procurement"],
	build: () =>
		Bpmn.createProcess("purchase-request-approval")
			.name("Purchase Request Approval")
			.versionTag("1.0.0")
			.startEvent("request-submitted", { name: "Purchase request submitted" })
			.businessRuleTask("route-request", {
				name: "Determine approver",
				decisionId: "approval-matrix",
				resultVariable: "routing",
			})
			.exclusiveGateway("auto-approve", { name: "Auto-approve?" })
			.branch("auto", (b) => b.condition("=routing.autoApprove").connectTo("po-merge"))
			.branch("review", (b) =>
				b
					.defaultFlow()
					.userTask("approve-request", {
						name: "Approve purchase request",
						zeebeUserTask: true,
						candidateGroups: "=routing.approverGroup",
						dueDate: '=now() + duration("P3D")',
					})
					.exclusiveGateway("approved", { name: "Approved?" })
					.branch("yes", (y) => y.condition("=approved").connectTo("po-merge"))
					.branch("no", (n) =>
						n
							.defaultFlow()
							.serviceTask("notify-rejected", {
								name: "Notify requester: rejected",
								taskType: "requester-notify",
								taskHeaders: { template: "purchase-rejected" },
							})
							.endEvent("request-rejected", { name: "Request rejected" }),
					),
			)
			.exclusiveGateway("po-merge")
			.serviceTask("create-po", {
				name: "Create purchase order",
				taskType: "erp-purchase-order-create",
				ioMapping: { outputs: [{ source: "=poNumber", target: "poNumber" }] },
			})
			.serviceTask("notify-approved", {
				name: "Notify requester: approved",
				taskType: "requester-notify",
				taskHeaders: { template: "purchase-approved" },
			})
			.endEvent("po-created", { name: "Purchase order created" })
			.withAutoLayout()
			.build(),
	decisions: () => [
		Dmn.createDecisionTable("approval-matrix")
			.name("Approval matrix")
			.hitPolicy("FIRST")
			.input({ label: "Amount", expression: "amount", typeRef: "number" })
			.input({ label: "Category", expression: "category", typeRef: "string" })
			.output({ label: "Auto-approve", name: "autoApprove", typeRef: "boolean" })
			.output({ label: "Approver group", name: "approverGroup", typeRef: "string" })
			.rule({ description: "Petty spend", inputs: ["< 500", "-"], outputs: ["true", '"none"'] })
			.rule({
				description: "IT spend",
				inputs: ["< 10000", '"it"'],
				outputs: ["false", '"it-managers"'],
			})
			.rule({
				description: "Department spend",
				inputs: ["< 10000", "-"],
				outputs: ["false", '"department-heads"'],
			})
			.rule({ description: "Large spend", inputs: ["-", "-"], outputs: ["false", '"cfo-office"'] })
			.build(),
	],
	scenarios: [
		{
			id: "auto-approved",
			name: "A request under 500 is approved without review",
			inputs: { amount: 120, category: "office" },
			mocks: {
				"erp-purchase-order-create": { outputs: { poNumber: "PO-1" } },
				"requester-notify": {},
			},
			expect: {
				path: ["route-request", "auto-approve", "create-po", "po-created"],
				variables: { routing: { autoApprove: true, approverGroup: "none" }, poNumber: "PO-1" },
			},
		},
		{
			id: "approved-by-it",
			name: "An IT purchase is routed to IT managers and approved",
			inputs: { amount: 8000, category: "it" },
			mocks: {
				userTask: { outputs: { approved: true } },
				"erp-purchase-order-create": { outputs: { poNumber: "PO-2" } },
				"requester-notify": {},
			},
			expect: {
				path: ["route-request", "approve-request", "create-po", "po-created"],
				variables: { routing: { autoApprove: false, approverGroup: "it-managers" } },
			},
		},
		{
			id: "rejected",
			name: "A large request the CFO office rejects",
			inputs: { amount: 50000, category: "facilities" },
			mocks: { userTask: { outputs: { approved: false } }, "requester-notify": {} },
			expect: { path: ["approve-request", "notify-rejected", "request-rejected"] },
		},
	],
}

export const expenseApproval: ProcessTemplate = {
	id: "expense-approval",
	title: "Expense Report Approval",
	description:
		"Totals an expense report with a FEEL script, reimburses small reports straight away and sends the rest to the employee's manager. If the manager has not acted within two days an interrupting timer takes the review away and hands it to finance, so no report waits forever. Approved reports are paid; rejected ones go back to the employee.",
	category: "approvals",
	tags: ["script task", "timer boundary", "escalation", "feel", "finance"],
	build: () =>
		Bpmn.createProcess("expense-approval")
			.name("Expense Report Approval")
			.versionTag("1.0.0")
			.startEvent("report-submitted", { name: "Expense report submitted" })
			.scriptTask("total-expenses", {
				name: "Total the report",
				expression: "=sum(for line in expenses return line.amount)",
				resultVariable: "total",
			})
			.exclusiveGateway("needs-review", { name: "Over 100?" })
			.branch("small", (b) => b.condition("=total <= 100").connectTo("pay-merge"))
			.branch("review", (b) =>
				b
					.defaultFlow()
					.userTask("manager-review", {
						name: "Manager review",
						zeebeUserTask: true,
						assignee: "=managerId",
					})
					.connectTo("review-merge"),
			)
			.boundaryEvent("review-overdue", {
				attachedTo: "manager-review",
				name: "2 days without action",
				timerDuration: "P2D",
			})
			.userTask("finance-review", {
				name: "Finance review",
				zeebeUserTask: true,
				candidateGroups: "finance",
			})
			.connectTo("review-merge")
			.exclusiveGateway("review-merge")
			.exclusiveGateway("decision", { name: "Approved?" })
			.branch("approved", (b) => b.condition("=approved").connectTo("pay-merge"))
			.branch("rejected", (b) =>
				b
					.defaultFlow()
					.serviceTask("return-report", {
						name: "Return report to employee",
						taskType: "employee-notify",
						taskHeaders: { template: "expense-rejected" },
					})
					.endEvent("report-rejected", { name: "Report rejected" }),
			)
			.exclusiveGateway("pay-merge")
			.serviceTask("reimburse", {
				name: "Reimburse employee",
				taskType: "payment-reimburse",
				ioMapping: {
					inputs: [{ source: "=total", target: "payoutAmount" }],
					outputs: [{ source: "=paymentId", target: "paymentId" }],
				},
			})
			.endEvent("reimbursed", { name: "Reimbursed" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "small-report",
			name: "A 45.50 report is reimbursed without review",
			inputs: { managerId: "m.lee", expenses: [{ amount: 30 }, { amount: 15.5 }] },
			mocks: { "payment-reimburse": { outputs: { paymentId: "PAY-1" } } },
			expect: {
				path: ["total-expenses", "needs-review", "reimburse", "reimbursed"],
				variables: { total: 45.5, paymentId: "PAY-1" },
			},
		},
		{
			id: "manager-approves",
			name: "A 640 report is approved by the manager",
			inputs: { managerId: "m.lee", expenses: [{ amount: 520 }, { amount: 120 }] },
			mocks: {
				userTask: { outputs: { approved: true } },
				"payment-reimburse": { outputs: { paymentId: "PAY-2" } },
			},
			expect: { path: ["manager-review", "decision", "reimburse", "reimbursed"] },
		},
		{
			id: "manager-rejects",
			name: "A rejected report goes back to the employee",
			inputs: { managerId: "m.lee", expenses: [{ amount: 900 }] },
			mocks: { userTask: { outputs: { approved: false } }, "employee-notify": {} },
			expect: { path: ["manager-review", "return-report", "report-rejected"] },
		},
	],
}

export const contractApproval: ProcessTemplate = {
	id: "contract-approval",
	title: "Contract Approval (Parallel Review)",
	description:
		"Drafts a contract from a template, then asks legal and finance to review it at the same time instead of one after the other. A parallel join waits for both verdicts; only a contract both approve is sent for e-signature, and anything else goes back to the requester with the reviewers' comments.",
	category: "approvals",
	tags: ["parallel gateway", "user task", "four eyes", "legal"],
	build: () =>
		Bpmn.createProcess("contract-approval")
			.name("Contract Approval")
			.versionTag("1.0.0")
			.startEvent("contract-requested", { name: "Contract requested" })
			.serviceTask("draft-contract", {
				name: "Draft contract",
				taskType: "contract-draft",
				ioMapping: { outputs: [{ source: "=documentId", target: "documentId" }] },
			})
			.parallelGateway("reviews")
			.branch("legal", (b) =>
				b.userTask("legal-review", {
					name: "Legal review",
					zeebeUserTask: true,
					candidateGroups: "legal",
				}),
			)
			.branch("finance", (b) =>
				b.userTask("finance-review", {
					name: "Finance review",
					zeebeUserTask: true,
					candidateGroups: "finance",
				}),
			)
			.parallelGateway("reviews-done")
			.exclusiveGateway("both-approved", { name: "Both approved?" })
			.branch("yes", (b) =>
				b
					.condition("=legalApproved and financeApproved")
					.serviceTask("send-for-signature", {
						name: "Send for e-signature",
						taskType: "esign-envelope-send",
						ioMapping: { outputs: [{ source: "=envelopeId", target: "envelopeId" }] },
					})
					.endEvent("contract-sent", { name: "Sent for signature" }),
			)
			.branch("no", (b) =>
				b
					.defaultFlow()
					.serviceTask("return-to-requester", {
						name: "Return to requester",
						taskType: "requester-notify",
						taskHeaders: { template: "contract-changes-requested" },
					})
					.endEvent("contract-returned", { name: "Changes requested" }),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "both-approve",
			name: "Legal and finance both approve",
			inputs: { counterparty: "Acme GmbH", value: 120000 },
			mocks: {
				"contract-draft": { outputs: { documentId: "DOC-7" } },
				userTask: { outputs: { legalApproved: true, financeApproved: true } },
				"esign-envelope-send": { outputs: { envelopeId: "ENV-3" } },
			},
			expect: {
				path: ["draft-contract", "reviews-done", "send-for-signature", "contract-sent"],
				variables: { envelopeId: "ENV-3" },
			},
		},
		{
			id: "finance-objects",
			name: "Finance objects, so the contract goes back",
			inputs: { counterparty: "Acme GmbH", value: 120000 },
			mocks: {
				"contract-draft": { outputs: { documentId: "DOC-8" } },
				userTask: { outputs: { legalApproved: true, financeApproved: false } },
				"requester-notify": {},
			},
			expect: { path: ["reviews-done", "return-to-requester", "contract-returned"] },
		},
	],
}

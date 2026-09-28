import { Bpmn, Dmn } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const employeeOnboarding: ProcessTemplate = {
	id: "employee-onboarding",
	title: "Employee Onboarding",
	description:
		"Starts when a contract is signed: the HR record is created, then accounts, equipment and payroll are set up in parallel so the new hire has everything on day one. An inclusive gateway adds role-specific steps — developer tooling for engineers, the leadership programme for managers — and everyone else gets the standard welcome pack.",
	category: "onboarding",
	tags: ["parallel gateway", "inclusive gateway", "hr", "provisioning"],
	build: () =>
		Bpmn.createProcess("employee-onboarding")
			.name("Employee Onboarding")
			.versionTag("1.0.0")
			.startEvent("contract-signed", { name: "Contract signed" })
			.serviceTask("create-hr-record", {
				name: "Create HR record",
				taskType: "hris-employee-create",
				ioMapping: { outputs: [{ source: "=employeeId", target: "employeeId" }] },
			})
			.parallelGateway("provision")
			.branch("accounts", (b) =>
				b.serviceTask("provision-accounts", {
					name: "Provision accounts",
					taskType: "identity-provision",
					ioMapping: { outputs: [{ source: "=email", target: "workEmail" }] },
				}),
			)
			.branch("equipment", (b) =>
				b.serviceTask("order-equipment", { name: "Order equipment", taskType: "equipment-order" }),
			)
			.branch("payroll", (b) =>
				b.serviceTask("enrol-payroll", { name: "Enrol in payroll", taskType: "payroll-enrol" }),
			)
			.parallelGateway("provisioned")
			.serviceTask("send-welcome", {
				name: "Send welcome email",
				taskType: "email-send",
				taskHeaders: { template: "welcome" },
			})
			// Each role branch ends on its own: the instance completes once every branch
			// that was taken has finished, with no join to wait on.
			.inclusiveGateway("role-extras", { name: "Role-specific steps" })
			.branch("engineering", (b) =>
				b
					.condition('=department = "engineering"')
					.serviceTask("grant-dev-tools", {
						name: "Grant developer tooling",
						taskType: "devtools-grant",
					})
					.endEvent("dev-ready", { name: "Developer set up" }),
			)
			.branch("manager", (b) =>
				b
					.condition("=isManager")
					.serviceTask("enrol-leadership", {
						name: "Enrol in leadership programme",
						taskType: "training-enrol",
					})
					.endEvent("manager-ready", { name: "Manager enrolled" }),
			)
			.branch("standard", (b) =>
				b
					.defaultFlow()
					.serviceTask("send-welcome-pack", {
						name: "Send welcome pack",
						taskType: "welcome-pack-send",
					})
					.endEvent("onboarded", { name: "Onboarded" }),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "engineer",
			name: "An engineer gets accounts, equipment, payroll and developer tooling",
			inputs: { name: "Ada", department: "engineering", isManager: false },
			mocks: {
				"hris-employee-create": { outputs: { employeeId: "E-100" } },
				"identity-provision": { outputs: { email: "ada@example.com" } },
				"equipment-order": {},
				"payroll-enrol": {},
				"email-send": {},
				"devtools-grant": {},
			},
			expect: {
				path: ["provisioned", "send-welcome", "grant-dev-tools", "dev-ready"],
				variables: { employeeId: "E-100", workEmail: "ada@example.com" },
			},
		},
		{
			id: "engineering-manager",
			name: "An engineering manager takes both role branches",
			inputs: { name: "Grace", department: "engineering", isManager: true },
			mocks: {
				"hris-employee-create": { outputs: { employeeId: "E-101" } },
				"identity-provision": { outputs: { email: "grace@example.com" } },
				"devtools-grant": {},
				"training-enrol": {},
			},
			expect: { path: ["role-extras", "grant-dev-tools", "enrol-leadership", "manager-ready"] },
		},
		{
			id: "sales",
			name: "A salesperson gets the standard welcome pack",
			inputs: { name: "Linus", department: "sales", isManager: false },
			mocks: {
				"hris-employee-create": { outputs: { employeeId: "E-102" } },
				"identity-provision": { outputs: { email: "linus@example.com" } },
				"welcome-pack-send": {},
			},
			expect: { path: ["role-extras", "send-welcome-pack", "onboarded"] },
		},
	],
}

export const customerKycOnboarding: ProcessTemplate = {
	id: "customer-kyc-onboarding",
	title: "Customer KYC Onboarding",
	description:
		"Opens a customer account only after know-your-customer checks. Identity is verified and the customer is screened against sanctions lists, a DMN table turns the results into a risk tier, low-risk customers are onboarded automatically, and anything else waits for a compliance analyst whose decision is final.",
	category: "onboarding",
	tags: ["dmn", "compliance", "kyc", "user task", "banking"],
	build: () =>
		Bpmn.createProcess("customer-kyc-onboarding")
			.name("Customer KYC Onboarding")
			.versionTag("1.0.0")
			.startEvent("application-received", { name: "Application received" })
			.serviceTask("verify-identity", {
				name: "Verify identity",
				taskType: "kyc-identity-verify",
				ioMapping: { outputs: [{ source: "=status", target: "identityStatus" }] },
			})
			.serviceTask("screen-sanctions", {
				name: "Screen sanctions lists",
				taskType: "kyc-sanctions-screen",
				ioMapping: { outputs: [{ source: "=hits", target: "sanctionHits" }] },
			})
			.businessRuleTask("assess-risk", {
				name: "Assess risk tier",
				decisionId: "kyc-risk-tier",
				resultVariable: "riskTier",
			})
			.exclusiveGateway("risk-route", { name: "Risk tier?" })
			.branch("low", (b) => b.condition('=riskTier = "low"').connectTo("open-merge"))
			.branch("review", (b) =>
				b
					.defaultFlow()
					.userTask("compliance-review", {
						name: "Compliance review",
						zeebeUserTask: true,
						candidateGroups: "compliance",
						priority: 80,
					})
					.exclusiveGateway("cleared", { name: "Cleared?" })
					.branch("yes", (y) => y.condition("=complianceCleared").connectTo("open-merge"))
					.branch("no", (n) =>
						n
							.defaultFlow()
							.serviceTask("decline-application", {
								name: "Decline application",
								taskType: "customer-notify",
								taskHeaders: { template: "kyc-declined" },
							})
							.endEvent("application-declined", { name: "Application declined" }),
					),
			)
			.exclusiveGateway("open-merge")
			.serviceTask("open-account", {
				name: "Open account",
				taskType: "core-banking-account-open",
				ioMapping: { outputs: [{ source: "=accountNumber", target: "accountNumber" }] },
			})
			.endEvent("account-opened", { name: "Account opened" })
			.withAutoLayout()
			.build(),
	decisions: () => [
		Dmn.createDecisionTable("kyc-risk-tier")
			.name("KYC risk tier")
			.hitPolicy("FIRST")
			.input({ label: "Identity check", expression: "identityStatus", typeRef: "string" })
			.input({ label: "Sanction hits", expression: "sanctionHits", typeRef: "number" })
			.input({ label: "Country risk", expression: "countryRisk", typeRef: "string" })
			.output({ label: "Risk tier", name: "tier", typeRef: "string" })
			.rule({
				description: "Unverified identity",
				inputs: ['"failed"', "-", "-"],
				outputs: ['"high"'],
			})
			.rule({
				description: "Possible sanctions match",
				inputs: ["-", "> 0", "-"],
				outputs: ['"high"'],
			})
			.rule({
				description: "High-risk jurisdiction",
				inputs: ["-", "-", '"high"'],
				outputs: ['"medium"'],
			})
			.rule({ description: "Everything else", inputs: ["-", "-", "-"], outputs: ['"low"'] })
			.build(),
	],
	scenarios: [
		{
			id: "low-risk",
			name: "A verified customer with no hits is onboarded automatically",
			inputs: { applicantId: "C-1", countryRisk: "low" },
			mocks: {
				"kyc-identity-verify": { outputs: { status: "verified" } },
				"kyc-sanctions-screen": { outputs: { hits: 0 } },
				"core-banking-account-open": { outputs: { accountNumber: "DE00-1234" } },
			},
			expect: {
				path: ["assess-risk", "risk-route", "open-account", "account-opened"],
				variables: { riskTier: "low", accountNumber: "DE00-1234" },
			},
		},
		{
			id: "sanctions-hit-declined",
			name: "A sanctions hit goes to compliance, who decline",
			inputs: { applicantId: "C-2", countryRisk: "low" },
			mocks: {
				"kyc-identity-verify": { outputs: { status: "verified" } },
				"kyc-sanctions-screen": { outputs: { hits: 1 } },
				userTask: { outputs: { complianceCleared: false } },
				"customer-notify": {},
			},
			expect: {
				path: ["compliance-review", "decline-application", "application-declined"],
				variables: { riskTier: "high" },
			},
		},
		{
			id: "medium-risk-cleared",
			name: "A high-risk jurisdiction is reviewed and cleared",
			inputs: { applicantId: "C-3", countryRisk: "high" },
			mocks: {
				"kyc-identity-verify": { outputs: { status: "verified" } },
				"kyc-sanctions-screen": { outputs: { hits: 0 } },
				userTask: { outputs: { complianceCleared: true } },
				"core-banking-account-open": { outputs: { accountNumber: "DE00-5678" } },
			},
			expect: { path: ["compliance-review", "open-account", "account-opened"] },
		},
	],
}

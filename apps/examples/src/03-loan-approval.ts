/**
 * Example 03 — Loan Approval
 *
 * Demonstrates:
 * - REST connector for external credit bureau API call
 * - Chained exclusive gateways for multi-step decision logic
 * - Business rule task for risk scoring (DMN integration)
 * - User task for manual underwriter review
 * - Script task for interest rate calculation
 * - connectTo() for merging paths from multiple branches
 */

import { writeFileSync } from "node:fs";
import { Bpmn } from "@bpmn-sdk/core";

const definitions = Bpmn.createProcess("LoanApproval")
	.withAutoLayout()
	.name("Loan Approval Process")
	.versionTag("1.0.0")

	.startEvent("start", { name: "Application Received" })

	// Fetch credit score from external bureau
	.restConnector("fetchCreditScore", {
		name: "Fetch Credit Score",
		method: "GET",
		url: '=creditBureauUrl + "/score/" + applicant.ssn',
		authentication: { type: "bearer", token: "=secrets.CREDIT_BUREAU_TOKEN" },
		resultVariable: "creditBureauResponse",
		resultExpression: "=creditBureauResponse.body",
	})

	// Automated pre-screening: reject below minimum threshold
	.exclusiveGateway("preScreen", { name: "Credit Score ≥ 580?" })

	.branch("rejected-prescreening", (b) =>
		b
			.condition("=creditBureauResponse.score < 580")
			.serviceTask("sendRejectionLetter", {
				name: "Send Rejection Letter",
				taskType: "email-sender",
				taskHeaders: { template: "loan-rejected-credit" },
				ioMapping: {
					inputs: [
						{ source: "=applicant.email", target: "to" },
						{ source: "=creditBureauResponse.score", target: "creditScore" },
					],
				},
			})
			.endEvent("endRejectedAutomatic", { name: "Rejected — Credit Score" }),
	)

	.branch("passed-prescreening", (b) =>
		b.condition("=creditBureauResponse.score >= 580").connectTo("riskScoring"),
	)

	// DMN-based risk scoring combining multiple applicant factors
	.businessRuleTask("riskScoring", {
		name: "Calculate Risk Score",
		decisionRef: "loan-risk-scoring",
		resultVariable: "riskAssessment",
	})

	// Route by risk tier; medium risk goes to underwriter, high risk is auto-rejected
	.exclusiveGateway("riskGateway", { name: "Risk Tier?" })

	// Low risk: calculate rate and generate offer automatically
	.branch("low-risk", (b) =>
		b
			.condition('=riskAssessment.tier = "low"')
			.scriptTask("calculateRate", {
				name: "Calculate Interest Rate",
				expression: "=if riskAssessment.score < 30 then baseRate + 0.5 else baseRate + 1.0",
				resultVariable: "interestRate",
			})
			.serviceTask("generateOffer", {
				name: "Generate Loan Offer",
				taskType: "offer-generator",
				ioMapping: {
					inputs: [
						{ source: "=application.amount", target: "amount" },
						{ source: "=interestRate", target: "rate" },
					],
					outputs: [{ source: "=offerId", target: "loanOfferId" }],
				},
			})
			.connectTo("notifyApplicant"),
	)

	// Medium risk: send to underwriter for manual review, then check their decision
	.branch("medium-risk", (b) =>
		b
			.condition('=riskAssessment.tier = "medium"')
			.userTask("underwriterReview", {
				name: "Underwriter Review",
				formId: "underwriter-review-form",
			})
			.connectTo("underwriterDecision"),
	)

	// High risk: auto-reject
	.branch("high-risk", (b) =>
		b
			.defaultFlow()
			.serviceTask("sendHighRiskRejection", {
				name: "Send Rejection Letter",
				taskType: "email-sender",
				taskHeaders: { template: "loan-rejected-risk" },
			})
			.endEvent("endRejectedRisk", { name: "Rejected — High Risk" }),
	)

	// Underwriter decision gateway (reached via connectTo from medium-risk branch)
	.exclusiveGateway("underwriterDecision", { name: "Underwriter Approved?" })

	.branch("uw-approved", (b) =>
		b.condition("=underwriterApproved = true").connectTo("notifyApplicant"),
	)

	.branch("uw-rejected", (b) =>
		b
			.defaultFlow()
			.serviceTask("sendManualRejection", {
				name: "Send Rejection Letter",
				taskType: "email-sender",
				taskHeaders: { template: "loan-rejected-underwriter" },
			})
			.endEvent("endRejectedManual", { name: "Rejected — Underwriter" }),
	)

	// Reached from both low-risk (auto) and medium-risk (approved) paths
	.serviceTask("notifyApplicant", {
		name: "Send Offer to Applicant",
		taskType: "email-sender",
		taskHeaders: { template: "loan-offer" },
		ioMapping: {
			inputs: [
				{ source: "=applicant.email", target: "to" },
				{ source: "=loanOfferId", target: "offerId" },
			],
		},
	})

	.endEvent("endApproved", { name: "Loan Approved" })
	.build();

const xml = Bpmn.export(definitions);
writeFileSync("output/03-loan-approval.bpmn", xml);
console.log("✓ 03-loan-approval.bpmn");

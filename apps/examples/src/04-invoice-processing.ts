/**
 * Example 04 — Invoice Processing
 *
 * Demonstrates:
 * - Inclusive gateway for multi-path approval routing
 * - Sub-process for the three-way match validation
 * - Script task for tax and total calculation
 * - Call activity to reuse the payment process
 */

import { writeFileSync } from "node:fs"
import { Bpmn } from "@bpmnkit/core"

const definitions = Bpmn.createProcess("InvoiceProcessing")
	.withAutoLayout()
	.name("Invoice Processing")
	.versionTag("1.0.0")

	.startEvent("start", { name: "Invoice Received" })

	// OCR and data extraction
	.serviceTask("extractData", {
		name: "Extract Invoice Data",
		taskType: "ocr-extraction",
		ioMapping: {
			inputs: [{ source: "=invoice.documentUrl", target: "url" }],
			outputs: [
				{ source: "=vendor", target: "vendor" },
				{ source: "=lineItems", target: "lineItems" },
				{ source: "=invoiceTotal", target: "invoiceTotal" },
			],
		},
	})

	// Three-way match: invoice vs PO vs goods receipt
	.subProcess(
		"threeWayMatch",
		(sub) => {
			sub
				.startEvent("matchStart")
				.serviceTask("fetchPO", {
					name: "Fetch Purchase Order",
					taskType: "erp-po-fetch",
					ioMapping: {
						inputs: [{ source: "=invoice.poNumber", target: "poNumber" }],
						outputs: [{ source: "=purchaseOrder", target: "purchaseOrder" }],
					},
				})
				.serviceTask("fetchGoodsReceipt", {
					name: "Fetch Goods Receipt",
					taskType: "erp-gr-fetch",
					ioMapping: {
						inputs: [{ source: "=invoice.poNumber", target: "poNumber" }],
						outputs: [{ source: "=goodsReceipt", target: "goodsReceipt" }],
					},
				})
				.scriptTask("runMatch", {
					name: "Run Three-Way Match",
					expression: '=invoiceTotal = purchaseOrder.total and goodsReceipt.status = "received"',
					resultVariable: "matchPassed",
				})
				.endEvent("matchEnd")
		},
		{ name: "Three-Way Match Validation" },
	)

	// If match fails, flag for manual review; if it passes, continue to approval
	.exclusiveGateway("matchResult", { name: "Match Passed?" })

	.branch("match-failed", (b) =>
		b
			.condition("=matchPassed = false")
			.userTask("resolveDiscrepancy", {
				name: "Resolve Discrepancy",
				formId: "invoice-discrepancy-form",
			})
			.connectTo("calculateTotals"),
	)

	.branch("match-passed", (b) => b.condition("=matchPassed = true").connectTo("calculateTotals"))

	// Calculate tax and final payment amount
	.scriptTask("calculateTotals", {
		name: "Calculate Totals with Tax",
		expression: "=invoiceTotal * (1 + vendor.taxRate)",
		resultVariable: "paymentAmount",
	})

	// Inclusive gateway: multiple approvals may be required simultaneously
	.inclusiveGateway("approvalRouting", {
		name: "Determine Required Approvals",
	})

	.branch("dept-approval", (b) =>
		b
			.condition("=paymentAmount > 1000")
			.userTask("deptManagerApproval", {
				name: "Department Manager Approval",
				formId: "invoice-approval-form",
			})
			.connectTo("approvalJoin"),
	)

	.branch("finance-approval", (b) =>
		b
			.condition("=paymentAmount > 10000")
			.userTask("financeApproval", {
				name: "Finance Director Approval",
				formId: "invoice-approval-form",
			})
			.connectTo("approvalJoin"),
	)

	.branch("auto-approval", (b) => b.condition("=paymentAmount <= 1000").connectTo("approvalJoin"))

	.inclusiveGateway("approvalJoin", { name: "All Approvals Received" })

	// Reuse shared payment execution process
	.callActivity("executePayment", {
		name: "Execute Payment",
		processId: "PaymentExecution",
		propagateAllChildVariables: false,
		ioMapping: {
			inputs: [
				{ source: "=vendor.bankAccount", target: "bankAccount" },
				{ source: "=paymentAmount", target: "amount" },
				{ source: "=invoice.currency", target: "currency" },
			],
			outputs: [{ source: "=transactionId", target: "paymentTransactionId" }],
		},
	})

	.serviceTask("archiveInvoice", {
		name: "Archive Invoice",
		taskType: "document-archive",
		ioMapping: {
			inputs: [
				{ source: "=invoice.id", target: "invoiceId" },
				{ source: "=paymentTransactionId", target: "transactionId" },
			],
		},
	})

	.endEvent("end", { name: "Invoice Processed" })
	.build()

const xml = Bpmn.export(definitions)
writeFileSync("output/04-invoice-processing.bpmn", xml)
console.log("✓ 04-invoice-processing.bpmn")

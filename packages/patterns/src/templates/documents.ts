import { Bpmn, Form } from "@bpmnkit/core"
import { aiTask } from "./ai-task.js"
import type { ProcessTemplate } from "./types.js"

export const invoiceCapture: ProcessTemplate = {
	id: "invoice-capture",
	title: "Invoice Capture",
	description:
		"Reads supplier invoices with an extraction service and checks that net plus tax equals gross in a FEEL script. Invoices that add up and were read with high confidence post straight to the ERP; the rest are shown to an accounts-payable clerk in a Camunda form to correct before posting.",
	category: "documents",
	tags: ["idp", "script task", "camunda form", "straight-through processing", "finance"],
	build: () =>
		Bpmn.createProcess("invoice-capture")
			.name("Invoice Capture")
			.versionTag("1.0.0")
			.startEvent("invoice-received", { name: "Invoice received" })
			.serviceTask("extract-invoice", {
				name: "Extract invoice data",
				taskType: "document-extract",
				taskHeaders: { model: "invoice" },
				ioMapping: {
					outputs: [
						{ source: "=fields", target: "invoice" },
						{ source: "=confidence", target: "extractionConfidence" },
					],
				},
			})
			.scriptTask("validate-totals", {
				name: "Validate totals",
				expression: "=abs(invoice.net + invoice.tax - invoice.gross) < 0.01",
				resultVariable: "totalsValid",
			})
			.exclusiveGateway("straight-through", { name: "Straight-through?" })
			.branch("auto", (b) =>
				b.condition("=totalsValid and extractionConfidence >= 0.9").connectTo("post-invoice"),
			)
			.branch("verify", (b) =>
				b
					.defaultFlow()
					.userTask("verify-invoice", {
						name: "Verify extracted data",
						zeebeUserTask: true,
						formId: "invoice-verification",
						candidateGroups: "accounts-payable",
					})
					.connectTo("post-invoice"),
			)
			.serviceTask("post-invoice", {
				name: "Post to ERP",
				taskType: "erp-invoice-post",
				ioMapping: { outputs: [{ source: "=documentNumber", target: "erpDocument" }] },
			})
			.endEvent("invoice-posted", { name: "Invoice posted" })
			.withAutoLayout()
			.build(),
	forms: () => [
		Form.create("invoice-verification")
			.text("Correct any field the extraction got wrong, then submit to post the invoice.")
			.textfield("Supplier", "invoice.supplier", { validate: { required: true } })
			.textfield("Invoice number", "invoice.number", { validate: { required: true } })
			.textfield("Net amount", "invoice.net")
			.textfield("Tax amount", "invoice.tax")
			.textfield("Gross amount", "invoice.gross")
			.textarea("Note for the ledger", "verificationNote")
			.build(),
	],
	scenarios: [
		{
			id: "straight-through",
			name: "A clean invoice posts without a clerk",
			inputs: { documentUrl: "s3://inbox/inv-1.pdf" },
			mocks: {
				"document-extract": {
					outputs: {
						fields: { supplier: "Acme", number: "A-17", net: 100, tax: 19, gross: 119 },
						confidence: 0.97,
					},
				},
				"erp-invoice-post": { outputs: { documentNumber: "5100000017" } },
			},
			expect: {
				path: ["validate-totals", "straight-through", "post-invoice", "invoice-posted"],
				variables: { totalsValid: true, erpDocument: "5100000017" },
			},
		},
		{
			id: "totals-mismatch",
			name: "Totals that do not add up go to a clerk",
			inputs: { documentUrl: "s3://inbox/inv-2.pdf" },
			mocks: {
				"document-extract": {
					outputs: {
						fields: { supplier: "Acme", number: "A-18", net: 100, tax: 19, gross: 191 },
						confidence: 0.95,
					},
				},
				userTask: { outputs: { verificationNote: "gross misread" } },
				"erp-invoice-post": { outputs: { documentNumber: "5100000018" } },
			},
			expect: {
				path: ["validate-totals", "verify-invoice", "post-invoice"],
				variables: { totalsValid: false },
			},
		},
	],
}

export const documentSignature: ProcessTemplate = {
	id: "document-signature",
	title: "Document E-Signature",
	description:
		"Generates an agreement, sends it for e-signature and waits for the provider's callback, correlated on the envelope id. A signed agreement is archived; a declined one goes back to its owner; and if nothing comes back in 14 days an interrupting timer voids the envelope so it cannot be signed late.",
	category: "documents",
	tags: ["receive task", "message correlation", "timer boundary", "e-signature"],
	build: () =>
		Bpmn.createProcess("document-signature")
			.name("Document E-Signature")
			.versionTag("1.0.0")
			.startEvent("agreement-requested", { name: "Agreement requested" })
			.serviceTask("generate-document", {
				name: "Generate agreement",
				taskType: "document-generate",
				taskHeaders: { template: "master-services-agreement" },
				ioMapping: { outputs: [{ source: "=documentId", target: "documentId" }] },
			})
			.serviceTask("send-envelope", {
				name: "Send for signature",
				taskType: "esign-envelope-send",
				ioMapping: { outputs: [{ source: "=envelopeId", target: "envelopeId" }] },
			})
			.receiveTask("await-signature", {
				name: "Await signing outcome",
				messageName: "signature-completed",
				correlationKey: "=envelopeId",
			})
			.withBoundary("signature-expired", { name: "14 days", timerDuration: "P14D" }, (b) =>
				b
					.serviceTask("void-envelope", { name: "Void envelope", taskType: "esign-envelope-void" })
					.endEvent("envelope-expired", { name: "Envelope expired" }),
			)
			.exclusiveGateway("signed", { name: "Signed?" })
			.branch("signed", (b) =>
				b
					.condition('=signatureStatus = "signed"')
					.serviceTask("archive-document", {
						name: "Archive signed agreement",
						taskType: "dms-archive",
						ioMapping: { outputs: [{ source: "=archiveId", target: "archiveId" }] },
					})
					.endEvent("agreement-signed", { name: "Agreement signed" }),
			)
			.branch("declined", (b) =>
				b
					.defaultFlow()
					.serviceTask("notify-owner", {
						name: "Notify owner: declined",
						taskType: "owner-notify",
						taskHeaders: { template: "signature-declined" },
					})
					.endEvent("agreement-declined", { name: "Agreement declined" }),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "signed",
			name: "The counterparty signs and the agreement is archived",
			inputs: { counterparty: "Globex", signatureStatus: "signed" },
			mocks: {
				"document-generate": { outputs: { documentId: "DOC-1" } },
				"esign-envelope-send": { outputs: { envelopeId: "ENV-1" } },
				"dms-archive": { outputs: { archiveId: "ARC-1" } },
			},
			expect: {
				path: ["send-envelope", "await-signature", "archive-document", "agreement-signed"],
				variables: { envelopeId: "ENV-1", archiveId: "ARC-1" },
			},
		},
		{
			id: "declined",
			name: "The counterparty declines and the owner is told",
			inputs: { counterparty: "Globex", signatureStatus: "declined" },
			mocks: {
				"document-generate": { outputs: { documentId: "DOC-2" } },
				"esign-envelope-send": { outputs: { envelopeId: "ENV-2" } },
				"owner-notify": {},
			},
			expect: { path: ["await-signature", "notify-owner", "agreement-declined"] },
		},
	],
}

export const documentClassification: ProcessTemplate = {
	id: "document-classification",
	title: "AI Document Classification",
	description:
		"Classifies incoming documents with one model call that returns JSON, then routes each to the team that owns it: invoices to accounts payable, contracts to legal. Anything the model is unsure about — low confidence or an unknown type — lands with a human who files it by hand.",
	category: "documents",
	tags: ["ai", "ai agent task", "routing", "json output"],
	build: () =>
		Bpmn.createProcess("document-classification")
			.name("AI Document Classification")
			.versionTag("1.0.0")
			.startEvent("document-uploaded", { name: "Document uploaded" })
			.serviceTask(
				"classify-document",
				aiTask({
					name: "Classify document",
					systemPrompt:
						'Classify business documents. Reply with JSON: {"type": "invoice" | "contract" | "other", "confidence": number between 0 and 1}.',
					userPrompt: '="Document text:\\n" + documentText',
					responseFormat: "json",
					outputs: [
						{ source: "=agent.responseJson.type", target: "documentType" },
						{ source: "=agent.responseJson.confidence", target: "classificationConfidence" },
					],
				}),
			)
			.exclusiveGateway("route", { name: "Document type?" })
			.branch("invoice", (b) =>
				b
					.condition('=documentType = "invoice" and classificationConfidence >= 0.8')
					.serviceTask("route-to-ap", {
						name: "Route to accounts payable",
						taskType: "dms-route",
						taskHeaders: { queue: "accounts-payable" },
					})
					.endEvent("filed-invoice", { name: "Filed as invoice" }),
			)
			.branch("contract", (b) =>
				b
					.condition('=documentType = "contract" and classificationConfidence >= 0.8')
					.serviceTask("route-to-legal", {
						name: "Route to legal",
						taskType: "dms-route",
						taskHeaders: { queue: "legal" },
					})
					.endEvent("filed-contract", { name: "Filed as contract" }),
			)
			.branch("unsure", (b) =>
				b
					.defaultFlow()
					.userTask("classify-manually", {
						name: "Classify manually",
						zeebeUserTask: true,
						candidateGroups: "records",
					})
					.endEvent("filed-manually", { name: "Filed by hand" }),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "invoice",
			name: "A confident invoice goes to accounts payable",
			inputs: { documentText: "INVOICE No. 4411 ... Total due EUR 1,190.00" },
			mocks: {
				"io.camunda.agenticai:aiagent:1": {
					outputs: { agent: { responseJson: { type: "invoice", confidence: 0.96 } } },
				},
				"dms-route": {},
			},
			expect: {
				path: ["classify-document", "route", "route-to-ap", "filed-invoice"],
				variables: { documentType: "invoice" },
			},
		},
		{
			id: "low-confidence",
			name: "A contract the model is unsure about goes to a human",
			inputs: { documentText: "Heads of terms, draft 2 ..." },
			mocks: {
				"io.camunda.agenticai:aiagent:1": {
					outputs: { agent: { responseJson: { type: "contract", confidence: 0.55 } } },
				},
				userTask: {},
			},
			expect: { path: ["route", "classify-manually", "filed-manually"] },
		},
	],
}

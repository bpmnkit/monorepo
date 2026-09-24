import { Bpmn, Dmn } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const orderToCash: ProcessTemplate = {
	id: "order-to-cash",
	title: "Order to Cash",
	description:
		"Takes an order from receipt to cash in the bank. A DMN table sets the credit decision, stock is reserved in a sub-process that throws OUT_OF_STOCK when it cannot be, invoicing and shipping run in parallel, and the instance waits for the payment message correlated on the order id before closing the order. An out-of-stock order is cancelled and the customer is told why.",
	category: "order-to-cash",
	tags: ["dmn", "error boundary", "parallel gateway", "message correlation", "e-commerce"],
	build: () =>
		Bpmn.createProcess("order-to-cash")
			.name("Order to Cash")
			.versionTag("1.0.0")
			.startEvent("order-received", { name: "Order received" })
			.serviceTask("validate-order", {
				name: "Validate order",
				taskType: "order-validate",
				ioMapping: { outputs: [{ source: "=valid", target: "orderValid" }] },
			})
			.businessRuleTask("credit-decision", {
				name: "Decide credit terms",
				decisionId: "credit-decision",
				resultVariable: "credit",
			})
			.exclusiveGateway("credit-ok", { name: "Credit approved?" })
			.branch("declined", (b) =>
				b
					.condition('=orderValid = false or credit.decision = "decline"')
					.serviceTask("notify-declined", {
						name: "Notify customer: declined",
						taskType: "customer-notify",
						taskHeaders: { template: "order-declined" },
					})
					.endEvent("order-declined", { name: "Order declined" }),
			)
			.branch("approved", (b) => b.defaultFlow().connectTo("reserve-stock"))
			.subProcess(
				"reserve-stock",
				(s) =>
					s
						.startEvent("reserve-start")
						.serviceTask("check-stock", {
							name: "Check stock",
							taskType: "inventory-check",
							ioMapping: { outputs: [{ source: "=available", target: "stockAvailable" }] },
						})
						.exclusiveGateway("in-stock", { name: "In stock?" })
						.branch("yes", (b) =>
							b
								.condition("=stockAvailable")
								.serviceTask("reserve-items", {
									name: "Reserve items",
									taskType: "inventory-reserve",
									ioMapping: { outputs: [{ source: "=reservationId", target: "reservationId" }] },
								})
								.endEvent("reserved"),
						)
						.branch("no", (b) =>
							b.defaultFlow().endEvent("out-of-stock", { errorCode: "OUT_OF_STOCK" }),
						),
				{ name: "Reserve stock" },
			)
			.withBoundary("on-out-of-stock", { name: "Out of stock", errorCode: "OUT_OF_STOCK" }, (b) =>
				b
					.serviceTask("cancel-order", { name: "Cancel order", taskType: "order-cancel" })
					.serviceTask("notify-out-of-stock", {
						name: "Notify customer: out of stock",
						taskType: "customer-notify",
						taskHeaders: { template: "order-out-of-stock" },
					})
					.endEvent("order-cancelled", { name: "Order cancelled" }),
			)
			.parallelGateway("fulfil")
			.branch("invoice", (b) =>
				b.serviceTask("create-invoice", {
					name: "Create invoice",
					taskType: "invoice-create",
					ioMapping: { outputs: [{ source: "=invoiceId", target: "invoiceId" }] },
				}),
			)
			.branch("ship", (b) =>
				b.serviceTask("ship-order", {
					name: "Ship order",
					taskType: "shipment-create",
					ioMapping: { outputs: [{ source: "=trackingNumber", target: "trackingNumber" }] },
				}),
			)
			.parallelGateway("fulfilled")
			.receiveTask("await-payment", {
				name: "Await payment",
				messageName: "payment-received",
				correlationKey: "=orderId",
			})
			.serviceTask("close-order", { name: "Close order", taskType: "order-close" })
			.endEvent("order-closed", { name: "Order closed" })
			.withAutoLayout()
			.build(),
	decisions: () => [
		Dmn.createDecisionTable("credit-decision")
			.name("Credit decision")
			.hitPolicy("FIRST")
			.input({ label: "Order total", expression: "orderTotal", typeRef: "number" })
			.input({ label: "Customer rating", expression: "customerRating", typeRef: "string" })
			.output({ label: "Decision", name: "decision", typeRef: "string" })
			.output({ label: "Payment terms (days)", name: "termsDays", typeRef: "number" })
			.rule({ description: "Poor rating", inputs: ["-", '"C"'], outputs: ['"decline"', "0"] })
			.rule({
				description: "Over credit limit",
				inputs: ["> 25000", "-"],
				outputs: ['"decline"', "0"],
			})
			.rule({
				description: "Good customer",
				inputs: ["<= 5000", '"A"'],
				outputs: ['"approve"', "30"],
			})
			.rule({ description: "Default terms", inputs: ["-", "-"], outputs: ['"approve"', "14"] })
			.build(),
	],
	scenarios: [
		{
			id: "happy-path",
			name: "Valid order in stock is invoiced, shipped and paid",
			inputs: { orderId: "SO-1001", orderTotal: 1200, customerRating: "A" },
			mocks: {
				"order-validate": { outputs: { valid: true } },
				"inventory-check": { outputs: { available: true } },
				"inventory-reserve": { outputs: { reservationId: "R-77" } },
				"invoice-create": { outputs: { invoiceId: "INV-9" } },
				"shipment-create": { outputs: { trackingNumber: "1Z999" } },
				"order-close": {},
			},
			expect: {
				path: [
					"credit-decision",
					"reserve-items",
					"create-invoice",
					"await-payment",
					"order-closed",
				],
				variables: { credit: { decision: "approve", termsDays: 30 }, reservationId: "R-77" },
			},
		},
		{
			id: "out-of-stock",
			name: "Out-of-stock order is cancelled through the error boundary",
			inputs: { orderId: "SO-1002", orderTotal: 80, customerRating: "B" },
			mocks: {
				"order-validate": { outputs: { valid: true } },
				"inventory-check": { outputs: { available: false } },
				"order-cancel": {},
				"customer-notify": {},
			},
			expect: { path: ["out-of-stock", "on-out-of-stock", "cancel-order", "order-cancelled"] },
		},
		{
			id: "credit-declined",
			name: "Order from a customer rated C is declined",
			inputs: { orderId: "SO-1003", orderTotal: 5000, customerRating: "C" },
			mocks: { "order-validate": { outputs: { valid: true } }, "customer-notify": {} },
			expect: { path: ["credit-decision", "notify-declined", "order-declined"] },
		},
	],
}

export const paymentCollection: ProcessTemplate = {
	id: "payment-collection",
	title: "Payment Collection & Dunning",
	description:
		"Sends an invoice and waits for the payment message, correlated on the invoice id. Each payment is applied to the ledger: a settled invoice is closed, a balance under 5 is written off, and a larger balance gets a statement before waiting again. Every 14 days without payment a reminder goes out, and after the third the invoice is handed to collections.",
	category: "order-to-cash",
	tags: ["receive task", "message correlation", "timer boundary", "loop", "accounts receivable"],
	build: () =>
		Bpmn.createProcess("payment-collection")
			.name("Payment Collection & Dunning")
			.versionTag("1.0.0")
			.startEvent("invoice-issued", { name: "Invoice issued" })
			.scriptTask("start-reminders", {
				name: "No reminders yet",
				expression: "=0",
				resultVariable: "reminders",
			})
			.serviceTask("send-invoice", {
				name: "Send invoice",
				taskType: "invoice-send",
				taskHeaders: { template: "invoice" },
			})
			.exclusiveGateway("await-merge")
			.receiveTask("await-payment", {
				name: "Await payment",
				messageName: "payment-received",
				correlationKey: "=invoiceId",
			})
			.withBoundary("payment-overdue", { name: "14 days unpaid", timerDuration: "P14D" }, (b) =>
				b
					.scriptTask("count-reminder", {
						name: "Count reminder",
						expression: "=reminders + 1",
						resultVariable: "reminders",
					})
					.exclusiveGateway("reminders-left", { name: "Third reminder?" })
					.branch("collections", (c) =>
						c
							.condition("=reminders >= 3")
							.serviceTask("hand-to-collections", {
								name: "Hand over to collections",
								taskType: "collections-assign",
							})
							.endEvent("in-collections", { name: "In collections" }),
					)
					.branch("remind", (r) =>
						r
							.defaultFlow()
							.serviceTask("send-reminder", {
								name: "Send payment reminder",
								taskType: "invoice-send",
								taskHeaders: { template: "reminder" },
							})
							.connectTo("await-merge"),
					),
			)
			.serviceTask("apply-payment", {
				name: "Apply payment to ledger",
				taskType: "ledger-apply-payment",
				ioMapping: { outputs: [{ source: "=balance", target: "outstanding" }] },
			})
			.exclusiveGateway("settled", { name: "Balance left?" })
			.branch("settled", (b) => b.condition("=outstanding <= 0").connectTo("close-invoice"))
			.branch("write-off", (b) =>
				b
					.condition("=outstanding < 5")
					.serviceTask("write-off", {
						name: "Write off small balance",
						taskType: "ledger-write-off",
					})
					.connectTo("close-invoice"),
			)
			.branch("statement", (b) =>
				b
					.defaultFlow()
					.serviceTask("send-statement", {
						name: "Send balance statement",
						taskType: "invoice-send",
						taskHeaders: { template: "statement" },
					})
					.connectTo("await-merge"),
			)
			.serviceTask("close-invoice", { name: "Close invoice", taskType: "ledger-close-invoice" })
			.endEvent("invoice-paid", { name: "Invoice paid" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "paid-in-full",
			name: "The customer pays in full and the invoice is closed",
			inputs: { invoiceId: "INV-100", amountDue: 480 },
			mocks: {
				"invoice-send": {},
				"ledger-apply-payment": { outputs: { balance: 0 } },
				"ledger-close-invoice": {},
			},
			expect: {
				path: ["send-invoice", "await-payment", "apply-payment", "close-invoice", "invoice-paid"],
				variables: { outstanding: 0, reminders: 0 },
			},
		},
		{
			id: "small-balance-written-off",
			name: "A 2.40 shortfall is written off",
			inputs: { invoiceId: "INV-101", amountDue: 480 },
			mocks: {
				"invoice-send": {},
				"ledger-apply-payment": { outputs: { balance: 2.4 } },
				"ledger-write-off": {},
				"ledger-close-invoice": {},
			},
			expect: { path: ["apply-payment", "write-off", "close-invoice", "invoice-paid"] },
		},
	],
}

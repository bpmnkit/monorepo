import { Bpmn } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const travelBookingSaga: ProcessTemplate = {
	id: "travel-booking-saga",
	title: "Travel Booking Saga",
	description:
		"Books a flight, a hotel and a rental car as one unit of work without BPMN compensation events. The bookings run in a sub-process that throws BOOKING_FAILED as soon as a supplier cannot confirm; the error boundary then runs explicit, idempotent undo steps for everything that may already be held and tells the traveller. A trip where all three confirm gets its itinerary.",
	category: "saga",
	tags: ["saga", "error boundary", "sub-process", "idempotent undo", "travel"],
	build: () =>
		Bpmn.createProcess("travel-booking-saga")
			.name("Travel Booking Saga")
			.versionTag("1.0.0")
			.startEvent("trip-requested", { name: "Trip requested" })
			.subProcess(
				"book-trip",
				(s) =>
					s
						.startEvent("booking-start")
						.serviceTask("book-flight", {
							name: "Book flight",
							taskType: "flight-book",
							ioMapping: { outputs: [{ source: "=confirmation", target: "flightConfirmation" }] },
						})
						.serviceTask("book-hotel", {
							name: "Book hotel",
							taskType: "hotel-book",
							ioMapping: { outputs: [{ source: "=confirmation", target: "hotelConfirmation" }] },
						})
						.exclusiveGateway("hotel-ok", { name: "Hotel confirmed?" })
						.branch("hotel-failed", (b) =>
							b
								.condition("=hotelConfirmation = null")
								.endEvent("hotel-unavailable", { errorCode: "BOOKING_FAILED" }),
						)
						.branch("hotel-confirmed", (b) =>
							b
								.defaultFlow()
								.serviceTask("book-car", {
									name: "Book rental car",
									taskType: "car-book",
									ioMapping: { outputs: [{ source: "=confirmation", target: "carConfirmation" }] },
								})
								.exclusiveGateway("car-ok", { name: "Car confirmed?" })
								.branch("car-failed", (c) =>
									c
										.condition("=carConfirmation = null")
										.endEvent("car-unavailable", { errorCode: "BOOKING_FAILED" }),
								)
								.branch("car-confirmed", (c) => c.defaultFlow().endEvent("trip-booked")),
						),
				{ name: "Book trip" },
			)
			.withBoundary(
				"on-booking-failed",
				{ name: "Booking failed", errorCode: "BOOKING_FAILED" },
				(b) =>
					b
						.serviceTask("cancel-flight", {
							name: "Cancel flight",
							taskType: "flight-cancel",
							documentation: "Idempotent: cancelling a booking that does not exist is a no-op.",
						})
						.serviceTask("release-hotel", {
							name: "Release hotel hold",
							taskType: "hotel-release",
							documentation: "Idempotent: releasing a hold that does not exist is a no-op.",
						})
						.serviceTask("notify-trip-failed", {
							name: "Notify traveller: not booked",
							taskType: "traveller-notify",
							taskHeaders: { template: "trip-failed" },
						})
						.endEvent("trip-not-booked", { name: "Trip not booked" }),
			)
			.serviceTask("send-itinerary", {
				name: "Send itinerary",
				taskType: "traveller-notify",
				taskHeaders: { template: "itinerary" },
			})
			.endEvent("trip-confirmed", { name: "Trip confirmed" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "all-booked",
			name: "Flight, hotel and car all confirm",
			inputs: { travellerId: "TR-1", destination: "Lisbon" },
			mocks: {
				"flight-book": { outputs: { confirmation: "FL-1" } },
				"hotel-book": { outputs: { confirmation: "HT-1" } },
				"car-book": { outputs: { confirmation: "CR-1" } },
				"traveller-notify": {},
			},
			expect: {
				path: [
					"book-flight",
					"book-hotel",
					"book-car",
					"trip-booked",
					"send-itinerary",
					"trip-confirmed",
				],
				variables: { flightConfirmation: "FL-1", carConfirmation: "CR-1" },
			},
		},
		{
			id: "hotel-unavailable",
			name: "No hotel: the flight is cancelled and the traveller told",
			inputs: { travellerId: "TR-2", destination: "Lisbon" },
			mocks: {
				"flight-book": { outputs: { confirmation: "FL-2" } },
				"hotel-book": { outputs: { confirmation: null } },
				"flight-cancel": {},
				"hotel-release": {},
				"traveller-notify": {},
			},
			expect: {
				path: [
					"book-hotel",
					"hotel-unavailable",
					"on-booking-failed",
					"cancel-flight",
					"trip-not-booked",
				],
			},
		},
		{
			id: "car-unavailable",
			name: "No car: flight and hotel are both undone",
			inputs: { travellerId: "TR-3", destination: "Lisbon" },
			mocks: {
				"flight-book": { outputs: { confirmation: "FL-3" } },
				"hotel-book": { outputs: { confirmation: "HT-3" } },
				"car-book": { outputs: { confirmation: null } },
				"flight-cancel": {},
				"hotel-release": {},
				"traveller-notify": {},
			},
			expect: {
				path: ["book-car", "car-unavailable", "cancel-flight", "release-hotel", "trip-not-booked"],
			},
		},
	],
}

export const paymentSaga: ProcessTemplate = {
	id: "payment-saga",
	title: "Checkout Payment Saga",
	description:
		"Reserves stock before taking payment, so a paid order can always be shipped. Payment runs in its own sub-process — authorise, then capture — and a declined authorisation throws PAYMENT_DECLINED. The error boundary releases the reservation, which is the only thing to undo at that point, and tells the customer; a captured payment goes on to shipment.",
	category: "saga",
	tags: ["saga", "error boundary", "payments", "e-commerce"],
	build: () =>
		Bpmn.createProcess("payment-saga")
			.name("Checkout Payment Saga")
			.versionTag("1.0.0")
			.startEvent("checkout-completed", { name: "Checkout completed" })
			.serviceTask("reserve-stock", {
				name: "Reserve stock",
				taskType: "inventory-reserve",
				ioMapping: { outputs: [{ source: "=reservationId", target: "reservationId" }] },
			})
			.subProcess(
				"take-payment",
				(s) =>
					s
						.startEvent("payment-start")
						.serviceTask("authorise-payment", {
							name: "Authorise payment",
							taskType: "payment-authorise",
							ioMapping: {
								outputs: [
									{ source: "=authorised", target: "paymentAuthorised" },
									{ source: "=authorisationId", target: "authorisationId" },
								],
							},
						})
						.exclusiveGateway("authorised", { name: "Authorised?" })
						.branch("yes", (b) =>
							b
								.condition("=paymentAuthorised")
								.serviceTask("capture-payment", {
									name: "Capture payment",
									taskType: "payment-capture",
									ioMapping: { outputs: [{ source: "=paymentId", target: "paymentId" }] },
								})
								.endEvent("payment-taken"),
						)
						.branch("no", (b) =>
							b.defaultFlow().endEvent("payment-declined", { errorCode: "PAYMENT_DECLINED" }),
						),
				{ name: "Take payment" },
			)
			.withBoundary(
				"on-payment-declined",
				{ name: "Payment declined", errorCode: "PAYMENT_DECLINED" },
				(b) =>
					b
						.serviceTask("release-stock", {
							name: "Release stock",
							taskType: "inventory-release",
							ioMapping: { inputs: [{ source: "=reservationId", target: "releaseReservationId" }] },
						})
						.serviceTask("notify-declined", {
							name: "Notify customer: payment declined",
							taskType: "customer-notify",
							taskHeaders: { template: "payment-declined" },
						})
						.endEvent("order-failed", { name: "Order failed" }),
			)
			.serviceTask("create-shipment", {
				name: "Create shipment",
				taskType: "shipment-create",
				ioMapping: { outputs: [{ source: "=trackingNumber", target: "trackingNumber" }] },
			})
			.endEvent("order-shipped", { name: "Order shipped" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "paid",
			name: "Payment is authorised and captured, the order ships",
			inputs: { orderId: "SO-7", amount: 59.9 },
			mocks: {
				"inventory-reserve": { outputs: { reservationId: "RES-7" } },
				"payment-authorise": { outputs: { authorised: true, authorisationId: "AUTH-7" } },
				"payment-capture": { outputs: { paymentId: "PAY-7" } },
				"shipment-create": { outputs: { trackingNumber: "1Z7" } },
			},
			expect: {
				path: [
					"reserve-stock",
					"authorise-payment",
					"capture-payment",
					"create-shipment",
					"order-shipped",
				],
				variables: { paymentId: "PAY-7", trackingNumber: "1Z7" },
			},
		},
		{
			id: "declined",
			name: "A declined card releases the stock",
			inputs: { orderId: "SO-8", amount: 59.9 },
			mocks: {
				"inventory-reserve": { outputs: { reservationId: "RES-8" } },
				"payment-authorise": { outputs: { authorised: false, authorisationId: null } },
				"inventory-release": {},
				"customer-notify": {},
			},
			expect: {
				path: [
					"authorise-payment",
					"payment-declined",
					"on-payment-declined",
					"release-stock",
					"order-failed",
				],
			},
		},
	],
}

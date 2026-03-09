/**
 * Example 02 — IT Incident Response
 *
 * Demonstrates:
 * - Timer boundary event for automatic escalation
 * - Exclusive gateway for severity routing
 * - Sub-process encapsulating the resolution workflow
 * - Multiple end events for different outcomes
 */

import { writeFileSync } from "node:fs"
import { Bpmn } from "@bpmn-sdk/core"

const definitions = Bpmn.createProcess("IncidentResponse")
	.withAutoLayout()
	.name("IT Incident Response")
	.versionTag("1.0.0")

	.startEvent("start", { name: "Incident Reported" })

	// Classify the incident severity
	.serviceTask("classify", {
		name: "Classify Incident",
		taskType: "incident-classifier",
		ioMapping: {
			inputs: [{ source: "=incident.description", target: "text" }],
			outputs: [{ source: "=severity", target: "severity" }],
		},
	})

	// Route by severity
	.exclusiveGateway("severityGateway", { name: "Severity?" })

	// Branch: critical → immediate pager alert + war room
	.branch("critical", (b) =>
		b
			.condition('=severity = "critical"')
			.serviceTask("pageOncall", {
				name: "Page On-Call Engineer",
				taskType: "pagerduty-alert",
				taskHeaders: { urgency: "high" },
			})
			.userTask("warRoom", {
				name: "Conduct War Room",
				formId: "war-room-form",
			})
			.connectTo("resolveGateway"),
	)

	// Branch: high → assign to senior engineer with SLA timer
	.branch("high", (b) =>
		b
			.condition('=severity = "high"')
			.userTask("assignSenior", {
				name: "Assign Senior Engineer",
				formId: "assignment-form",
			})
			.connectTo("resolveGateway"),
	)

	// Branch: low/medium → standard queue
	.branch("standard", (b) =>
		b
			.defaultFlow()
			.serviceTask("createTicket", {
				name: "Create Support Ticket",
				taskType: "ticketing-system",
			})
			.connectTo("resolveGateway"),
	)

	.exclusiveGateway("resolveGateway", { name: "Continue to Resolution" })

	// Resolution sub-process (encapsulates the fix + verification steps)
	.subProcess(
		"resolutionProcess",
		(sub) => {
			sub
				.startEvent("resStart")
				.serviceTask("diagnose", {
					name: "Run Diagnostics",
					taskType: "diagnostic-runner",
				})
				.userTask("applyFix", {
					name: "Apply Fix",
					formId: "fix-application-form",
				})
				.serviceTask("verify", {
					name: "Verify Resolution",
					taskType: "health-check",
					ioMapping: {
						outputs: [{ source: "=healthy", target: "systemHealthy" }],
					},
				})
				.endEvent("resEnd")
		},
		{ name: "Resolve Incident" },
	)

	// Check if the fix actually worked
	.exclusiveGateway("fixWorked", { name: "Resolved?" })

	.branch("yes", (b) =>
		b
			.condition("=systemHealthy = true")
			.serviceTask("closeIncident", {
				name: "Close Incident",
				taskType: "incident-close",
			})
			.endEvent("endResolved", { name: "Incident Resolved" }),
	)

	.branch("no", (b) =>
		b
			.defaultFlow()
			.serviceTask("escalate", {
				name: "Escalate to Management",
				taskType: "escalation-notifier",
			})
			.endEvent("endEscalated", { name: "Escalated" }),
	)

	.build()

const xml = Bpmn.export(definitions)
writeFileSync("output/02-incident-response.bpmn", xml)
console.log("✓ 02-incident-response.bpmn")

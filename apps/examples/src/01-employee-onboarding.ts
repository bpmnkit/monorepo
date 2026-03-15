/**
 * Example 01 — Employee Onboarding
 *
 * Demonstrates:
 * - Parallel gateway for concurrent tasks (IT and HR)
 * - User tasks with form IDs
 * - Business rule task for role-based equipment assignment
 * - Service task with IO mapping
 */

import { writeFileSync } from "node:fs"
import { Bpmn } from "@bpmnkit/core"

const definitions = Bpmn.createProcess("EmployeeOnboarding")
	.withAutoLayout()
	.name("Employee Onboarding")
	.versionTag("1.0.0")

	.startEvent("start", { name: "New Hire Confirmed" })

	// Determine equipment list from role via DMN decision table
	.businessRuleTask("determineEquipment", {
		name: "Determine Equipment",
		decisionRef: "equipment-by-role",
		resultVariable: "equipmentList",
	})

	// Kick off IT and HR tracks in parallel
	.parallelGateway("forkTracks", { name: "Start Parallel Tracks" })

	// Track A: IT — accounts and hardware
	.branch("it-setup", (b) =>
		b
			.serviceTask("provisionAccounts", {
				name: "Provision Accounts",
				taskType: "it-provisioning",
				ioMapping: {
					inputs: [{ source: "=employee.email", target: "email" }],
					outputs: [{ source: "=accountId", target: "itAccountId" }],
				},
			})
			.serviceTask("orderEquipment", {
				name: "Order Equipment",
				taskType: "procurement",
				ioMapping: {
					inputs: [{ source: "=equipmentList", target: "items" }],
				},
			})
			.connectTo("joinTracks"),
	)

	// Track B: HR — contracts and benefits
	.branch("hr-paperwork", (b) =>
		b
			.userTask("signContracts", {
				name: "Sign Employment Contracts",
				formId: "employment-contract-form",
			})
			.userTask("enrollBenefits", {
				name: "Enroll in Benefits",
				formId: "benefits-enrollment-form",
			})
			.connectTo("joinTracks"),
	)

	.parallelGateway("joinTracks", { name: "Tracks Complete" })

	// Welcome meeting and HR system update
	.userTask("welcomeMeeting", {
		name: "Conduct Welcome Meeting",
		formId: "welcome-meeting-form",
	})

	.serviceTask("notifyHR", {
		name: "Update HR System",
		taskType: "hr-system-update",
		ioMapping: {
			inputs: [
				{ source: "=employee.id", target: "employeeId" },
				{ source: '"onboarded"', target: "status" },
			],
		},
	})

	.endEvent("end", { name: "Onboarding Complete" })
	.build()

const xml = Bpmn.export(definitions)
writeFileSync("output/01-employee-onboarding.bpmn", xml)
console.log("✓ 01-employee-onboarding.bpmn")

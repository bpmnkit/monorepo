import type { CasenPlugin } from "@bpmnkit/cli-sdk"
import { incidentsCommand } from "./commands/incidents.js"
import { slaCommand } from "./commands/sla.js"

const plugin: CasenPlugin = {
	id: "com.bpmnkit.casen-report",
	name: "Report",
	version: "0.1.0",
	groups: [
		{
			name: "report",
			description: "Render HTML reports from incident and SLA data",
			commands: [incidentsCommand, slaCommand],
		},
	],
}

export default plugin

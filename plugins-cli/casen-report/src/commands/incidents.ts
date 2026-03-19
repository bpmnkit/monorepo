import { writeFileSync } from "node:fs"
import type { CamundaClient } from "@bpmnkit/api"
import type { Command, RunContext } from "@bpmnkit/cli-sdk"
import { badge, buildReport } from "../report.js"

interface IncidentItem {
	incidentKey: string
	processInstanceKey: string
	processDefinitionId?: string
	processDefinitionKey?: string
	type?: string
	state?: string
	message?: string
	creationTime?: string
}

function asIncident(raw: unknown): IncidentItem {
	return raw as IncidentItem
}

export const incidentsCommand: Command = {
	name: "incidents",
	description: "Generate an HTML report of current incidents",
	flags: [
		{
			name: "process-id",
			short: "p",
			description: "Filter by process definition ID",
			type: "string",
		},
		{
			name: "limit",
			short: "l",
			description: "Maximum number of incidents to fetch",
			type: "number",
			default: 200,
		},
		{
			name: "out",
			short: "o",
			description: "Write HTML report to this file path",
			type: "string",
			placeholder: "FILE",
		},
	],
	examples: [
		{ description: "Report all active incidents", command: "casen report incidents" },
		{
			description: "Report incidents for a specific process",
			command: "casen report incidents --process-id order-process",
		},
		{
			description: "Save HTML report to file",
			command: "casen report incidents --out incidents.html",
		},
	],
	async run(ctx: RunContext): Promise<void> {
		const client = (await ctx.getClient()) as CamundaClient
		const limit = Number(ctx.flags.limit ?? 200)
		const processId = ctx.flags["process-id"] as string | undefined
		const outFile = ctx.flags.out as string | undefined

		const filter: Record<string, unknown> = {}
		if (processId) filter.processDefinitionId = processId

		const result = await client.incident.searchIncidents({
			filter,
			page: { from: 0, limit },
		} as never)
		const raw = result as { items?: unknown[]; page?: { totalItems?: number } }
		const items = (raw.items ?? []).map(asIncident)
		const total = raw.page?.totalItems ?? items.length

		if (outFile) {
			const activeCount = items.filter((i) => i.state?.toUpperCase() !== "RESOLVED").length
			const resolvedCount = items.length - activeCount

			// Group by process definition
			const byProcess = new Map<string, number>()
			for (const item of items) {
				const key = item.processDefinitionId ?? "unknown"
				byProcess.set(key, (byProcess.get(key) ?? 0) + 1)
			}

			const html = buildReport({
				title: "Incident Report",
				subtitle: processId ? `Process: ${processId}` : "All processes",
				stats: [
					{ label: "Total incidents", value: total },
					{ label: "Active", value: activeCount, color: "#f87171" },
					{ label: "Resolved", value: resolvedCount, color: "#22c55e" },
					{ label: "Processes affected", value: byProcess.size },
				],
				columns: [
					{ header: "Incident Key", render: (r) => asIncident(r).incidentKey ?? "", isHtml: false },
					{
						header: "Process Instance",
						render: (r) => `<span class="key">${asIncident(r).processInstanceKey ?? ""}</span>`,
						isHtml: true,
					},
					{ header: "Process", render: (r) => asIncident(r).processDefinitionId ?? "" },
					{
						header: "State",
						render: (r) => {
							const state = asIncident(r).state ?? ""
							const cls = state.toUpperCase() === "RESOLVED" ? "resolved" : "active"
							return badge(state || "ACTIVE", cls)
						},
						isHtml: true,
					},
					{ header: "Type", render: (r) => asIncident(r).type ?? "" },
					{ header: "Message", render: (r) => (asIncident(r).message ?? "").slice(0, 120) },
					{
						header: "Created",
						render: (r) => {
							const ts = asIncident(r).creationTime
							return ts ? new Date(ts).toLocaleString() : ""
						},
					},
				],
				rows: items,
			})

			writeFileSync(outFile, html, "utf8")
			ctx.output.ok(`Report written to ${outFile} (${items.length} incidents)`)
		} else {
			ctx.output.printList({ items }, [
				{ key: "incidentKey", header: "INCIDENT KEY", maxWidth: 22 },
				{ key: "processInstanceKey", header: "PROCESS INSTANCE", maxWidth: 22 },
				{ key: "processDefinitionId", header: "PROCESS", maxWidth: 30 },
				{ key: "state", header: "STATE", maxWidth: 10 },
				{ key: "type", header: "TYPE", maxWidth: 28 },
				{ key: "message", header: "MESSAGE", maxWidth: 60 },
			])
			ctx.output.info(`Showing ${items.length} of ${total} incidents`)
		}
	},
}

import { writeFileSync } from "node:fs"
import type { CamundaClient } from "@bpmnkit/api"
import type { Command, RunContext } from "@bpmnkit/cli-sdk"
import { badge, buildReport } from "../report.js"

interface ProcessInstanceItem {
	processInstanceKey: string
	processDefinitionId?: string
	processDefinitionName?: string
	state?: string
	startDate?: string
	endDate?: string
	hasIncident?: boolean
}

function asInstance(raw: unknown): ProcessInstanceItem {
	return raw as ProcessInstanceItem
}

function durationMs(item: ProcessInstanceItem): number {
	if (!item.startDate) return 0
	const start = new Date(item.startDate).getTime()
	const end = item.endDate ? new Date(item.endDate).getTime() : Date.now()
	return end - start
}

function fmtDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	if (hours > 0) return `${hours}h ${minutes}m`
	if (minutes > 0) return `${minutes}m ${seconds}s`
	return `${seconds}s`
}

export const slaCommand: Command = {
	name: "sla",
	description: "Generate an SLA compliance report for process instances",
	flags: [
		{
			name: "threshold",
			short: "t",
			description: "SLA threshold in minutes",
			type: "number",
			required: true,
			placeholder: "MINUTES",
		},
		{
			name: "process-id",
			short: "p",
			description: "Filter by process definition ID",
			type: "string",
		},
		{
			name: "limit",
			short: "l",
			description: "Maximum number of instances to fetch",
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
		{
			description: "Check SLA with 30-minute threshold",
			command: "casen report sla --threshold 30",
		},
		{
			description: "SLA report for a specific process",
			command: "casen report sla --threshold 60 --process-id order-process",
		},
		{
			description: "Save SLA report to file",
			command: "casen report sla --threshold 30 --out sla.html",
		},
	],
	async run(ctx: RunContext): Promise<void> {
		const client = (await ctx.getClient()) as CamundaClient
		const thresholdMinutes = Number(ctx.flags.threshold)
		const limit = Number(ctx.flags.limit ?? 200)
		const processId = ctx.flags["process-id"] as string | undefined
		const outFile = ctx.flags.out as string | undefined

		if (!thresholdMinutes || thresholdMinutes <= 0) {
			throw new Error("--threshold must be a positive number of minutes")
		}

		const thresholdMs = thresholdMinutes * 60 * 1000

		const filter: Record<string, unknown> = {}
		if (processId) filter.processDefinitionId = processId

		const result = await client.processInstance.searchProcessInstances({
			filter,
			page: { from: 0, limit },
		} as never)
		const raw = result as { items?: unknown[]; page?: { totalItems?: number } }
		const items = (raw.items ?? []).map(asInstance)
		const total = raw.page?.totalItems ?? items.length

		type Row = ProcessInstanceItem & { durationMs: number; breached: boolean }

		const rows: Row[] = items.map((item) => {
			const ms = durationMs(item)
			return { ...item, durationMs: ms, breached: ms > thresholdMs }
		})

		const breachedCount = rows.filter((r) => r.breached).length
		const compliantCount = rows.length - breachedCount
		const complianceRate = rows.length > 0 ? Math.round((compliantCount / rows.length) * 100) : 100

		if (outFile) {
			const html = buildReport({
				title: "SLA Compliance Report",
				subtitle: processId
					? `Process: ${processId} — SLA: ${thresholdMinutes}m`
					: `All processes — SLA: ${thresholdMinutes}m`,
				stats: [
					{ label: "Total instances", value: total },
					{ label: "Compliant", value: compliantCount, color: "#22c55e" },
					{
						label: "Breached",
						value: breachedCount,
						color: breachedCount > 0 ? "#f59e0b" : "#22c55e",
					},
					{
						label: "Compliance rate",
						value: `${complianceRate}%`,
						color: complianceRate >= 90 ? "#22c55e" : complianceRate >= 70 ? "#f59e0b" : "#f87171",
					},
				],
				columns: [
					{
						header: "Process Instance",
						render: (r) => `<span class="key">${(r as Row).processInstanceKey ?? ""}</span>`,
						isHtml: true,
					},
					{ header: "Process", render: (r) => (r as Row).processDefinitionId ?? "" },
					{
						header: "State",
						render: (r) => {
							const state = (r as Row).state ?? ""
							const cls = state.toLowerCase()
							return badge(state || "UNKNOWN", cls)
						},
						isHtml: true,
					},
					{
						header: "Duration",
						render: (r) => fmtDuration((r as Row).durationMs),
					},
					{
						header: `SLA (${thresholdMinutes}m)`,
						render: (r) => {
							const row = r as Row
							return badge(row.breached ? "BREACHED" : "OK", row.breached ? "breached" : "ok")
						},
						isHtml: true,
					},
					{
						header: "Started",
						render: (r) => {
							const ts = (r as Row).startDate
							return ts ? new Date(ts).toLocaleString() : ""
						},
					},
					{
						header: "Ended",
						render: (r) => {
							const ts = (r as Row).endDate
							return ts ? new Date(ts).toLocaleString() : "—"
						},
					},
				],
				rows,
			})

			writeFileSync(outFile, html, "utf8")
			ctx.output.ok(
				`Report written to ${outFile} (${rows.length} instances, ${complianceRate}% compliant)`,
			)
		} else {
			ctx.output.printList({ items: rows }, [
				{ key: "processInstanceKey", header: "PROCESS INSTANCE", maxWidth: 22 },
				{ key: "processDefinitionId", header: "PROCESS", maxWidth: 30 },
				{ key: "state", header: "STATE", maxWidth: 12 },
				{
					key: "durationMs",
					header: "DURATION",
					maxWidth: 12,
					transform: (v) => fmtDuration(Number(v)),
				},
				{
					key: "breached",
					header: `SLA (${thresholdMinutes}m)`,
					maxWidth: 10,
					transform: (v) => (v ? "BREACHED" : "OK"),
				},
			])
			ctx.output.info(`Showing ${rows.length} of ${total} instances — ${complianceRate}% compliant`)
		}
	},
}

import { spawn } from "node:child_process"
import type { CamundaClient } from "@bpmnkit/api"
import type { ColumnDef, CommandGroup, Relation, RunContext } from "../types.js"

// ─── Spinner ──────────────────────────────────────────────────────────────────

class Spinner {
	private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
	private i = 0
	private timer: ReturnType<typeof setInterval> | null = null
	private msg = ""
	private isTTY = process.stderr.isTTY === true

	start(msg: string): void {
		this.msg = msg
		if (!this.isTTY) {
			process.stderr.write(`${msg}\n`)
			return
		}
		process.stderr.write(`${this.frames[0]} ${msg}`)
		this.timer = setInterval(() => {
			this.i++
			process.stderr.write(`\r${this.frames[this.i % this.frames.length]} ${this.msg}`)
		}, 80)
	}

	update(msg: string): void {
		this.msg = msg
		if (!this.isTTY) {
			process.stderr.write(`${msg}\n`)
			return
		}
		process.stderr.write(`\r${this.frames[this.i % this.frames.length]} ${msg}`)
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
		if (this.isTTY) {
			process.stderr.write("\r\x1b[K") // CR + erase to end of line
		}
	}
}

// ─── Compact AI adapter ───────────────────────────────────────────────────────

/** Try claude → copilot → gemini. Return the first available binary name. */
async function detectAi(): Promise<string | null> {
	for (const bin of ["claude", "copilot", "gemini"]) {
		const ok = await Promise.race([
			new Promise<boolean>((res) => {
				const p = spawn(bin, ["--version"], { stdio: "ignore" })
				p.on("error", () => res(false))
				p.on("close", (code) => res(code === 0))
			}),
			new Promise<boolean>((res) => setTimeout(() => res(false), 3000)),
		])
		if (ok) return bin
	}
	return null
}

/** Run an AI binary with the given prompt and collect the full text output. */
async function runAi(bin: string, prompt: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let args: string[]
		if (bin === "claude") {
			args = [
				"-p",
				prompt,
				"--output-format",
				"stream-json",
				"--verbose",
				"--dangerously-skip-permissions",
				"--permission-mode",
				"bypassPermissions",
			]
		} else if (bin === "copilot") {
			args = ["-p", prompt, "--yolo"]
		} else {
			args = ["--prompt", prompt, "--yolo"]
		}

		const env: Record<string, string | undefined> = { ...process.env, CLAUDECODE: undefined }
		const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env })

		// Drain stderr to prevent the pipe buffer from filling and stalling the child.
		proc.stderr?.resume()

		let out = ""
		let buf = ""

		if (bin === "claude") {
			proc.stdout?.on("data", (chunk: Buffer) => {
				buf += chunk.toString()
				const lines = buf.split("\n")
				buf = lines.pop() ?? ""
				for (const line of lines) {
					if (!line.trim()) continue
					try {
						const ev = JSON.parse(line) as {
							type: string
							message?: { content?: Array<{ type: string; text?: string }> }
						}
						if (ev.type === "assistant" && ev.message?.content) {
							for (const block of ev.message.content) {
								if (block.type === "text" && block.text) out += block.text
							}
						}
					} catch {
						/* skip non-JSON */
					}
				}
			})
		} else {
			proc.stdout?.on("data", (chunk: Buffer) => {
				out += chunk.toString()
			})
		}

		proc.on("error", reject)
		proc.on("close", (code) => {
			if (code === 0) resolve(out)
			else reject(new Error(`${bin} exited with code ${code}`))
		})
	})
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
	"Convert the user query into a Camunda 8 search spec. Output ONLY a valid JSON object — no prose, no markdown.",
	"",
	'Schema: { "resource": <resource>, "filter": { ... } }',
	"",
	"Resources and filter fields:",
	'  "processInstances": state("ACTIVE"|"COMPLETED"|"TERMINATED"), hasIncident(bool), processDefinitionId(str), processInstanceKey(str)',
	'  "incidents":        state("ACTIVE"|"RESOLVED"), type(str), processInstanceKey(str), processDefinitionKey(str)',
	'  "userTasks":        state("CREATED"|"COMPLETED"|"CANCELED"), processInstanceKey(str), assignee(str)',
	'  "variables":        name(str), value(str — JSON-serialized: 3355→"3355", true→"true", hello→"\\"hello\\""), processInstanceKey(str)',
	'  "jobs":             state("ACTIVATABLE"|"ACTIVE"|"FAILED"|"COMPLETED"|"CANCELED"|"ERROR_THROWN"), type(str), processInstanceKey(str)',
	'  "decisionInstances": decisionDefinitionId(str), state("EVALUATED"|"FAILED"), processInstanceKey(str)',
	"",
	'Use "variables" whenever a variable name or value is mentioned.',
	"Omit filter fields that are not relevant. Output ONLY the JSON object.",
].join("\n")

// ─── Spec executor ────────────────────────────────────────────────────────────

interface SearchSpec {
	resource: string
	filter: Record<string, unknown>
}

export interface AskResult {
	resource: string
	filter: Record<string, unknown>
	items: unknown[]
	total: number
	columns: ColumnDef[]
	/** Follow-up relations for TUI navigation, pre-computed per resource. */
	relations: Relation[]
}

async function fetchSpec(
	spec: SearchSpec,
	getClient: () => Promise<CamundaClient>,
): Promise<AskResult> {
	const client = await getClient()
	const filter = spec.filter
	const body = { filter } as never

	switch (spec.resource) {
		case "processInstances": {
			const result = await client.processInstance.searchProcessInstances(body)
			const items = (result as { items?: unknown[] }).items ?? []
			const total = (result as { page?: { totalItems?: number } }).page?.totalItems ?? items.length
			return {
				resource: spec.resource,
				filter,
				items,
				total,
				columns: [
					{ key: "processInstanceKey", header: "PROCESS INSTANCE KEY", maxWidth: 22 },
					{ key: "processDefinitionId", header: "PROCESS", maxWidth: 30 },
					{ key: "state", header: "STATE", maxWidth: 12 },
					{ key: "startDate", header: "STARTED", maxWidth: 20, transform: relTime },
					{ key: "hasIncident", header: "INCIDENT", maxWidth: 8 },
				],
				relations: [
					{
						groupName: "process-instance",
						commandName: "get",
						description: "View process instance",
						params: [{ field: "processInstanceKey", param: "processInstanceKey" }],
					},
				],
			}
		}
		case "incidents": {
			const result = await client.incident.searchIncidents(body)
			const items = (result as { items?: unknown[] }).items ?? []
			const total = (result as { page?: { totalItems?: number } }).page?.totalItems ?? items.length
			return {
				resource: spec.resource,
				filter,
				items,
				total,
				columns: [
					{ key: "incidentKey", header: "INCIDENT KEY", maxWidth: 22 },
					{ key: "processInstanceKey", header: "PROCESS INSTANCE KEY", maxWidth: 22 },
					{ key: "type", header: "TYPE", maxWidth: 28 },
					{ key: "state", header: "STATE", maxWidth: 10 },
					{ key: "message", header: "MESSAGE", maxWidth: 50 },
				],
				relations: [
					{
						groupName: "process-instance",
						commandName: "get",
						description: "View process instance",
						params: [{ field: "processInstanceKey", param: "processInstanceKey" }],
					},
				],
			}
		}
		case "userTasks": {
			const result = await client.userTask.searchUserTasks(body)
			const items = (result as { items?: unknown[] }).items ?? []
			const total = (result as { page?: { totalItems?: number } }).page?.totalItems ?? items.length
			return {
				resource: spec.resource,
				filter,
				items,
				total,
				columns: [
					{ key: "userTaskKey", header: "USER TASK KEY", maxWidth: 22 },
					{ key: "processInstanceKey", header: "PROCESS INSTANCE KEY", maxWidth: 22 },
					{ key: "elementId", header: "ELEMENT", maxWidth: 24 },
					{ key: "assignee", header: "ASSIGNEE", maxWidth: 20 },
					{ key: "state", header: "STATE", maxWidth: 12 },
				],
				relations: [
					{
						groupName: "user-task",
						commandName: "get",
						description: "View user task",
						params: [{ field: "userTaskKey", param: "userTaskKey" }],
					},
					{
						groupName: "process-instance",
						commandName: "get",
						description: "View process instance",
						params: [{ field: "processInstanceKey", param: "processInstanceKey" }],
					},
				],
			}
		}
		case "variables": {
			const result = await client.variable.searchVariables(body)
			const items = (result as { items?: unknown[] }).items ?? []
			const total = (result as { page?: { totalItems?: number } }).page?.totalItems ?? items.length
			return {
				resource: spec.resource,
				filter,
				items,
				total,
				columns: [
					{ key: "variableKey", header: "VARIABLE KEY", maxWidth: 22 },
					{ key: "processInstanceKey", header: "PROCESS INSTANCE KEY", maxWidth: 22 },
					{ key: "name", header: "NAME", maxWidth: 24 },
					{ key: "value", header: "VALUE", maxWidth: 50 },
				],
				relations: [
					{
						groupName: "variable",
						commandName: "get",
						description: "View variable",
						params: [{ field: "variableKey", param: "variableKey" }],
					},
					{
						groupName: "process-instance",
						commandName: "get",
						description: "View process instance",
						params: [{ field: "processInstanceKey", param: "processInstanceKey" }],
					},
				],
			}
		}
		case "jobs": {
			const result = await client.job.searchJobs(body)
			const items = (result as { items?: unknown[] }).items ?? []
			const total = (result as { page?: { totalItems?: number } }).page?.totalItems ?? items.length
			return {
				resource: spec.resource,
				filter,
				items,
				total,
				columns: [
					{ key: "jobKey", header: "JOB KEY", maxWidth: 22 },
					{ key: "processInstanceKey", header: "PROCESS INSTANCE KEY", maxWidth: 22 },
					{ key: "type", header: "TYPE", maxWidth: 28 },
					{ key: "state", header: "STATE", maxWidth: 12 },
					{ key: "retries", header: "RETRIES", maxWidth: 8 },
				],
				relations: [
					{
						groupName: "process-instance",
						commandName: "get",
						description: "View process instance",
						params: [{ field: "processInstanceKey", param: "processInstanceKey" }],
					},
				],
			}
		}
		case "decisionInstances": {
			const result = await client.decisionInstance.searchDecisionInstances(body)
			const items = (result as { items?: unknown[] }).items ?? []
			const total = (result as { page?: { totalItems?: number } }).page?.totalItems ?? items.length
			return {
				resource: spec.resource,
				filter,
				items,
				total,
				columns: [
					{ key: "decisionInstanceKey", header: "DECISION INSTANCE KEY", maxWidth: 22 },
					{ key: "processInstanceKey", header: "PROCESS INSTANCE KEY", maxWidth: 22 },
					{ key: "decisionDefinitionId", header: "DECISION", maxWidth: 30 },
					{ key: "state", header: "STATE", maxWidth: 12 },
				],
				relations: [
					{
						groupName: "process-instance",
						commandName: "get",
						description: "View process instance",
						params: [{ field: "processInstanceKey", param: "processInstanceKey" }],
					},
				],
			}
		}
		default:
			throw new Error(`Unknown resource: "${spec.resource}"`)
	}
}

function relTime(value: unknown): string {
	if (typeof value !== "string" || !value) return "—"
	const d = new Date(value)
	const diff = Date.now() - d.getTime()
	const m = Math.floor(diff / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ${m % 60}m ago`
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

// ─── Quick-parse bypass (no AI needed) ───────────────────────────────────────

function quickParse(query: string): SearchSpec | null {
	const q = query.trim().toLowerCase()

	// Pure numeric → process instance key lookup
	if (/^\d+$/.test(query.trim())) {
		return { resource: "processInstances", filter: { processInstanceKey: query.trim() } }
	}

	// Single state keyword
	const stateMap: Record<string, SearchSpec> = {
		active: { resource: "processInstances", filter: { state: "ACTIVE" } },
		completed: { resource: "processInstances", filter: { state: "COMPLETED" } },
		terminated: { resource: "processInstances", filter: { state: "TERMINATED" } },
		incidents: { resource: "incidents", filter: {} },
	}
	if (q in stateMap) return stateMap[q] ?? null

	return null
}

// ─── Exported query runner ────────────────────────────────────────────────────

export async function runAskQuery(
	query: string,
	getClient: () => Promise<CamundaClient>,
	onStatus: (msg: string) => void,
): Promise<AskResult> {
	// Try quick-parse first (no AI token cost)
	const quick = quickParse(query)
	if (quick) {
		return fetchSpec(quick, getClient)
	}

	// Detect AI binary
	onStatus("Detecting AI…")
	const bin = await detectAi()
	if (!bin) {
		throw new Error("No AI CLI found. Install claude, copilot, or gemini and ensure it is in PATH.")
	}

	// Ask AI to translate query → search spec
	onStatus(`Asking ${bin}…`)
	const fullPrompt = `${SYSTEM_PROMPT}\n\nQuery: ${query}\n\nJSON:`
	const raw = await runAi(bin, fullPrompt)

	// Extract JSON from the response (strip any prose/markdown fences)
	const jsonMatch = raw.match(/\{[\s\S]*\}/)
	if (!jsonMatch) {
		throw new Error(`AI returned no JSON.\n\nRaw output:\n${raw}`)
	}

	let spec: SearchSpec
	try {
		spec = JSON.parse(jsonMatch[0]) as SearchSpec
	} catch {
		throw new Error(`AI returned invalid JSON.\n\nRaw output:\n${raw}`)
	}

	// Execute the spec against the API
	onStatus(`Searching ${spec.resource}…`)
	return fetchSpec(spec, getClient)
}

// ─── Command group ────────────────────────────────────────────────────────────

export const askGroup: CommandGroup = {
	name: "ask",
	description: "Natural language search using a local AI (claude/copilot/gemini)",
	commands: [
		{
			name: "query",
			description: "Ask in plain language; the AI translates it to a Camunda API search",
			args: [{ name: "query", description: "Natural language query", required: true }],
			async run(ctx: RunContext): Promise<void> {
				const query = ctx.positional.join(" ").trim()
				if (!query) throw new Error("Provide a query, e.g.: casen ask active incidents")

				const spinner = new Spinner()
				try {
					spinner.start("Detecting AI…")
					const result = await runAskQuery(query, ctx.getClient, (msg) => spinner.update(msg))
					spinner.stop()
					ctx.output.info(`${result.resource} ${JSON.stringify(result.filter)}`)
					ctx.output.printList(
						{ items: result.items, page: { totalItems: result.total } } as never,
						result.columns,
					)
				} catch (err) {
					spinner.stop()
					throw err
				}
			},
		},
	],
}

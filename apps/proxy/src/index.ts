#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import http from "node:http"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Bpmn, expand, optimize } from "@bpmnkit/core"
import type { CompactDiagram } from "@bpmnkit/core"
import { createClientFromProfile } from "@bpmnkit/profiles"
import {
	getActiveName,
	getActiveProfile,
	getAuthHeader,
	getProfile,
	listProfiles,
} from "@bpmnkit/profiles"
import * as claude from "./adapters/claude.js"
import * as copilot from "./adapters/copilot.js"
import * as gemini from "./adapters/gemini.js"
import type { FindingInfo } from "./prompt.js"
import {
	buildIncidentSystemPrompt,
	buildIncidentUserMessage,
	buildMcpExplainPrompt,
	buildMcpImprovePrompt,
	buildMcpSystemPrompt,
	buildSystemPrompt,
} from "./prompt.js"

const PORT = process.env.AI_SERVER_PORT ? Number(process.env.AI_SERVER_PORT) : 3033

// Resolve the compiled mcp-server entry point relative to this file.
// When bundled as bundle.cjs, import.meta.url ends with .cjs → use mcp-server.cjs.
// When compiled by tsc to dist/index.js → use mcp-server.js.
const __file = fileURLToPath(import.meta.url)
const mcpServerFile = __file.endsWith(".cjs") ? "mcp-server.cjs" : "mcp-server.js"
const MCP_SERVER_PATH = join(dirname(__file), mcpServerFile)

interface Adapter {
	supportsMcp: boolean
	available(): Promise<boolean>
	stream(
		messages: Array<{ role: string; content: string }>,
		systemPrompt: string,
		mcpConfigFile: string | null,
		onToken: (text: string) => void,
	): Promise<void>
}
type AdapterEntry = { adapter: Adapter; name: string }

async function detectAll(): Promise<AdapterEntry[]> {
	const results = await Promise.all([
		claude
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: claude, name: "claude" } : null)),
		copilot
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: copilot, name: "copilot" } : null)),
		gemini
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: gemini, name: "gemini" } : null)),
	])
	return results.filter((r): r is AdapterEntry => r !== null)
}

async function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on("data", (chunk: Buffer) => chunks.push(chunk))
		req.on("end", () => resolve(Buffer.concat(chunks).toString()))
		req.on("error", reject)
	})
}

/**
 * Extract a CompactDiagram from LLM text output (fallback for non-MCP adapters).
 * Looks for the first ```json block containing a "processes" array.
 */
function extractCompactDiagram(text: string): CompactDiagram | null {
	const match = /```json\s*\n([\s\S]*?)\n```/.exec(text)
	if (!match?.[1]) return null
	try {
		const parsed = JSON.parse(match[1]) as unknown
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"processes" in parsed &&
			Array.isArray((parsed as Record<string, unknown>).processes)
		) {
			return parsed as CompactDiagram
		}
	} catch {
		/* invalid JSON */
	}
	return null
}

const server = http.createServer(async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Profile")

	if (req.method === "OPTIONS") {
		res.writeHead(204)
		res.end()
		return
	}

	const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)

	console.log(`[server] ${req.method} ${url.pathname}`)

	if (url.pathname === "/status" && req.method === "GET") {
		const available = await detectAll()
		const names = available.map((a) => a.name)
		console.log(`[server] /status → available: [${names.join(", ")}]`)
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(
			JSON.stringify({ ready: available.length > 0, backend: names[0] ?? null, available: names }),
		)
		return
	}

	if (url.pathname === "/chat" && req.method === "POST") {
		const body = await readBody(req)
		let messages: Array<{ role: string; content: string }>
		let context: unknown
		let backend: string | null
		let action: string | null
		try {
			const parsed = JSON.parse(body) as {
				messages: typeof messages
				context?: unknown
				backend?: string | null
				action?: string | null
			}
			messages = parsed.messages
			context = parsed.context ?? null
			backend = parsed.backend ?? null
			action = parsed.action ?? null
		} catch {
			res.writeHead(400)
			res.end("Bad Request")
			return
		}

		const available = await detectAll()
		const detected = backend
			? (available.find((a) => a.name === backend) ?? available[0])
			: available[0]
		if (!detected) {
			console.log("[server] /chat → no adapter available")
			res.writeHead(503)
			res.end("No AI CLI available. Install claude, copilot, or gemini.")
			return
		}
		console.log(
			`[server] /chat → adapter: ${detected.name}, action: ${action ?? "chat"}, mcp: ${detected.adapter.supportsMcp}`,
		)

		const currentCompact: CompactDiagram | null =
			context !== null && typeof context === "object" && "processes" in context
				? (context as CompactDiagram)
				: null

		// ── Apply auto-fixes, then collect remaining findings for improve ─────────
		const findings: FindingInfo[] = []
		// fixedDefs holds the auto-fixed diagram; used as input for the AI
		const fixedDefs = currentCompact ? expand(currentCompact) : null
		if (currentCompact && fixedDefs) {
			try {
				const report = optimize(fixedDefs)
				const order: Record<string, number> = { error: 0, warning: 1, info: 2 }
				const fixable = report.findings
					.filter((f) => f.applyFix)
					.sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2))
				for (const f of fixable) {
					f.applyFix?.(fixedDefs)
				}
				if (fixable.length > 0) {
					console.log(`[server] auto-applied ${fixable.length} fix(es) from core optimize()`)
				}
				if (action === "improve") {
					const remaining = optimize(fixedDefs)
					for (const f of remaining.findings) {
						findings.push({
							category: f.category,
							severity: f.severity,
							message: f.message,
							suggestion: f.suggestion,
							elementIds: f.elementIds,
						})
					}
					console.log(`[server] improve → ${findings.length} remaining findings after auto-fix`)
				}
			} catch (err) {
				console.error("[server] auto-fix failed:", String(err))
			}
		}

		// ── Build system prompt ───────────────────────────────────────────────────
		let systemPrompt: string
		if (detected.adapter.supportsMcp) {
			systemPrompt =
				action === "improve"
					? buildMcpImprovePrompt(findings)
					: action === "explain"
						? buildMcpExplainPrompt()
						: buildMcpSystemPrompt()
		} else {
			// Fallback for non-MCP adapters: full prompt with format instructions
			systemPrompt = buildSystemPrompt(context)
		}

		// ── Set up MCP temp files (MCP-capable adapters only) ────────────────────
		let tmpDir: string | null = null
		let mcpConfigFile: string | null = null
		let outputFile: string | null = null

		if (detected.adapter.supportsMcp) {
			tmpDir = mkdtempSync(join(tmpdir(), "bpmnkit-mcp-"))
			const inputFile = join(tmpDir, "input.json")
			outputFile = join(tmpDir, "output.json")
			mcpConfigFile = join(tmpDir, "mcp.json")

			// Write input as BPMN XML (mcp-server reads XML, not CompactDiagram JSON)
			// Use fixedDefs if available (auto-fixes already applied); fall back to raw expand
			if (fixedDefs) writeFileSync(inputFile, Bpmn.export(fixedDefs))
			else if (currentCompact) writeFileSync(inputFile, Bpmn.export(expand(currentCompact)))

			const mcpConfig = {
				mcpServers: {
					bpmn: {
						type: "stdio",
						command: "node",
						args: [
							MCP_SERVER_PATH,
							...(currentCompact ? ["--input", inputFile] : []),
							"--output",
							outputFile,
						],
					},
				},
			}
			writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig))
		}

		// ── Stream ────────────────────────────────────────────────────────────────
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})

		const accumulated: string[] = []
		try {
			await detected.adapter.stream(messages, systemPrompt, mcpConfigFile, (token) => {
				accumulated.push(token)
				res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`)
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			console.error(`[server] adapter error: ${msg}`)
			res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`)
		}

		// ── Post-process: get final diagram and emit XML ──────────────────────────
		if (outputFile) {
			// MCP path: mcp-server writes BPMN XML directly — read and emit as-is
			try {
				const xml = readFileSync(outputFile, "utf8")
				res.write(`data: ${JSON.stringify({ type: "xml", xml })}\n\n`)
				console.log("[server] MCP XML output read successfully")
			} catch {
				console.log("[server] MCP output file not written (no diagram changes)")
			}
		} else {
			// Fallback path: extract CompactDiagram from LLM text response
			const finalCompact = extractCompactDiagram(accumulated.join(""))
			if (finalCompact) {
				try {
					const xml = Bpmn.export(expand(finalCompact))
					res.write(`data: ${JSON.stringify({ type: "xml", xml })}\n\n`)
					console.log("[server] XML emitted via core expand + export")
				} catch (err) {
					console.error("[server] failed to expand result:", String(err))
				}
			}
		}

		// ── Clean up temp files ───────────────────────────────────────────────────
		if (tmpDir) {
			try {
				rmSync(tmpDir, { recursive: true })
			} catch {
				/* best-effort cleanup */
			}
		}

		res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
		res.end()
		return
	}

	// ── GET /profiles ─────────────────────────────────────────────────────────
	if (url.pathname === "/profiles" && req.method === "GET") {
		const profiles = listProfiles()
		const activeName = getActiveName()
		const payload = profiles.map((p) => ({
			name: p.name,
			active: p.name === activeName,
			apiType: p.apiType,
			baseUrl: p.config.baseUrl ?? null,
			authType: p.config.auth?.type ?? "none",
		}))
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(payload))
		return
	}

	// ── GET /operate/stream — polling stream for monitoring data ─────────────
	// Supports both SSE (Accept: text/event-stream) and one-shot JSON polling.
	// The operate UI uses one-shot JSON polling to avoid holding HTTP connections.
	if (url.pathname === "/operate/stream" && req.method === "GET") {
		const topicParam = url.searchParams.get("topic") ?? "dashboard"
		const profileParam =
			(req.headers["x-profile"] as string | undefined) ??
			url.searchParams.get("profile") ??
			undefined
		const intervalMs = Math.max(5_000, Number(url.searchParams.get("interval") ?? "30000"))

		const activeProfile = profileParam ? getProfile(profileParam) : getActiveProfile()
		if (!activeProfile?.config.baseUrl) {
			res.writeHead(401, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "No active profile" }))
			return
		}

		const client = createClientFromProfile(profileParam)

		// The generated TS types only declare `page` on search results; the runtime
		// response also contains `items`. Cast results through SearchResult<T>.
		type SearchResult<T> = { page: { totalItems: number }; items: T[] }
		function items<T>(result: unknown): T[] {
			return ((result as SearchResult<T>).items ?? []) as T[]
		}
		function total(result: unknown): number {
			return (result as SearchResult<unknown>).page?.totalItems ?? 0
		}

		// The query types also don't declare `filter` in TS, but the API accepts it.
		type AnyQuery = Record<string, unknown>

		// Fetch the payload for a given topic once, returning plain data.
		async function fetchPayload(): Promise<unknown> {
			switch (topicParam) {
				case "dashboard": {
					const [inst, inc, jobs, tasks, defs, usage] = await Promise.all([
						client.processInstance.searchProcessInstances({
							filter: { state: "ACTIVE" },
						} as AnyQuery),
						client.incident.searchIncidents({ filter: { state: "ACTIVE" } } as AnyQuery),
						client.job.searchJobs({ filter: { state: "CREATED" } } as AnyQuery),
						client.userTask.searchUserTasks({ filter: { state: "CREATED" } } as AnyQuery),
						client.processDefinition.searchProcessDefinitions({}),
						client.system.getUsageMetrics().catch(() => null),
					])
					return {
						activeInstances: inst.page.totalItems,
						openIncidents: inc.page.totalItems,
						activeJobs: jobs.page.totalItems,
						pendingTasks: tasks.page.totalItems,
						definitions: defs.page.totalItems,
						usageTotalProcessInstances: usage?.processInstances,
						usageDecisionInstances: usage?.decisionInstances,
						usageAssignees: usage?.assignees,
					}
				}
				case "definitions": {
					const result = await client.processDefinition.searchProcessDefinitions({
						page: { limit: 1000 },
						sort: [{ field: "version", order: "DESC" }],
					} as AnyQuery)
					return { items: items(result) }
				}
				case "instances": {
					const stateFilter = url.searchParams.get("state")
					const pdKey = url.searchParams.get("processDefinitionKey")
					const filter: AnyQuery = {}
					if (stateFilter) filter.state = stateFilter
					if (pdKey) filter.processDefinitionKey = pdKey
					const result = await client.processInstance.searchProcessInstances({
						filter,
						page: { limit: 1000 },
						sort: [{ field: "startDate", order: "DESC" }],
					} as AnyQuery)
					return { items: items(result), total: total(result) }
				}
				case "incidents": {
					const piKey = url.searchParams.get("processInstanceKey")
					const filter: AnyQuery = {}
					if (piKey) filter.processInstanceKey = piKey
					const result = await client.incident.searchIncidents({
						filter,
						page: { limit: 1000 },
						sort: [{ field: "creationTime", order: "DESC" }],
					} as AnyQuery)
					return { items: items(result), total: total(result) }
				}
				case "jobs": {
					const result = await client.job.searchJobs({
						page: { limit: 1000 },
						sort: [{ field: "jobKey", order: "DESC" }],
					} as AnyQuery)
					return { items: items(result), total: total(result) }
				}
				case "tasks": {
					const result = await client.userTask.searchUserTasks({
						page: { limit: 1000 },
						sort: [{ field: "creationDate", order: "DESC" }],
					} as AnyQuery)
					return { items: items(result), total: total(result) }
				}
				case "decisions": {
					const result = await client.decisionDefinition.searchDecisionDefinitions({
						page: { limit: 1000 },
						sort: [{ field: "version", order: "DESC" }],
					} as AnyQuery)
					return { items: items(result) }
				}
				default:
					throw new Error(`Unknown topic: ${topicParam}`)
			}
		}

		// One-shot JSON polling mode (used by the operate UI via fetch()).
		// EventSource sends Accept: text/event-stream; plain fetch does not.
		const wantsSSE =
			(req.headers.accept as string | undefined)?.includes("text/event-stream") ?? false
		if (!wantsSSE) {
			try {
				const payload = await fetchPayload()
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify(payload))
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
			}
			return
		}

		// SSE streaming mode (legacy / external clients).
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})

		async function poll(): Promise<void> {
			try {
				const payload = await fetchPayload()
				res.write(`data: ${JSON.stringify({ type: "data", topic: topicParam, payload })}\n\n`)
			} catch (err) {
				res.write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`)
			}
		}

		await poll()
		const timer = setInterval(() => {
			void poll()
		}, intervalMs)
		const keepalive = setInterval(() => {
			res.write(`data: ${JSON.stringify({ type: "keepalive" })}\n\n`)
		}, 25_000)

		req.on("close", () => {
			clearInterval(timer)
			clearInterval(keepalive)
			console.log(`[operate/stream] client disconnected (topic: ${topicParam})`)
		})

		console.log(`[operate/stream] connected (topic: ${topicParam}, interval: ${intervalMs}ms)`)
		return
	}

	// ── POST /operate/incident-assist ─────────────────────────────────────────
	if (url.pathname === "/operate/incident-assist" && req.method === "POST") {
		const body = await readBody(req)
		let incidentKey: string
		try {
			incidentKey = (JSON.parse(body) as { incidentKey: string }).incidentKey
		} catch {
			res.writeHead(400)
			res.end("Bad Request")
			return
		}

		const profileName = req.headers["x-profile"] as string | undefined
		const profile = profileName ? getProfile(profileName) : getActiveProfile()
		if (!profile?.config.baseUrl) {
			res.writeHead(401, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "No active profile" }))
			return
		}

		const available = await detectAll()
		const detected = available[0]
		if (!detected) {
			res.writeHead(503)
			res.end("No AI adapter available")
			return
		}

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})

		let authHeader: string
		try {
			authHeader = await getAuthHeader(profile.config)
		} catch (err) {
			res.write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`)
			res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
			res.end()
			return
		}

		const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
		const apiHeaders: Record<string, string> = {
			authorization: authHeader,
			"content-type": "application/json",
			accept: "application/json",
		}

		// Fetch incident
		type RawIncident = {
			errorType?: string
			errorMessage?: string
			elementId?: string
			processDefinitionId?: string
			processDefinitionKey?: string
			processInstanceKey?: string
			state?: string
			creationTime?: string
			jobKey?: string
			incidentKey?: string
		}
		let incident: RawIncident | null = null
		try {
			const r = await fetch(`${baseUrl}/incidents/${incidentKey}`, { headers: apiHeaders })
			if (r.ok) incident = (await r.json()) as RawIncident
		} catch {
			/* ignore */
		}

		if (!incident) {
			res.write(
				`data: ${JSON.stringify({ type: "error", message: "Could not fetch incident" })}\n\n`,
			)
			res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
			res.end()
			return
		}

		// Fetch process XML
		let processXml: string | null = null
		if (incident.processDefinitionKey) {
			try {
				const r = await fetch(
					`${baseUrl}/process-definitions/${incident.processDefinitionKey}/xml`,
					{ headers: { ...apiHeaders, accept: "text/xml" } },
				)
				if (r.ok) processXml = await r.text()
			} catch {
				/* ignore */
			}
		}

		// Fetch variables
		type RawVar = { name: string; value?: string }
		let variables: RawVar[] = []
		if (incident.processInstanceKey) {
			try {
				const r = await fetch(`${baseUrl}/variables/search`, {
					method: "POST",
					headers: apiHeaders,
					body: JSON.stringify({ filter: { processInstanceKey: incident.processInstanceKey } }),
				})
				if (r.ok) {
					const result = (await r.json()) as { items?: RawVar[] }
					variables = result.items ?? []
				}
			} catch {
				/* ignore */
			}
		}

		const systemPrompt = buildIncidentSystemPrompt()
		const userMessage = buildIncidentUserMessage(
			{
				errorType: incident.errorType ?? "UNKNOWN",
				errorMessage: incident.errorMessage ?? "",
				elementId: incident.elementId ?? "",
				processDefinitionId: incident.processDefinitionId ?? "",
				processInstanceKey: incident.processInstanceKey ?? "",
				state: incident.state ?? "",
				creationTime: incident.creationTime,
				jobKey: incident.jobKey,
			},
			variables,
			processXml,
		)

		console.log(
			`[server] /operate/incident-assist → adapter: ${detected.name}, incident: ${incidentKey}`,
		)

		try {
			await detected.adapter.stream(
				[{ role: "user", content: userMessage }],
				systemPrompt,
				null,
				(token) => {
					res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`)
				},
			)
		} catch (err) {
			res.write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`)
		}

		res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
		res.end()
		return
	}

	// ── ALL /api/* — transparent Camunda API proxy ─────────────────────────────
	if (url.pathname.startsWith("/api/")) {
		const profileName = req.headers["x-profile"] as string | undefined
		const profile = profileName ? getProfile(profileName) : getActiveProfile()
		if (!profile || !profile.config.baseUrl) {
			res.writeHead(401, { "Content-Type": "application/json" })
			res.end(
				JSON.stringify({
					error: "No active profile. Create one with: casen profile create",
				}),
			)
			return
		}

		let authHeader: string
		try {
			authHeader = await getAuthHeader(profile.config)
		} catch (err) {
			console.error(`[proxy] auth error: ${String(err)}`)
			res.writeHead(502, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: `Auth failed: ${String(err)}` }))
			return
		}

		const targetPath = url.pathname.slice("/api".length) + url.search
		const targetUrl = profile.config.baseUrl.replace(/\/$/, "") + targetPath
		console.log(`[proxy] ${req.method} ${url.pathname} → ${targetUrl}`)

		const upstreamHeaders: Record<string, string> = {
			"content-type": (req.headers["content-type"] as string) ?? "application/json",
			accept: (req.headers.accept as string) ?? "application/json",
		}
		if (authHeader) upstreamHeaders.authorization = authHeader

		const hasBody = req.method !== "GET" && req.method !== "HEAD"
		const body = hasBody ? await readBody(req) : undefined

		let upstream: Response
		try {
			upstream = await fetch(targetUrl, {
				method: req.method,
				headers: upstreamHeaders,
				body,
			})
		} catch (err) {
			console.error(`[proxy] upstream error: ${String(err)}`)
			res.writeHead(502, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: `Upstream unreachable: ${String(err)}` }))
			return
		}

		const contentType = upstream.headers.get("content-type") ?? "application/json"
		res.writeHead(upstream.status, { "Content-Type": contentType })
		res.end(await upstream.text())
		return
	}

	res.writeHead(404)
	res.end("Not Found")
})

server.listen(PORT, () => {
	console.log(`BPMN Kit AI Server running at http://localhost:${PORT}`)
	console.log("Press Ctrl+C to stop")
})

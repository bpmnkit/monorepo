#!/usr/bin/env node
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import http from "node:http"
import { homedir, tmpdir } from "node:os"
import { basename, dirname, extname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { Bpmn, applyBpmnOperations, compactify, expand, optimize } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnOperation, CompactDiagram } from "@bpmnkit/core"
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
import type { FindingInfo, ImproveContext } from "./prompt.js"
import {
	buildDmnCreateSystemPrompt,
	buildFormCreateSystemPrompt,
	buildImproveSystemPrompt,
	buildImproveUserMessage,
	buildIncidentSystemPrompt,
	buildIncidentUserMessage,
	buildMcpExplainPrompt,
	buildMcpImprovePrompt,
	buildMcpSystemPrompt,
	buildOperateChatSystemPrompt,
	buildSearchSystemPrompt,
	buildSystemPrompt,
} from "./prompt.js"
import {
	handleDeleteRunHistory,
	handleGetRunHistory,
	handleGetRunHistoryDetail,
	handleRerunHistory,
	matchRerunHistoryRoute,
	matchRunHistoryRoute,
} from "./routes/run-history.js"
import { handleWebhook, matchWebhookRoute, startTriggers } from "./triggers/index.js"
import { WORKER_TEMPLATES } from "./worker-templates.js"
import { startWorkerDaemon, workerState } from "./worker.js"

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

/**
 * Extract a BpmnOperation[] from LLM text output.
 * Looks for the first ```json block containing a JSON array.
 */
function extractOperations(text: string): BpmnOperation[] | null {
	const match = /```json\s*\n([\s\S]*?)\n```/.exec(text)
	if (!match?.[1]) return null
	try {
		const parsed = JSON.parse(match[1]) as unknown
		if (Array.isArray(parsed)) return parsed as BpmnOperation[]
	} catch {
		/* invalid JSON */
	}
	return null
}

// ── File System helpers ───────────────────────────────────────────────────────

const SUPPORTED_EXTS = new Set([".bpmn", ".dmn", ".form", ".md"])

type FsFileType = "bpmn" | "dmn" | "form" | "md"

interface FileMeta {
	id: string
	processDefinitionId?: string
	runVariables?: string
	tags?: string[]
	createdAt: number
	scenarios?: unknown[]
	inputVars?: Array<{ name: string; value: string }>
}

interface FsFileInfo {
	relativePath: string
	name: string
	absPath: string
	fileType: FsFileType
	content: string
	meta: FileMeta | null
}

interface FsTreeNode {
	name: string
	relativePath: string
	type: "dir" | "file"
	fileType?: FsFileType
	children?: FsTreeNode[]
}

/** Expand a leading `~` to the user's home directory. */
function expandHome(p: string): string {
	if (p === "~" || p.startsWith("~/")) return homedir() + p.slice(1)
	return p
}

/** Reject any path that escapes the root via `..` or is outside it. */
function fsValidate(root: string, target: string): boolean {
	const normRoot = root.endsWith(sep) ? root : root + sep
	const normTarget =
		target + (statSync(target, { throwIfNoEntry: false })?.isDirectory() ? sep : "")
	return (
		!target.includes("..") &&
		(target === root || target.startsWith(normRoot) || normTarget.startsWith(normRoot))
	)
}

function sidecarPath(filePath: string): string {
	return join(dirname(filePath), ".bpmnkit", `${basename(filePath)}.meta.json`)
}

function readMeta(filePath: string): FileMeta | null {
	const sp = sidecarPath(filePath)
	try {
		if (!existsSync(sp)) return null
		return JSON.parse(readFileSync(sp, "utf8")) as FileMeta
	} catch {
		return null
	}
}

function writeMeta(filePath: string, meta: FileMeta): void {
	const sp = sidecarPath(filePath)
	const dir = dirname(sp)
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
	writeFileSync(sp, JSON.stringify(meta, null, 2), "utf8")
}

function buildTree(root: string, dir: string): FsTreeNode[] {
	let entries: import("node:fs").Dirent[]
	try {
		entries = readdirSync(dir, { withFileTypes: true, encoding: "utf8" })
	} catch {
		return []
	}
	const result: FsTreeNode[] = []
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue
		const abs = join(dir, entry.name)
		const rel = relative(root, abs)
		if (entry.isDirectory()) {
			result.push({
				name: entry.name,
				relativePath: rel,
				type: "dir",
				children: buildTree(root, abs),
			})
		} else if (entry.isFile()) {
			const ext = extname(entry.name).toLowerCase()
			if (!SUPPORTED_EXTS.has(ext)) continue
			const fileType = ext.slice(1) as FsFileType
			result.push({ name: entry.name, relativePath: rel, type: "file", fileType })
		}
	}
	return result
}

function collectFiles(root: string, dir: string): FsFileInfo[] {
	const results: FsFileInfo[] = []
	let entries: import("node:fs").Dirent[]
	try {
		entries = readdirSync(dir, { withFileTypes: true, encoding: "utf8" })
	} catch {
		return results
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue
		const abs = join(dir, entry.name)
		if (entry.isDirectory()) {
			results.push(...collectFiles(root, abs))
		} else if (entry.isFile()) {
			const ext = extname(entry.name).toLowerCase()
			if (!SUPPORTED_EXTS.has(ext)) continue
			const rel = relative(root, abs)
			const fileType = ext.slice(1) as FsFileType
			let content = ""
			try {
				content = readFileSync(abs, "utf8")
			} catch {
				/* skip unreadable files */
			}
			const meta = readMeta(abs)
			const nameNoExt = basename(entry.name, extname(entry.name))
			results.push({ relativePath: rel, name: nameNoExt, absPath: abs, fileType, content, meta })
		}
	}
	return results
}

// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
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
			JSON.stringify({
				ready: available.length > 0,
				backend: names[0] ?? null,
				available: names,
				workers: {
					active: workerState.active,
					jobTypes: workerState.jobTypes,
					pollCount: workerState.pollCount,
					lastError: workerState.lastError,
				},
			}),
		)
		return
	}

	// ── GET /worker-templates — built-in element templates for Studio ────────
	if (url.pathname === "/worker-templates" && req.method === "GET") {
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(WORKER_TEMPLATES))
		return
	}

	// ── Run history routes ────────────────────────────────────────────────────
	if (url.pathname === "/run-history" && req.method === "GET") {
		handleGetRunHistory(req, res)
		return
	}
	if (url.pathname === "/run-history" && req.method === "DELETE") {
		handleDeleteRunHistory(req, res)
		return
	}
	const rerunMatch = matchRerunHistoryRoute(req)
	if (rerunMatch) {
		await handleRerunHistory(req, res, rerunMatch.id)
		return
	}
	const runHistoryMatch = matchRunHistoryRoute(req)
	if (runHistoryMatch && req.method === "GET") {
		handleGetRunHistoryDetail(req, res, runHistoryMatch.id)
		return
	}

	// ── POST /webhooks/:processId — webhook trigger ───────────────────────────
	const webhookMatch = matchWebhookRoute(req)
	if (webhookMatch) {
		await handleWebhook(req, res, webhookMatch.processId)
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

		// ── create-form ───────────────────────────────────────────────────────────
		if (action === "create-form") {
			const taskDescription = messages[0]?.content ?? ""
			const systemPrompt = buildFormCreateSystemPrompt("", taskDescription)
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			})
			const accumulated: string[] = []
			try {
				await detected.adapter.stream(messages, systemPrompt, null, (token) => {
					accumulated.push(token)
					res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`)
				})
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				console.error(`[server] create-form adapter error: ${msg}`)
				res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`)
				res.end()
				return
			}
			const fullText = accumulated.join("")
			const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/)
			if (jsonMatch) {
				// biome-ignore lint/style/noNonNullAssertion: capture group 1 always present when match succeeds
				const jsonString = jsonMatch[1]!.trim()
				res.write(`data: ${JSON.stringify({ type: "json", json: jsonString })}\n\n`)
			} else {
				res.write(
					`data: ${JSON.stringify({ type: "error", message: "AI did not produce a form JSON" })}\n\n`,
				)
			}
			res.end()
			return
		}

		// ── create-dmn ────────────────────────────────────────────────────────────
		if (action === "create-dmn") {
			const taskDescription = messages[0]?.content ?? ""
			const systemPrompt = buildDmnCreateSystemPrompt("", taskDescription)
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			})
			const accumulated: string[] = []
			try {
				await detected.adapter.stream(messages, systemPrompt, null, (token) => {
					accumulated.push(token)
					res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`)
				})
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				console.error(`[server] create-dmn adapter error: ${msg}`)
				res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`)
				res.end()
				return
			}
			const fullText = accumulated.join("")
			const xmlMatch = fullText.match(/```xml\s*([\s\S]*?)```/)
			if (xmlMatch) {
				// biome-ignore lint/style/noNonNullAssertion: capture group 1 always present when match succeeds
				const xmlString = xmlMatch[1]!.trim()
				res.write(`data: ${JSON.stringify({ type: "xml", xml: xmlString })}\n\n`)
			} else {
				res.write(
					`data: ${JSON.stringify({ type: "error", message: "AI did not produce DMN XML" })}\n\n`,
				)
			}
			res.end()
			return
		}

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
			description: p.description,
			tags: p.tags,
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

	// ── POST /operate/ai-search ────────────────────────────────────────────────
	// Translates a plain-text query to a Camunda API filter, executes the search,
	// and returns results as JSON.  AI is only called when the quick-parser cannot
	// resolve the query deterministically (saves tokens for simple queries).
	if (url.pathname === "/operate/ai-search" && req.method === "POST") {
		const body = await readBody(req)
		let query: string
		try {
			const parsed = JSON.parse(body) as { query?: string }
			query = parsed.query?.trim() ?? ""
			if (!query) throw new Error("empty")
		} catch {
			res.writeHead(400, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "{ query: string } required" }))
			return
		}

		const profileName = req.headers["x-profile"] as string | undefined
		const profile = profileName ? getProfile(profileName) : getActiveProfile()
		if (!profile?.config.baseUrl) {
			res.writeHead(401, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "No active profile" }))
			return
		}

		let authHeader: string
		try {
			authHeader = await getAuthHeader(profile.config)
		} catch (err) {
			res.writeHead(502, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: `Auth failed: ${String(err)}` }))
			return
		}

		const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
		const apiHeaders = {
			authorization: authHeader,
			"content-type": "application/json",
			accept: "application/json",
		}

		// Step 1: Quick deterministic parse — avoids AI entirely for simple queries.
		// Equivalent to the code-mode "pre-check" that runs optimize() before calling AI.
		type SearchSpec = { endpoint: "instances" | "variables"; filter: Record<string, unknown> }

		function tryQuickParse(q: string): SearchSpec | null {
			const trimmed = q.trim()
			// Pure numeric string → instance key lookup
			if (/^\d+$/.test(trimmed)) {
				return { endpoint: "instances", filter: { processInstanceKey: trimmed } }
			}
			// Single state keyword
			const stateMap: Record<string, string> = {
				active: "ACTIVE",
				completed: "COMPLETED",
				terminated: "TERMINATED",
			}
			const lower = trimmed.toLowerCase()
			if (stateMap[lower]) {
				return { endpoint: "instances", filter: { state: stateMap[lower] } }
			}
			return null
		}

		function extractSearchSpec(text: string): SearchSpec | null {
			// Try raw JSON first, then a ```json block, then any {...} substring
			const candidates = [
				text.trim(),
				(/```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text) ?? [])[1] ?? "",
				(/(\{[\s\S]*\})/.exec(text) ?? [])[1] ?? "",
			]
			for (const candidate of candidates) {
				if (!candidate) continue
				try {
					const parsed = JSON.parse(candidate) as unknown
					if (
						typeof parsed === "object" &&
						parsed !== null &&
						"endpoint" in parsed &&
						"filter" in parsed
					) {
						return parsed as SearchSpec
					}
				} catch {
					/* try next */
				}
			}
			return null
		}

		let spec = tryQuickParse(query)
		console.log(
			`[server] /operate/ai-search → query: "${query}", quick-parse: ${spec ? "hit" : "miss"}`,
		)

		// Step 2: AI translation — only when quick-parse has no answer
		if (!spec) {
			const available = await detectAll()
			const detected = available[0]
			if (!detected) {
				res.writeHead(503, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "No AI adapter available" }))
				return
			}
			console.log(`[server] /operate/ai-search → adapter: ${detected.name}`)
			const tokens: string[] = []
			try {
				await detected.adapter.stream(
					[{ role: "user", content: query }],
					buildSearchSystemPrompt(),
					null,
					(t) => tokens.push(t),
				)
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
				return
			}
			spec = extractSearchSpec(tokens.join(""))
			if (!spec) {
				res.writeHead(422, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Could not interpret search query" }))
				return
			}
		}

		// Step 3: Execute search against Camunda
		// Coerce variables filter.value to JSON-serialized string form.
		// The Camunda API stores variable values as JSON strings (e.g. "3355" for the number 3355).
		// If the AI emits a number or boolean, stringify it to match the stored representation.
		if (
			spec.endpoint === "variables" &&
			spec.filter.value !== undefined &&
			typeof spec.filter.value !== "string"
		) {
			spec.filter.value = JSON.stringify(spec.filter.value)
		}
		const finalSpec = spec
		let items: unknown[] = []
		let total = 0
		try {
			if (finalSpec.endpoint === "variables") {
				const r = await fetch(`${baseUrl}/variables/search`, {
					method: "POST",
					headers: apiHeaders,
					body: JSON.stringify({ filter: finalSpec.filter, page: { limit: 100 } }),
				})
				if (r.ok) {
					const result = (await r.json()) as {
						items?: unknown[]
						page?: { totalItems?: number }
					}
					items = result.items ?? []
					total = result.page?.totalItems ?? items.length

					// Enrich variable results with instance startDate (best-effort, single batch request)
					const keys = [
						...new Set(
							(items as Array<{ processInstanceKey?: string }>)
								.map((v) => v.processInstanceKey)
								.filter((k): k is string => typeof k === "string"),
						),
					]
					if (keys.length > 0) {
						try {
							const ir = await fetch(`${baseUrl}/process-instances/search`, {
								method: "POST",
								headers: apiHeaders,
								body: JSON.stringify({
									filter: { processInstanceKey: { $in: keys } },
									page: { limit: keys.length },
								}),
							})
							if (ir.ok) {
								const instResult = (await ir.json()) as {
									items?: Array<{
										processInstanceKey: string
										startDate: string
										processDefinitionName: string | null
										processDefinitionId: string
										state: string
										parentProcessInstanceKey: string | null
									}>
								}
								const instMap = new Map(
									(instResult.items ?? []).map((inst) => [inst.processInstanceKey, inst]),
								)
								items = (items as Array<Record<string, unknown>>).map((v) => {
									const inst = instMap.get(v.processInstanceKey as string)
									return {
										...v,
										instanceStartDate: inst?.startDate ?? null,
										instanceProcessName: inst?.processDefinitionName ?? null,
										instanceProcessId: inst?.processDefinitionId ?? null,
										instanceState: inst?.state ?? null,
										instanceIsSubprocess:
											inst != null &&
											inst.parentProcessInstanceKey != null &&
											inst.parentProcessInstanceKey !== "",
									}
								})
							}
						} catch {
							// Enrichment is best-effort; variable results are still returned
						}
					}
				}
			} else {
				const r = await fetch(`${baseUrl}/process-instances/search`, {
					method: "POST",
					headers: apiHeaders,
					body: JSON.stringify({
						filter: finalSpec.filter,
						page: { limit: 100 },
						sort: [{ field: "startDate", order: "DESC" }],
					}),
				})
				if (r.ok) {
					const result = (await r.json()) as {
						items?: unknown[]
						page?: { totalItems?: number }
					}
					items = result.items ?? []
					total = result.page?.totalItems ?? items.length
				}
			}
		} catch (err) {
			res.writeHead(502, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: `Search failed: ${String(err)}` }))
			return
		}

		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(
			JSON.stringify({ endpoint: finalSpec.endpoint, filter: finalSpec.filter, items, total }),
		)
		return
	}

	// ── POST /improve — structured AI-assisted BPMN improvement ─────────────────
	// Token-efficient alternative to /chat?action=improve.
	// Phase 1: optimize() auto-fix (no AI). Phase 2: AI outputs BpmnOperation[].
	// Emits SSE: tokens (explanation) + ops event + xml event + done.
	if (url.pathname === "/improve" && req.method === "POST") {
		const body = await readBody(req)
		let definitions: BpmnDefinitions
		let instruction: string | null
		let backend: string | null
		try {
			const parsed = JSON.parse(body) as {
				xml?: string
				context?: CompactDiagram
				instruction?: string | null
				backend?: string | null
			}
			// `xml` carries the whole model, so operations apply to it directly and
			// nothing outside the compact projection is lost. `context` is the older
			// contract, kept working for clients that have not been updated — it can
			// only ever describe what compact models.
			if (typeof parsed.xml === "string") {
				definitions = Bpmn.parse(parsed.xml)
			} else if (parsed.context) {
				console.warn(
					"[server] /improve received compact context; send { xml } to keep pools, lanes and ioMapping detail",
				)
				definitions = expand(parsed.context)
			} else {
				res.writeHead(400)
				res.end("Bad Request: send { xml } or { context }")
				return
			}
			instruction = parsed.instruction ?? null
			backend = parsed.backend ?? null
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
			res.writeHead(503)
			res.end("No AI CLI available. Install claude, copilot, or gemini.")
			return
		}

		// ── Phase 1: auto-fix ─────────────────────────────────────────────────
		let autoFixCount = 0
		try {
			const defs = definitions
			const report = optimize(defs)
			const fixable = report.findings
				.filter((f) => f.applyFix)
				.sort((a, b) => {
					const ord: Record<string, number> = { error: 0, warning: 1, info: 2 }
					return (ord[a.severity] ?? 2) - (ord[b.severity] ?? 2)
				})
			for (const f of fixable) f.applyFix?.(defs)
			autoFixCount = fixable.length
			if (autoFixCount > 0) {
				console.log(`[server] /improve → auto-fixed ${autoFixCount} issue(s)`)
			}
		} catch (err) {
			console.error("[server] /improve auto-fix failed:", String(err))
		}

		// ── Phase 2: collect remaining findings ───────────────────────────────
		const findings: FindingInfo[] = []
		try {
			const remaining = optimize(definitions)
			for (const f of remaining.findings) {
				findings.push({
					category: f.category,
					severity: f.severity,
					message: f.message,
					suggestion: f.suggestion,
					elementIds: f.elementIds,
				})
			}
		} catch {
			/* non-fatal */
		}

		console.log(
			`[server] /improve → adapter: ${detected.name}, findings: ${findings.length}, autoFix: ${autoFixCount}`,
		)

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})

		// ── Phase 3: AI call — outputs explanation + ```json operations block ─
		const systemPrompt = buildImproveSystemPrompt()
		const improveCtx: ImproveContext = {
			// The prompt gets the compact view — that is what it is for. The
			// operations it produces are applied to the full model below.
			compact: compactify(definitions),
			findings,
			autoFixCount,
			instruction,
		}
		const userMessage = buildImproveUserMessage(improveCtx)

		const accumulated: string[] = []
		try {
			await detected.adapter.stream(
				[{ role: "user", content: userMessage }],
				systemPrompt,
				null,
				(token) => {
					accumulated.push(token)
					res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`)
				},
			)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			console.error(`[server] /improve adapter error: ${msg}`)
			res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`)
			res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
			res.end()
			return
		}

		// ── Phase 4: parse ops, apply, expand, emit ───────────────────────────
		const fullText = accumulated.join("")
		const ops = extractOperations(fullText) ?? []
		res.write(`data: ${JSON.stringify({ type: "ops", ops, autoFixCount })}\n\n`)

		if (ops.length > 0 || autoFixCount > 0) {
			try {
				// Operations land on the full model, so anything the compact view in
				// the prompt could not describe survives the edit untouched.
				const edited =
					ops.length > 0
						? applyBpmnOperations(definitions, ops, { strict: false })
						: { definitions, problems: [], applied: 0 }
				if (edited.problems.length > 0) {
					// An operation naming an element that does not exist used to be
					// skipped in silence; report it so the model can be corrected.
					const detail = edited.problems.map((p) => `[${p.index}] ${p.reason}`).join("; ")
					console.warn(
						`[server] /improve → ${edited.problems.length} operation(s) skipped: ${detail}`,
					)
					res.write(`data: ${JSON.stringify({ type: "problems", problems: edited.problems })}\n\n`)
				}
				const xml = Bpmn.export(edited.definitions)
				res.write(`data: ${JSON.stringify({ type: "xml", xml })}\n\n`)
				console.log(`[server] /improve → ${edited.applied} ops applied, XML emitted`)
			} catch (err) {
				console.error("[server] /improve apply failed:", String(err))
				res.write(
					`data: ${JSON.stringify({ type: "error", message: `Failed to apply operations: ${String(err)}` })}\n\n`,
				)
			}
		}

		res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
		res.end()
		return
	}

	// ── POST /operate/chat — operations-context AI chat ──────────────────────────
	if (url.pathname === "/operate/chat" && req.method === "POST") {
		const body = await readBody(req)
		let messages: Array<{ role: string; content: string }>
		let stats: {
			runningInstances: number
			activeIncidents: number
			pendingTasks: number
			deployedDefinitions: number
			activeJobs: number
		} | null
		let backend: string | null
		try {
			const parsed = JSON.parse(body) as {
				messages: typeof messages
				stats?: typeof stats
				backend?: string | null
			}
			messages = parsed.messages
			stats = parsed.stats ?? null
			backend = parsed.backend ?? null
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
			res.writeHead(503)
			res.end("No AI adapter available. Install claude, copilot, or gemini.")
			return
		}

		console.log(`[server] /operate/chat → adapter: ${detected.name}`)

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})

		const systemPrompt = buildOperateChatSystemPrompt(stats)
		try {
			await detected.adapter.stream(messages, systemPrompt, null, (token) => {
				res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`)
			})
		} catch (err) {
			res.write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`)
		}
		res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`)
		res.end()
		return
	}

	// ── File System API (/fs/*) ───────────────────────────────────────────────
	if (url.pathname.startsWith("/fs/")) {
		const fsPath = url.pathname.slice("/fs".length) // e.g. "/tree", "/list", "/read"

		// GET /fs/tree?root=<abs> — lightweight directory tree
		if (fsPath === "/tree" && req.method === "GET") {
			const rawRoot = url.searchParams.get("root") ?? ""
			const root = expandHome(rawRoot)
			const rootExists = root !== "" && existsSync(root)
			console.log(`[fs/tree] raw param: ${JSON.stringify(rawRoot)}`)
			console.log(`[fs/tree] expanded:  ${JSON.stringify(root)}`)
			console.log(`[fs/tree] existsSync: ${rootExists}`)
			if (!rootExists) {
				console.log("[fs/tree] → 404 not found")
				res.writeHead(404, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Project root not found" }))
				return
			}
			const tree = buildTree(root, root)
			console.log(`[fs/tree] → 200 ok, ${tree.length} entries`)
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify(tree))
			return
		}

		// GET /fs/list?root=<abs> — all files with content + metadata
		if (fsPath === "/list" && req.method === "GET") {
			const root = expandHome(url.searchParams.get("root") ?? "")
			if (!root || !existsSync(root)) {
				res.writeHead(404, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Project root not found" }))
				return
			}
			const files = collectFiles(root, root)
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify(files))
			return
		}

		// GET /fs/read?path=<abs> — read single file content
		if (fsPath === "/read" && req.method === "GET") {
			const filePath = expandHome(url.searchParams.get("path") ?? "")
			if (!filePath || !existsSync(filePath)) {
				res.writeHead(404, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "File not found" }))
				return
			}
			let content: string
			try {
				content = readFileSync(filePath, "utf8")
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
				return
			}
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ content }))
			return
		}

		// POST /fs/write — write file (creates parent directories)
		if (fsPath === "/write" && req.method === "POST") {
			const body = await readBody(req)
			let filePath: string
			let content: string
			try {
				const parsed = JSON.parse(body) as { path: string; content: string }
				filePath = expandHome(parsed.path)
				content = parsed.content
			} catch {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Invalid JSON body" }))
				return
			}
			if (!filePath) {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Missing path" }))
				return
			}
			try {
				const dir = dirname(filePath)
				if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
				writeFileSync(filePath, content, "utf8")
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ ok: true }))
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
			}
			return
		}

		// DELETE /fs/file?path=<abs> — delete file and its sidecar
		if (fsPath === "/file" && req.method === "DELETE") {
			const filePath = expandHome(url.searchParams.get("path") ?? "")
			if (!filePath) {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Missing path" }))
				return
			}
			try {
				if (existsSync(filePath)) unlinkSync(filePath)
				const sp = sidecarPath(filePath)
				if (existsSync(sp)) unlinkSync(sp)
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ ok: true }))
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
			}
			return
		}

		// POST /fs/move — rename/move file and its sidecar
		if (fsPath === "/move" && req.method === "POST") {
			const body = await readBody(req)
			let from: string
			let to: string
			try {
				const parsed = JSON.parse(body) as { from: string; to: string }
				from = expandHome(parsed.from)
				to = expandHome(parsed.to)
			} catch {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Invalid JSON body" }))
				return
			}
			if (!from || !to) {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Missing from/to" }))
				return
			}
			try {
				const toDir = dirname(to)
				if (!existsSync(toDir)) mkdirSync(toDir, { recursive: true })
				renameSync(from, to)
				// Move sidecar if it exists
				const fromSidecar = sidecarPath(from)
				const toSidecar = sidecarPath(to)
				if (existsSync(fromSidecar)) {
					const toSidecarDir = dirname(toSidecar)
					if (!existsSync(toSidecarDir)) mkdirSync(toSidecarDir, { recursive: true })
					renameSync(fromSidecar, toSidecar)
				}
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ ok: true }))
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
			}
			return
		}

		// POST /fs/mkdir — create directory
		if (fsPath === "/mkdir" && req.method === "POST") {
			const body = await readBody(req)
			let dirPath: string
			try {
				const parsed = JSON.parse(body) as { path: string }
				dirPath = expandHome(parsed.path)
			} catch {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Invalid JSON body" }))
				return
			}
			if (!dirPath) {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Missing path" }))
				return
			}
			try {
				mkdirSync(dirPath, { recursive: true })
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ ok: true }))
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
			}
			return
		}

		// GET /fs/meta?path=<abs> — read sidecar metadata
		if (fsPath === "/meta" && req.method === "GET") {
			const filePath = expandHome(url.searchParams.get("path") ?? "")
			if (!filePath) {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Missing path" }))
				return
			}
			const meta = readMeta(filePath)
			if (!meta) {
				res.writeHead(404, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "No metadata found" }))
				return
			}
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify(meta))
			return
		}

		// POST /fs/meta — write sidecar metadata
		if (fsPath === "/meta" && req.method === "POST") {
			const body = await readBody(req)
			let filePath: string
			let meta: FileMeta
			try {
				const parsed = JSON.parse(body) as { path: string; meta: FileMeta }
				filePath = expandHome(parsed.path)
				meta = parsed.meta
			} catch {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Invalid JSON body" }))
				return
			}
			if (!filePath || !meta) {
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: "Missing path or meta" }))
				return
			}
			try {
				writeMeta(filePath, meta)
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ ok: true }))
			} catch (err) {
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ error: String(err) }))
			}
			return
		}

		res.writeHead(404)
		res.end("FS route not found")
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

	// ── POST /secrets/check — bulk existence check for secret names ───────────
	if (url.pathname === "/secrets/check" && req.method === "POST") {
		const body = await readBody(req)
		let names: string[] = []
		try {
			names = ((JSON.parse(body) as { names?: unknown }).names ?? []) as string[]
		} catch {
			/* treat as empty list */
		}
		const result: Record<string, boolean> = {}
		for (const name of names) {
			result[name] = process.env[name] !== undefined
		}
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(result))
		return
	}

	// ── POST /secrets/:name — resolve and encrypt a secret for the client ─────
	if (url.pathname.startsWith("/secrets/") && req.method === "POST") {
		const name = url.pathname.slice("/secrets/".length)
		if (!name) {
			res.writeHead(400, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Secret name required" }))
			return
		}
		const secretValue = process.env[name]
		if (secretValue === undefined) {
			res.writeHead(404, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: `Secret "${name}" is not configured` }))
			return
		}
		const body = await readBody(req)
		let keyBase64: string
		try {
			const parsed = JSON.parse(body) as { key?: unknown }
			if (typeof parsed.key !== "string" || !parsed.key) throw new Error("missing key")
			keyBase64 = parsed.key
		} catch {
			res.writeHead(400, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Body must be { key: string } with a base64 AES-256 key" }))
			return
		}
		try {
			const rawKey = Buffer.from(keyBase64, "base64")
			const cryptoKey = await globalThis.crypto.subtle.importKey(
				"raw",
				rawKey,
				{ name: "AES-GCM" },
				false,
				["encrypt"],
			)
			const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
			const encrypted = await globalThis.crypto.subtle.encrypt(
				{ name: "AES-GCM", iv },
				cryptoKey,
				new TextEncoder().encode(secretValue),
			)
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(
				JSON.stringify({
					encrypted: Buffer.from(encrypted).toString("base64"),
					iv: Buffer.from(iv).toString("base64"),
				}),
			)
		} catch (err) {
			console.error(`[secrets] encryption failed for "${name}":`, err)
			res.writeHead(500, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Encryption failed" }))
		}
		return
	}

	// ── POST /http-request — CORS bypass for wasm worker REST connectors ─────
	if (url.pathname === "/http-request" && req.method === "POST") {
		const body = await readBody(req)
		let targetUrl: string
		let method: string
		let headers: Record<string, string>
		let reqBody: string | undefined
		try {
			const parsed = JSON.parse(body) as {
				url: string
				method?: string
				headers?: Record<string, string>
				body?: string
			}
			targetUrl = parsed.url
			method = (parsed.method ?? "GET").toUpperCase()
			headers = parsed.headers ?? {}
			reqBody = parsed.body
		} catch {
			res.writeHead(400, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Invalid JSON body" }))
			return
		}
		console.log(`[http-request] ${method} ${targetUrl}`)
		try {
			const upstream = await fetch(targetUrl, {
				method,
				headers,
				body: method !== "GET" && method !== "HEAD" ? reqBody : undefined,
			})
			const responseText = await upstream.text()
			const contentType = upstream.headers.get("content-type") ?? "application/json"
			res.writeHead(upstream.status, {
				"Content-Type": contentType,
				"Access-Control-Allow-Origin": "*",
			})
			res.end(responseText)
		} catch (err) {
			res.writeHead(502, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: `Upstream unreachable: ${String(err)}` }))
		}
		return
	}

	res.writeHead(404)
	res.end("Not Found")
})

export function startServer(port = PORT): void {
	server.listen(port, () => {
		console.log(`BPMN Kit AI Server running at http://localhost:${port}`)
		console.log("Press Ctrl+C to stop")
		startWorkerDaemon()
		startTriggers()
	})
}

// Auto-start when run directly as a binary (not imported as a library)
const __isMain = fileURLToPath(import.meta.url) === process.argv[1]
if (__isMain) startServer()

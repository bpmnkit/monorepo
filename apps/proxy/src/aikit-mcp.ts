#!/usr/bin/env node
/**
 * AIKit MCP server — exposes BPMNKit capabilities as MCP tools for Claude Code skills.
 *
 * Tools:
 *   bpmn_create, bpmn_read, bpmn_update, bpmn_validate, bpmn_deploy,
 *   bpmn_simulate, bpmn_run_history,
 *   worker_list, worker_scaffold,
 *   form_create, dmn_create,
 *   pattern_list, pattern_get
 *
 * Usage:
 *   node dist/aikit-mcp.js
 *
 * Environment:
 *   BPMNKIT_PROXY_URL   — proxy base URL (default: http://localhost:3033)
 *   ZEEBE_ADDRESS       — Zeebe/reebe REST URL (default: http://localhost:26500)
 *   ZEEBE_CLIENT_ID     — OAuth client ID (Camunda SaaS)
 *   ZEEBE_CLIENT_SECRET — OAuth client secret (Camunda SaaS)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { createInterface } from "node:readline"
import { Bpmn, compactify, optimize } from "@bpmnkit/core"
import { ALL_PATTERNS, findPattern } from "@bpmnkit/patterns"
import { getActiveProfile, getAuthHeader } from "@bpmnkit/profiles"
import { CAMUNDA_SPEC } from "./camunda-spec.js"
import { runSandboxed } from "./sandbox.js"
import type { HostFunction } from "./sandbox.js"

// ── Config ────────────────────────────────────────────────────────────────────

const PROXY_URL = (process.env.BPMNKIT_PROXY_URL ?? "http://localhost:3033").replace(/\/$/, "")
const ZEEBE_ADDRESS = (process.env.ZEEBE_ADDRESS ?? "http://localhost:26500").replace(/\/$/, "")

// ── Helpers ───────────────────────────────────────────────────────────────────

function expandHome(p: string): string {
	if (p === "~" || p.startsWith("~/")) return homedir() + p.slice(1)
	return p
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64)
}

/**
 * Call a proxy SSE endpoint and collect the resulting XML and response text.
 * The proxy emits `{ type: "xml", xml: "..." }` events when a diagram is produced.
 */
async function fetchProxyXml(
	endpoint: string,
	body: Record<string, unknown>,
): Promise<{ xml: string | undefined; json: string | undefined; text: string }> {
	let res: Response
	try {
		res = await fetch(`${PROXY_URL}${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	} catch (err) {
		throw new Error(
			`Cannot reach proxy at ${PROXY_URL}. Is it running? (${err instanceof Error ? err.message : String(err)})`,
		)
	}

	if (!res.ok) throw new Error(`Proxy ${endpoint} returned ${res.status}`)
	if (!res.body) throw new Error("No response body from proxy")

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let xml: string | undefined
	let json: string | undefined
	let errorMsg: string | undefined
	const tokens: string[] = []
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""
		for (const line of lines) {
			const trimmed = line.trim()
			if (!trimmed.startsWith("data: ")) continue
			try {
				const event = JSON.parse(trimmed.slice(6)) as {
					type: string
					xml?: string
					json?: string
					text?: string
					message?: string
				}
				if (event.type === "token" && event.text) tokens.push(event.text)
				if (event.type === "xml" && event.xml) xml = event.xml
				if (event.type === "json" && event.json) json = event.json
				if (event.type === "error") errorMsg = event.message
			} catch {
				/* skip malformed events */
			}
		}
	}

	if (errorMsg) throw new Error(errorMsg)
	return { xml, json, text: tokens.join("") }
}

/** Write BPMN XML to disk and return the absolute path. */
function writeBpmn(dir: string, name: string, xml: string): string {
	const safeDir = expandHome(dir)
	if (!existsSync(safeDir)) mkdirSync(safeDir, { recursive: true })
	const filePath = join(safeDir, name.endsWith(".bpmn") ? name : `${name}.bpmn`)
	writeFileSync(filePath, xml, "utf8")
	return filePath
}

// ── Built-in worker catalog ───────────────────────────────────────────────────

interface WorkerEntry {
	jobType: string
	name: string
	description: string
	source: "built-in" | "scaffolded"
	path?: string
}

const BUILTIN_WORKERS: WorkerEntry[] = [
	{
		jobType: "io.bpmnkit:cli:1",
		name: "CLI",
		description: "Run a shell command",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:llm:1",
		name: "LLM",
		description: "Call Claude, Copilot, or Gemini with a prompt",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:fs:read:1",
		name: "FS Read",
		description: "Read a file from disk",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:fs:write:1",
		name: "FS Write",
		description: "Write a file to disk",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:fs:append:1",
		name: "FS Append",
		description: "Append to a file",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:fs:list:1",
		name: "FS List",
		description: "List files in a directory",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:js:1",
		name: "JavaScript",
		description: "Evaluate a JavaScript expression",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:http:scrape:1",
		name: "HTTP Scrape",
		description: "Fetch a URL and extract text/HTML",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:email:fetch:1",
		name: "Email Fetch",
		description: "Fetch emails from IMAP",
		source: "built-in",
	},
	{
		jobType: "io.bpmnkit:email:send:1",
		name: "Email Send",
		description: "Send an email via SMTP",
		source: "built-in",
	},
]

/** Scan the local ./workers/ directory for scaffolded workers. */
function scanScaffoldedWorkers(cwd: string): WorkerEntry[] {
	const workersDir = join(cwd, "workers")
	if (!existsSync(workersDir)) return []

	const entries: WorkerEntry[] = []
	try {
		for (const entry of readdirSync(workersDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			const workerDir = join(workersDir, entry.name)
			const pkgPath = join(workerDir, "package.json")
			if (!existsSync(pkgPath)) continue
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
					bpmnkit?: { jobType?: string; description?: string }
				}
				const jobType = pkg.bpmnkit?.jobType
				if (!jobType) continue
				entries.push({
					jobType,
					name: entry.name,
					description: pkg.bpmnkit?.description ?? "",
					source: "scaffolded",
					path: workerDir,
				})
			} catch {
				/* skip unreadable package.json */
			}
		}
	} catch {
		/* workers dir not accessible */
	}
	return entries
}

// ── Worker scaffold template ──────────────────────────────────────────────────

interface WorkerScaffoldSpec {
	jobType: string
	description?: string
	inputs?: Record<string, string>
	outputs?: Record<string, string>
}

function generateWorkerCode(slug: string, spec: WorkerScaffoldSpec): string {
	const inputFields = Object.entries(spec.inputs ?? {})
		.map(([k, v]) => `\t${k}: unknown // ${v}`)
		.join("\n")
	const outputFields = Object.entries(spec.outputs ?? {})
		.map(([k, v]) => `\t${k}: unknown // ${v}`)
		.join("\n")

	return `/**
 * Generated by BPMNKit AIKit
 * Worker: ${slug}
 * Job type: ${spec.jobType}
 *
 * Setup:
 *   npm install
 *   npm start               # development (tsx, no build needed)
 *   npm run build && npm run start:prod  # production (compiled JS)
 *
 * Required env: ZEEBE_ADDRESS (default: http://localhost:26500)
 */

import { createWorkerClient } from "@bpmnkit/worker-client"

const JOB_TYPE = ${JSON.stringify(spec.jobType)}
const WORKER_NAME = ${JSON.stringify(slug)}

const client = createWorkerClient({ workerName: WORKER_NAME })

// ── Types ─────────────────────────────────────────────────────────────────────

interface Inputs {
${inputFields || "\t// (no inputs defined)"}
}

interface Outputs {
${outputFields || "\t// (no outputs defined)"}
}

// ── Business logic ────────────────────────────────────────────────────────────

async function handle(variables: Inputs): Promise<Outputs> {
\t// TODO: implement ${spec.description ?? "business logic"}
\tthrow new Error("Not implemented")
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

console.log(\`[\${WORKER_NAME}] polling \${JOB_TYPE} on \${process.env.ZEEBE_ADDRESS ?? "http://localhost:26500"}\`)

for await (const job of client.poll(JOB_TYPE)) {
\ttry {
\t\tconst outputs = await handle(job.variables as Inputs)
\t\tawait job.complete(outputs)
\t\tconsole.log(\`[\${WORKER_NAME}] completed \${job.key}\`)
\t} catch (err) {
\t\tconst msg = err instanceof Error ? err.message : String(err)
\t\tawait job.fail(msg, job.retries - 1)
\t\tconsole.error(\`[\${WORKER_NAME}] failed \${job.key}: \${msg}\`)
\t}
}
`
}

function generateWorkerPackageJson(slug: string, spec: WorkerScaffoldSpec): string {
	return JSON.stringify(
		{
			name: `${slug}-worker`,
			version: "1.0.0",
			type: "module",
			scripts: {
				start: "tsx index.ts",
				build: "tsc",
				"start:prod": "node dist/index.js",
			},
			bpmnkit: {
				jobType: spec.jobType,
				description: spec.description ?? "",
			},
			dependencies: {
				"@bpmnkit/worker-client": "latest",
			},
			devDependencies: {
				tsx: "latest",
				typescript: "latest",
			},
		},
		null,
		2,
	)
}

function generateWorkerTsConfig(): string {
	return JSON.stringify(
		{
			compilerOptions: {
				target: "ES2022",
				module: "NodeNext",
				moduleResolution: "NodeNext",
				strict: true,
				outDir: "dist",
				rootDir: ".",
				skipLibCheck: true,
			},
			include: ["index.ts"],
		},
		null,
		2,
	)
}

function generateWorkerReadme(slug: string, spec: WorkerScaffoldSpec): string {
	const envVars = [
		"ZEEBE_ADDRESS — Zeebe/reebe REST URL (default: http://localhost:26500)",
		"ZEEBE_CLIENT_ID — OAuth2 client ID (Camunda SaaS only)",
		"ZEEBE_CLIENT_SECRET — OAuth2 client secret (Camunda SaaS only)",
	]

	const inputList = Object.entries(spec.inputs ?? {})
		.map(([k, v]) => `- \`${k}\`: ${v}`)
		.join("\n")
	const outputList = Object.entries(spec.outputs ?? {})
		.map(([k, v]) => `- \`${k}\`: ${v}`)
		.join("\n")

	return `# ${slug} worker

${spec.description ?? "BPMNKit worker"}

**Job type**: \`${spec.jobType}\`

## Setup

\`\`\`bash
npm install

# Development (runs TypeScript directly, no build needed)
npm start

# Production (compiled JS)
npm run build && npm run start:prod
\`\`\`

## Environment variables

${envVars.map((e) => `- \`${e}\``).join("\n")}

## Inputs

${inputList || "_(none defined)_"}

## Outputs

${outputList || "_(none defined)_"}

## Docker (production)

\`\`\`dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.ts tsconfig.json ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
\`\`\`
`
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolBpmnCreate(description: string, outputDir?: string): Promise<string> {
	const dir = outputDir ? expandHome(outputDir) : process.cwd()
	const slug = slugify(description)

	// Load a matching pattern for context
	const pattern = findPattern(description)
	const context = pattern
		? `\nDomain context:\n${pattern.readme}\n\nTypical service tasks:\n${pattern.workers.map((w) => `- ${w.name} (${w.jobType}): ${w.description}`).join("\n")}`
		: ""

	const { xml } = await fetchProxyXml("/chat", {
		messages: [
			{
				role: "user",
				content: `Create a BPMN process: ${description}${context}`,
			},
		],
	})

	if (!xml) throw new Error("AI did not produce a BPMN diagram. Try a more specific description.")

	const filePath = writeBpmn(dir, slug, xml)
	return JSON.stringify({ path: filePath, patternMatched: pattern?.id ?? null })
}

function toolBpmnRead(path: string): string {
	const absPath = expandHome(path)
	if (!existsSync(absPath)) throw new Error(`File not found: ${path}`)
	const xml = readFileSync(absPath, "utf8")
	const defs = Bpmn.parse(xml)
	const compact = compactify(defs)
	return JSON.stringify(compact, null, 2)
}

async function toolBpmnUpdate(path: string, instruction: string): Promise<string> {
	const absPath = expandHome(path)
	if (!existsSync(absPath)) throw new Error(`File not found: ${path}`)

	const xml = readFileSync(absPath, "utf8")
	const defs = Bpmn.parse(xml)
	const compact = compactify(defs)

	const { xml: updatedXml } = await fetchProxyXml("/chat", {
		messages: [{ role: "user", content: instruction }],
		context: compact,
		action: "improve",
	})

	if (!updatedXml) throw new Error("AI did not produce an updated diagram.")

	writeFileSync(absPath, updatedXml, "utf8")
	return JSON.stringify({ path: absPath, updated: true })
}

function toolBpmnValidate(path: string): string {
	const absPath = expandHome(path)
	if (!existsSync(absPath)) throw new Error(`File not found: ${path}`)

	const xml = readFileSync(absPath, "utf8")
	const defs = Bpmn.parse(xml)
	const report = optimize(defs)

	const findings = report.findings.map((f) => ({
		severity: f.severity,
		category: f.category,
		message: f.message,
		suggestion: f.suggestion,
		elementIds: f.elementIds,
		autoFixable: Boolean(f.applyFix),
	}))

	const summary = {
		total: findings.length,
		errors: findings.filter((f) => f.severity === "error").length,
		warnings: findings.filter((f) => f.severity === "warning").length,
		info: findings.filter((f) => f.severity === "info").length,
		autoFixable: findings.filter((f) => f.autoFixable).length,
	}

	return JSON.stringify({ summary, findings }, null, 2)
}

async function toolBpmnDeploy(path: string, target: "local" | "camunda8"): Promise<string> {
	const absPath = expandHome(path)
	if (!existsSync(absPath)) throw new Error(`File not found: ${path}`)

	const xml = readFileSync(absPath, "utf8")
	const fileName = basename(absPath)
	const blob = new Blob([xml], { type: "application/octet-stream" })
	const formData = new FormData()
	formData.append("resources[]", blob, fileName)

	if (target === "local") {
		const res = await fetch(`${ZEEBE_ADDRESS}/v2/deployments`, {
			method: "POST",
			body: formData,
		})
		if (!res.ok) throw new Error(`Local deploy failed: ${res.status} ${await res.text()}`)
		const result = (await res.json()) as unknown
		return JSON.stringify({ success: true, target: "local", result })
	}

	// camunda8 — use active profile
	const profile = getActiveProfile()
	if (!profile?.config.baseUrl) {
		throw new Error("No active Camunda 8 profile. Run: casen profile create")
	}
	const authHeader = await getAuthHeader(profile.config)
	const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
	const res = await fetch(`${baseUrl}/v2/deployments`, {
		method: "POST",
		headers: { authorization: authHeader },
		body: formData,
	})
	if (!res.ok) throw new Error(`Camunda 8 deploy failed: ${res.status} ${await res.text()}`)
	const result = (await res.json()) as unknown
	return JSON.stringify({ success: true, target: "camunda8", result })
}

async function toolBpmnSimulate(path: string, scenarios: unknown[]): Promise<string> {
	const absPath = expandHome(path)
	if (!existsSync(absPath)) throw new Error(`File not found: ${path}`)

	const xml = readFileSync(absPath, "utf8")
	const defs = Bpmn.parse(xml)

	// Collect all service task job types referenced in the diagram
	const referencedJobTypes = new Set<string>()
	for (const proc of defs.processes) {
		for (const el of proc.flowElements) {
			if (el.type !== "serviceTask") continue
			const ext = el.extensionElements ?? []
			for (const e of ext) {
				if (
					typeof e === "object" &&
					e !== null &&
					"$type" in e &&
					(e as Record<string, unknown>).$type === "zeebe:TaskDefinition"
				) {
					const typeProp = (e as Record<string, unknown>).type
					if (typeof typeProp === "string") referencedJobTypes.add(typeProp)
				}
			}
		}
	}

	const allWorkers = [...BUILTIN_WORKERS, ...scanScaffoldedWorkers(process.cwd())]
	const knownJobTypes = new Set(allWorkers.map((w) => w.jobType))

	const missingWorkers = [...referencedJobTypes].filter((jt) => !knownJobTypes.has(jt))
	const coveredWorkers = [...referencedJobTypes].filter((jt) => knownJobTypes.has(jt))

	// Validation findings
	const validationReport = optimize(defs)
	const errors = validationReport.findings.filter((f) => f.severity === "error")

	return JSON.stringify(
		{
			note: "Phase 1: structural analysis. Full simulation (with process execution) coming in a future phase.",
			validation: {
				errors: errors.length,
				findings: errors.map((f) => ({ message: f.message, elementIds: f.elementIds })),
			},
			workerCoverage: {
				total: referencedJobTypes.size,
				covered: coveredWorkers.length,
				missing: missingWorkers,
			},
			scenariosRequested: scenarios.length,
		},
		null,
		2,
	)
}

async function toolBpmnRunHistory(processId?: string): Promise<string> {
	const params = new URLSearchParams({ limit: "20" })
	let res: Response
	try {
		res = await fetch(`${PROXY_URL}/run-history?${params.toString()}`)
	} catch {
		throw new Error(`Cannot reach proxy at ${PROXY_URL}. Is it running?`)
	}
	if (!res.ok) throw new Error(`Run history request failed: ${res.status}`)
	const data = (await res.json()) as { runs: Array<{ processId?: string }> }

	const runs = processId ? data.runs.filter((r) => r.processId === processId) : data.runs
	return JSON.stringify({ runs }, null, 2)
}

function toolWorkerList(): string {
	const scaffolded = scanScaffoldedWorkers(process.cwd())
	const all = [...BUILTIN_WORKERS, ...scaffolded]
	return JSON.stringify({ workers: all, total: all.length }, null, 2)
}

function toolWorkerScaffold(jobType: string, spec: WorkerScaffoldSpec): string {
	const slug = slugify(jobType.split(":").slice(-2).join("-").replace(":", "-"))
	const workerDir = join(process.cwd(), "workers", slug)

	if (!existsSync(workerDir)) mkdirSync(workerDir, { recursive: true })

	const fullSpec: WorkerScaffoldSpec = { ...spec, jobType }

	writeFileSync(join(workerDir, "index.ts"), generateWorkerCode(slug, fullSpec), "utf8")
	writeFileSync(join(workerDir, "package.json"), generateWorkerPackageJson(slug, fullSpec), "utf8")
	writeFileSync(join(workerDir, "tsconfig.json"), generateWorkerTsConfig(), "utf8")
	writeFileSync(join(workerDir, "README.md"), generateWorkerReadme(slug, fullSpec), "utf8")

	return JSON.stringify({
		path: workerDir,
		files: ["index.ts", "package.json", "tsconfig.json", "README.md"],
		jobType,
		note: "Run `npm install` then `npm start` in the worker directory. Edit index.ts to implement handle().",
	})
}

function toolPatternList(): string {
	const patterns = ALL_PATTERNS.map((p) => ({
		id: p.id,
		name: p.name,
		description: p.description,
		keywords: p.keywords,
	}))
	return JSON.stringify({ patterns, total: patterns.length }, null, 2)
}

async function toolFormCreate(bpmnPath: string, outputDir?: string): Promise<string> {
	const absPath = expandHome(bpmnPath)
	if (!existsSync(absPath)) throw new Error(`File not found: ${bpmnPath}`)
	const xml = readFileSync(absPath, "utf8")
	const defs = Bpmn.parse(xml)
	const compact = compactify(defs)

	const userTasks = compact.processes
		.flatMap((p) => p.elements)
		.filter((el) => el.type === "userTask" && el.formId)

	if (userTasks.length === 0) return JSON.stringify({ forms: [] })

	const dir = outputDir ? expandHome(outputDir) : dirname(absPath)
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

	for (const el of userTasks) {
		const { json } = await fetchProxyXml("/chat", {
			messages: [
				{
					role: "user",
					content: `User task: ${el.name ?? el.id}, formId: ${el.formId as string}, process: ${compact.processes[0]?.name ?? compact.processes[0]?.id ?? "unknown"}`,
				},
			],
			action: "create-form",
		})
		if (!json) throw new Error(`AI did not produce a form for task ${el.id}`)
		writeFileSync(join(dir, `${el.formId as string}.form`), json, "utf8")
	}

	return JSON.stringify({
		forms: userTasks.map((el) => ({
			taskId: el.id,
			taskName: el.name ?? el.id,
			formId: el.formId as string,
			path: join(dir, `${el.formId as string}.form`),
		})),
	})
}

function toolPatternGet(domain: string): string {
	const pattern = findPattern(domain) ?? ALL_PATTERNS.find((p) => p.id === domain)
	if (!pattern)
		throw new Error(
			`No pattern found for: "${domain}". Call pattern_list to see available patterns.`,
		)

	return JSON.stringify(
		{
			id: pattern.id,
			name: pattern.name,
			description: pattern.description,
			keywords: pattern.keywords,
			readme: pattern.readme,
			workers: pattern.workers,
			variations: pattern.variations,
			template: pattern.template,
		},
		null,
		2,
	)
}

async function toolDmnCreate(bpmnPath: string, outputDir?: string): Promise<string> {
	const absPath = expandHome(bpmnPath)
	if (!existsSync(absPath)) throw new Error(`File not found: ${bpmnPath}`)

	const xml = readFileSync(absPath, "utf8")
	const defs = Bpmn.parse(xml)
	const compact = compactify(defs)

	const brtasks = compact.processes
		.flatMap((p) => p.elements)
		.filter(
			(el): el is typeof el & { decisionId: string } =>
				el.type === "businessRuleTask" && Boolean(el.decisionId),
		)

	if (brtasks.length === 0) return JSON.stringify({ decisions: [] })

	const dir = outputDir ? expandHome(outputDir) : dirname(absPath)
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

	for (const el of brtasks) {
		const { xml: dmnXml } = await fetchProxyXml("/chat", {
			messages: [
				{
					role: "user",
					content: `Decision: ${el.name ?? el.id}, decisionId: ${el.decisionId}, process: ${compact.processes[0]?.name ?? compact.processes[0]?.id ?? "unknown"}`,
				},
			],
			action: "create-dmn",
		})

		if (!dmnXml) throw new Error(`AI did not produce DMN for task ${el.id}`)

		writeFileSync(join(dir, `${el.decisionId}.dmn`), dmnXml, "utf8")
	}

	return JSON.stringify({
		decisions: brtasks.map((el) => ({
			taskId: el.id,
			taskName: el.name ?? el.id,
			decisionId: el.decisionId,
			path: join(dir, `${el.decisionId}.dmn`),
		})),
	})
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
	{
		name: "bpmn_create",
		description:
			"Generate a new BPMN process from a natural language description. " +
			"Automatically loads a domain pattern if one matches, then calls the AI to generate the diagram. " +
			"Writes the result to disk and returns the file path.",
		inputSchema: {
			type: "object",
			properties: {
				description: {
					type: "string",
					description: "Natural language description of the process to create",
				},
				outputDir: {
					type: "string",
					description: "Directory to write the BPMN file (default: current working directory)",
				},
			},
			required: ["description"],
		},
	},
	{
		name: "bpmn_read",
		description: "Read a BPMN file and return its compact JSON representation.",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the .bpmn file" },
			},
			required: ["path"],
		},
	},
	{
		name: "bpmn_update",
		description:
			"Update an existing BPMN file by describing the change in natural language. " +
			"Reads the file, sends it to the AI with the instruction, and writes the result back.",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the .bpmn file" },
				instruction: {
					type: "string",
					description: "Natural language instruction for the change to make",
				},
			},
			required: ["path", "instruction"],
		},
	},
	{
		name: "bpmn_validate",
		description:
			"Validate a BPMN file using the BPMNKit pattern advisor. " +
			"Returns a list of findings with severity (error/warning/info), category, message, and whether they can be auto-fixed.",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the .bpmn file" },
			},
			required: ["path"],
		},
	},
	{
		name: "bpmn_deploy",
		description:
			"Deploy a BPMN process to a running engine. " +
			'target "local" deploys to the local reebe instance (ZEEBE_ADDRESS). ' +
			'target "camunda8" deploys to the active Camunda 8 profile.',
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the .bpmn file" },
				target: {
					type: "string",
					enum: ["local", "camunda8"],
					description: "Deployment target",
				},
			},
			required: ["path", "target"],
		},
	},
	{
		name: "bpmn_simulate",
		description:
			"Analyse a BPMN process structurally: checks validation findings and worker coverage. " +
			"Full process execution simulation is planned for a future phase.",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the .bpmn file" },
				scenarios: {
					type: "array",
					description: "Test scenarios (reserved for future use)",
					items: { type: "object" },
				},
			},
			required: ["path"],
		},
	},
	{
		name: "bpmn_run_history",
		description: "Query the run history from the local proxy. Returns recent process executions.",
		inputSchema: {
			type: "object",
			properties: {
				processId: {
					type: "string",
					description: "Filter by process definition ID (optional)",
				},
			},
		},
	},
	{
		name: "worker_list",
		description:
			"List all available workers: built-in BPMNKit workers and any scaffolded workers " +
			"found in the ./workers/ directory of the current working directory.",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "worker_scaffold",
		description:
			"Scaffold a standalone TypeScript worker for a given Zeebe job type. " +
			"Generates index.ts, package.json, tsconfig.json, and README.md in ./workers/<slug>/. " +
			"The worker uses @bpmnkit/worker-client — no other BPMNKit dependency required at runtime.",
		inputSchema: {
			type: "object",
			properties: {
				jobType: {
					type: "string",
					description: "Zeebe job type string, e.g. com.example:send-invoice:1",
				},
				description: {
					type: "string",
					description: "What this worker does",
				},
				inputs: {
					type: "object",
					description: "Input variable names mapped to type descriptions",
					additionalProperties: { type: "string" },
				},
				outputs: {
					type: "object",
					description: "Output variable names mapped to type descriptions",
					additionalProperties: { type: "string" },
				},
			},
			required: ["jobType"],
		},
	},
	{
		name: "pattern_list",
		description:
			"List all available domain process patterns with their id, name, description, and keywords. " +
			"Use this at the start of /implement to check whether a relevant pattern exists.",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "pattern_get",
		description:
			"Get the full content of a domain pattern: readme, worker specs, variations, and compact BPMN template. " +
			"Match by pattern id or by a free-text query (keyword matching).",
		inputSchema: {
			type: "object",
			properties: {
				domain: {
					type: "string",
					description:
						'Pattern id (e.g. "invoice-approval") or free-text query (e.g. "employee onboarding")',
				},
			},
			required: ["domain"],
		},
	},
	{
		name: "form_create",
		description:
			"Generate Camunda form JSON files for all user tasks in a BPMN process that have a formId. " +
			"Writes one .form file per user task into the output directory (default: same directory as the BPMN file).",
		inputSchema: {
			type: "object",
			properties: {
				bpmnPath: {
					type: "string",
					description: "Path to the BPMN file",
				},
				outputDir: {
					type: "string",
					description: "Directory to write form files (default: same directory as the BPMN file)",
				},
			},
			required: ["bpmnPath"],
		},
	},
	{
		name: "dmn_create",
		description:
			"Generate DMN decision table XML files for all business rule tasks in a BPMN process that have a decisionId. " +
			"Writes one .dmn file per business rule task into the output directory (default: same directory as the BPMN file).",
		inputSchema: {
			type: "object",
			properties: {
				bpmnPath: {
					type: "string",
					description: "Path to the BPMN file",
				},
				outputDir: {
					type: "string",
					description: "Directory to write DMN files (default: same directory as the BPMN file)",
				},
			},
			required: ["bpmnPath"],
		},
	},
	{
		name: "camunda_search",
		description:
			"Inspect the Camunda 8 REST API spec to discover available operations before calling camunda_execute.\n" +
			"Receives `spec` — an object keyed by resource group (processInstance, incident, job, etc.).\n" +
			"Each entry maps method names to { description, endpoint, params, returns }.\n\n" +
			"Example — list all process instance methods:\n" +
			"  return Object.keys(spec.processInstance)\n\n" +
			"Example — find all search operations across resources:\n" +
			"  return Object.entries(spec).flatMap(([r, ms]) => Object.keys(ms).filter(m => m.startsWith('search')).map(m => r + '.' + m))\n\n" +
			"Example — get full spec for one method:\n" +
			"  return spec.incident.resolveIncident",
		inputSchema: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description: "JavaScript returning a value. Has `spec` as a global.",
				},
			},
			required: ["code"],
		},
	},
] as const

// ── JSON-RPC 2.0 stdio loop ───────────────────────────────────────────────────

interface JsonRpcRequest {
	jsonrpc: string
	id?: number | string
	method: string
	params?: unknown
}

interface JsonRpcResponse {
	jsonrpc: "2.0"
	id: number | string | undefined
	result?: unknown
	error?: { code: number; message: string }
}

export async function handleCamundaSearch(code: string): Promise<string> {
	const result = await runSandboxed(code, { data: { spec: CAMUNDA_SPEC } }, 5000)
	return JSON.stringify(result)
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
	process.stderr.write(`[aikit-mcp] tool: ${name} args: ${JSON.stringify(args)}\n`)

	switch (name) {
		case "bpmn_create":
			return toolBpmnCreate(args.description as string, args.outputDir as string | undefined)

		case "bpmn_read":
			return toolBpmnRead(args.path as string)

		case "bpmn_update":
			return toolBpmnUpdate(args.path as string, args.instruction as string)

		case "bpmn_validate":
			return toolBpmnValidate(args.path as string)

		case "bpmn_deploy":
			return toolBpmnDeploy(args.path as string, args.target as "local" | "camunda8")

		case "bpmn_simulate":
			return toolBpmnSimulate(args.path as string, (args.scenarios as unknown[]) ?? [])

		case "bpmn_run_history":
			return toolBpmnRunHistory(args.processId as string | undefined)

		case "worker_list":
			return toolWorkerList()

		case "worker_scaffold":
			return toolWorkerScaffold(args.jobType as string, {
				jobType: args.jobType as string,
				description: args.description as string | undefined,
				inputs: args.inputs as Record<string, string> | undefined,
				outputs: args.outputs as Record<string, string> | undefined,
			})

		case "pattern_list":
			return toolPatternList()

		case "pattern_get":
			return toolPatternGet(args.domain as string)

		case "form_create": {
			const path = String(args.bpmnPath ?? "")
			const outDir = args.outputDir ? String(args.outputDir) : undefined
			return toolFormCreate(path, outDir)
		}

		case "dmn_create": {
			const path = String(args.bpmnPath ?? "")
			const outDir = args.outputDir ? String(args.outputDir) : undefined
			return toolDmnCreate(path, outDir)
		}

		case "camunda_search":
			return handleCamundaSearch(args.code as string)

		default:
			throw new Error(`Unknown tool: ${name}`)
	}
}

const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })

rl.on("line", (line) => {
	const trimmed = line.trim()
	if (!trimmed) return

	let req: JsonRpcRequest
	try {
		req = JSON.parse(trimmed) as JsonRpcRequest
	} catch {
		return
	}

	if (!("id" in req)) return

	void (async () => {
		let result: unknown
		let error: { code: number; message: string } | undefined

		try {
			switch (req.method) {
				case "initialize":
					result = {
						protocolVersion: "2024-11-05",
						capabilities: { tools: {} },
						serverInfo: { name: "bpmnkit-aikit", version: "1.0.0" },
					}
					break

				case "tools/list":
					result = { tools: TOOLS }
					break

				case "tools/call": {
					const params = req.params as { name: string; arguments?: Record<string, unknown> }
					const text = await callTool(params.name, params.arguments ?? {})
					result = { content: [{ type: "text", text }], isError: false }
					break
				}

				case "ping":
					result = {}
					break

				default:
					error = { code: -32601, message: "Method not found" }
			}
		} catch (err) {
			if (req.method === "tools/call") {
				result = {
					content: [{ type: "text", text: String(err) }],
					isError: true,
				}
			} else {
				error = { code: -32603, message: String(err) }
			}
		}

		const response: JsonRpcResponse = error
			? { jsonrpc: "2.0", id: req.id, error }
			: { jsonrpc: "2.0", id: req.id, result }

		process.stdout.write(`${JSON.stringify(response)}\n`)
	})()
})

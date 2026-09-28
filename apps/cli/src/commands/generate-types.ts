import type { Dirent } from "node:fs"
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { Bpmn, extractProcessContract, generateProcessTypes } from "@bpmnkit/core"
import type { BpmnDefinitions } from "@bpmnkit/core"
import type { Command, ParsedFlags } from "../types.js"

// ── File patterns ─────────────────────────────────────────────────────────────

const GLOB_CHARS = /[*?[]/
const SKIPPED_DIRS = new Set(["node_modules", "dist", "build", "coverage"])

/** Translate a glob (`*`, `**`, `?`, `[...]`) into a regular expression over `/`-separated paths. */
export function globToRegExp(glob: string): RegExp {
	let out = ""
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i] as string
		if (c === "*" && glob[i + 1] === "*") {
			// `**/` matches zero or more directories; a trailing `**` matches anything.
			if (glob[i + 2] === "/") {
				out += "(?:.*/)?"
				i += 2
			} else {
				out += ".*"
				i += 1
			}
		} else if (c === "*") out += "[^/]*"
		else if (c === "?") out += "[^/]"
		else if (c === "[") {
			const end = glob.indexOf("]", i)
			if (end === -1) out += "\\["
			else {
				out += `[${glob.slice(i + 1, end).replace(/^!/, "^")}]`
				i = end
			}
		} else out += c.replace(/[.+^${}()|\\]/g, "\\$&")
	}
	return new RegExp(`^${out}$`)
}

async function walk(dir: string, into: string[]): Promise<void> {
	let entries: Dirent[]
	try {
		entries = await readdir(dir, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") || SKIPPED_DIRS.has(entry.name)) continue
		const path = join(dir, entry.name)
		if (entry.isDirectory()) await walk(path, into)
		else if (entry.isFile()) into.push(path)
	}
}

/**
 * Resolve files, directories and globs to a sorted, de-duplicated file list.
 * Directories contribute every file with one of `extensions`; hidden
 * directories and node_modules / dist / build / coverage are not searched.
 */
export async function expandPatterns(
	patterns: readonly string[],
	extensions: readonly string[],
	cwd = process.cwd(),
): Promise<string[]> {
	const found = new Set<string>()
	const wanted = (path: string): boolean => extensions.some((ext) => path.endsWith(ext))
	for (const pattern of patterns) {
		const normalized = pattern.replace(/\\/g, "/")
		if (!GLOB_CHARS.test(normalized)) {
			const path = resolve(cwd, normalized)
			const info = await stat(path).catch(() => null)
			if (info === null) throw new Error(`No such file or directory: ${pattern}`)
			if (info.isDirectory()) {
				const files: string[] = []
				await walk(path, files)
				for (const file of files) if (wanted(file)) found.add(file)
			} else found.add(path)
			continue
		}
		const segments = normalized.split("/")
		const firstGlob = segments.findIndex((s) => GLOB_CHARS.test(s))
		const base = resolve(cwd, segments.slice(0, firstGlob).join("/") || ".")
		const matcher = globToRegExp(segments.slice(firstGlob).join("/"))
		const files: string[] = []
		await walk(base, files)
		for (const file of files) {
			if (matcher.test(relative(base, file).split("\\").join("/"))) found.add(file)
		}
	}
	return [...found].sort()
}

// ── Worker contract check ─────────────────────────────────────────────────────

/** A job type string found in worker source, with where it was found. */
export interface WorkerRegistration {
	type: string
	file: string
	line: number
}

/**
 * Source patterns that register a job worker, each capturing the job type
 * string literal. Heuristic by design: only literal types are seen.
 */
const WORKER_PATTERNS: readonly RegExp[] = [
	// createWorker("type", …) / createWorker<…>("type", …) — zeebe-node style
	/\bcreateWorker\s*(?:<[^>()]*>)?\s*\(\s*(["'`])([^"'`\n]+)\1/g,
	// { taskType: "type" } — zeebe-node object form, @camunda8/sdk
	/\btaskType\s*:\s*(["'`])([^"'`\n]+)\1/g,
	// .createJobWorker({ …, jobType: "type" }) or { type: "type" } — @camunda8/orchestration-cluster-api
	/\.createJobWorker\s*\(\s*\{[^}]*?\b(?:jobType|type)\s*:\s*(["'`])([^"'`\n]+)\1/g,
	// registerJobWorker("type", …)
	/\bregisterJobWorker\s*\(\s*(["'`])([^"'`\n]+)\1/g,
	// client.poll("type") — @bpmnkit/worker-client
	/\.poll\s*(?:<[^>()]*>)?\s*\(\s*(["'`])([^"'`\n]+)\1/g,
]

/** Find the job types a TS/JS source file registers workers for. */
export function findWorkerRegistrations(source: string, file: string): WorkerRegistration[] {
	const found: WorkerRegistration[] = []
	for (const pattern of WORKER_PATTERNS) {
		for (const match of source.matchAll(pattern)) {
			const type = match[2] as string
			// A template literal with a placeholder is not a static job type.
			if (type.includes("${")) continue
			const offset = (match.index ?? 0) + match[0].lastIndexOf(type)
			const line = source.slice(0, offset).split("\n").length
			found.push({ type, file, line })
		}
	}
	return found.sort((a, b) => a.line - b.line || (a.type < b.type ? -1 : 1))
}

/** Job types run by Camunda's own connector runtime rather than a worker you write. */
export const isCamundaConnectorType = (type: string): boolean => type.startsWith("io.camunda")

export interface WorkerContractReport {
	/** BPMN job types no worker registers (connector types excluded). */
	missingWorkers: Array<{ type: string; elements: string[] }>
	/** Worker registrations whose job type no BPMN element uses. */
	unknownWorkers: WorkerRegistration[]
	/** Connector job types left to the connector runtime. */
	connectorTypes: string[]
	matched: string[]
}

export function compareWorkerContract(
	jobs: ReadonlyArray<{ type: string; elements: string[] }>,
	registrations: readonly WorkerRegistration[],
): WorkerContractReport {
	const registered = new Set(registrations.map((r) => r.type))
	const modelled = new Set(jobs.map((j) => j.type))
	return {
		missingWorkers: jobs.filter((j) => !registered.has(j.type) && !isCamundaConnectorType(j.type)),
		unknownWorkers: registrations.filter((r) => !modelled.has(r.type)),
		connectorTypes: jobs.map((j) => j.type).filter(isCamundaConnectorType),
		matched: jobs.map((j) => j.type).filter((t) => registered.has(t)),
	}
}

// ── Command ───────────────────────────────────────────────────────────────────

/**
 * The arg parser gives a boolean flag the next token as its value
 * (`--check flows/a.bpmn`); hand such a token back to the positionals.
 */
function booleanFlag(flags: ParsedFlags, name: string, positional: string[]): boolean {
	const value = flags[name]
	if (typeof value === "string" || typeof value === "number") {
		positional.push(String(value))
		return true
	}
	return value === true
}

async function loadDefinitions(files: readonly string[]): Promise<BpmnDefinitions[]> {
	return Promise.all(
		files.map(async (file) => {
			try {
				return Bpmn.parse(await readFile(file, "utf-8"))
			} catch (error) {
				throw new Error(
					`Could not parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}),
	)
}

export const generateTypesCmd: Command = {
	name: "types",
	description:
		"Generate TypeScript types (job types, variables, headers, messages, error codes) from BPMN files",
	args: [
		{
			name: "files",
			description: "BPMN files, directories or globs (quote globs to skip shell expansion)",
			required: true,
		},
	],
	flags: [
		{
			name: "out",
			description: "Write the generated source to this file. Default: print to stdout.",
			type: "string",
			placeholder: "FILE",
		},
		{
			name: "check",
			description: "Exit 1 when --out is missing or out of date instead of writing it (for CI)",
			type: "boolean",
		},
		{
			name: "check-workers",
			description:
				"Compare BPMN job types with job workers registered in these TS/JS sources (glob or directory)",
			type: "string",
			placeholder: "GLOB",
		},
		{
			name: "strict",
			description: "With --check-workers: exit 1 when BPMN and workers disagree",
			type: "boolean",
		},
		{
			name: "format",
			description: "Report format for --check-workers",
			type: "string",
			enum: ["text", "json"],
			default: "text",
		},
	],
	examples: [
		{
			description: "Generate types for every process in a folder",
			command: "casen gen types processes/ --out src/generated/bpmn-types.ts",
		},
		{
			description: "Fail CI when the generated file is stale",
			command: 'casen gen types "processes/**/*.bpmn" --out src/generated/bpmn-types.ts --check',
		},
		{
			description: "Report job types without a worker, and workers without a job type",
			command: 'casen gen types processes/ --check-workers "src/**/*.ts" --strict',
		},
	],
	async run(ctx) {
		const positional = [...ctx.positional]
		const check = booleanFlag(ctx.flags, "check", positional)
		const strict = booleanFlag(ctx.flags, "strict", positional)
		const out = typeof ctx.flags.out === "string" ? ctx.flags.out : undefined
		const workersGlob =
			typeof ctx.flags["check-workers"] === "string" ? ctx.flags["check-workers"] : undefined

		if (positional.length === 0) {
			throw new Error(
				"Missing BPMN files. Usage: casen gen types <files|dirs|globs...> --out <file>",
			)
		}
		if (check && out === undefined) throw new Error("--check needs --out <file> to compare against")

		const files = await expandPatterns(positional, [".bpmn"])
		if (files.length === 0) throw new Error(`No .bpmn files matched: ${positional.join(" ")}`)
		const definitions = await loadDefinitions(files)

		if (out !== undefined) {
			const source = generateProcessTypes(definitions)
			const target = resolve(out)
			if (check) {
				const current = await readFile(target, "utf-8").catch(() => null)
				if (current !== source) {
					throw new Error(
						`${out} is ${current === null ? "missing" : "out of date"} — run casen gen types without --check to regenerate it.`,
					)
				}
				ctx.output.ok(`${out} is up to date (${files.length} BPMN file(s))`)
			} else {
				await mkdir(dirname(target), { recursive: true })
				await writeFile(target, source, "utf-8")
				ctx.output.ok(`Types for ${files.length} BPMN file(s) written to ${out}`)
			}
		} else if (workersGlob === undefined) {
			process.stdout.write(generateProcessTypes(definitions))
		}

		if (workersGlob === undefined) return

		const sources = await expandPatterns(
			workersGlob.split(",").map((p) => p.trim()),
			[".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"],
		)
		const registrations: WorkerRegistration[] = []
		for (const file of sources) {
			const text = await readFile(file, "utf-8")
			registrations.push(...findWorkerRegistrations(text, relative(process.cwd(), file)))
		}
		const jobs = extractProcessContract(definitions).jobs.map((job) => ({
			type: job.type,
			elements: job.elements.map((e) => `${e.processId}#${e.elementId}`),
		}))
		const report = compareWorkerContract(jobs, registrations)
		const mismatches = report.missingWorkers.length + report.unknownWorkers.length

		if (ctx.flags.format === "json") {
			ctx.output.print(report)
		} else {
			for (const job of report.missingWorkers) {
				ctx.output.info(`✗ no worker for job type "${job.type}" (${job.elements.join(", ")})`)
			}
			for (const worker of report.unknownWorkers) {
				ctx.output.info(
					`✗ worker for "${worker.type}" at ${worker.file}:${worker.line} matches no BPMN job type`,
				)
			}
			if (report.connectorTypes.length > 0) {
				ctx.output.info(
					`· ${report.connectorTypes.length} Camunda connector job type(s) left to the connector runtime`,
				)
			}
			const summary = `${report.matched.length} job type(s) matched, ${mismatches} mismatch(es) across ${sources.length} source file(s)`
			if (mismatches === 0) ctx.output.ok(summary)
			else ctx.output.info(summary)
		}

		if (strict && mismatches > 0) {
			throw new Error(`Worker contract check failed: ${mismatches} mismatch(es)`)
		}
	},
}

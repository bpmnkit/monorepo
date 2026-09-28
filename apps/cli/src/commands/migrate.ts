import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
	Bpmn,
	type Camunda7Finding,
	type Camunda7Report,
	type Camunda7Severity,
	convertCamunda7,
	exportPreserving,
} from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

/** Most work first: what cannot move, then what a person must finish, then what was done. */
const SEVERITY_ORDER: readonly Camunda7Severity[] = ["unsupported", "manual", "convertible"]

interface FileResult {
	file: string
	/** Where the converted model was written; null with --check or when the file failed. */
	output: string | null
	error?: string
	counts?: Camunda7Report["counts"]
	findings?: Camunda7Finding[]
}

/** `order.bpmn` → `order.c8.bpmn` beside it, or `<out>/order.bpmn` with `--out`. */
export function migratedPath(file: string, outDir: string | undefined): string {
	if (outDir !== undefined) return join(outDir, basename(file))
	const stem = file.endsWith(".bpmn") ? file.slice(0, -".bpmn".length) : file
	return `${stem}.c8.bpmn`
}

function formatText(results: FileResult[], check: boolean): string {
	const lines: string[] = []
	for (const result of results) {
		const target = result.output === null ? "" : ` → ${result.output}`
		lines.push(`${result.file}${target}`)
		if (result.error !== undefined) {
			lines.push(`  ✖ ${result.error}`, "")
			continue
		}
		const counts = result.counts ?? { convertible: 0, manual: 0, unsupported: 0 }
		lines.push(
			`  ${counts.convertible} convertible · ${counts.manual} manual · ${counts.unsupported} unsupported${check ? " (check only, nothing written)" : ""}`,
		)
		for (const severity of SEVERITY_ORDER) {
			const group = (result.findings ?? []).filter((finding) => finding.severity === severity)
			if (group.length === 0) continue
			lines.push("", `  ${severity.toUpperCase()}`)
			for (const finding of group) {
				lines.push(`    ${finding.elementId}  ${finding.construct}`)
				lines.push(`      ${finding.message}`)
				lines.push(`      → ${finding.suggestion}`)
			}
		}
		lines.push("")
	}
	return lines.join("\n")
}

const c7Cmd: Command = {
	name: "c7",
	aliases: ["camunda7"],
	description: "Convert Camunda 7 BPMN models to Camunda 8 and report what needs manual work",
	args: [
		{
			name: "files",
			description: "One or more Camunda 7 .bpmn files",
			required: true,
		},
	],
	flags: [
		{
			name: "out",
			description:
				"Directory to write converted files to, under their own names (default: <name>.c8.bpmn beside each input)",
			type: "string",
			placeholder: "DIR",
		},
		{
			name: "check",
			description:
				"Report only; write nothing and exit 1 if any manual or unsupported finding remains",
			type: "boolean",
		},
		{
			name: "format",
			description: "Report format",
			type: "string",
			enum: ["text", "json"],
			default: "text",
		},
		{
			name: "force",
			description: "Overwrite converted files that already exist",
			type: "boolean",
		},
	],
	examples: [
		{
			description: "Convert a model, writing order.c8.bpmn next to it",
			command: "casen migrate c7 order.bpmn",
		},
		{
			description: "Convert a directory's models into another directory",
			command: "casen migrate c7 models/*.bpmn --out c8-models",
		},
		{
			description: "Gate CI on models that still need manual migration work",
			command: "casen migrate c7 models/*.bpmn --check --format json",
		},
	],
	async run(ctx) {
		const files = [...ctx.positional]
		// The argument parser gives a bare boolean flag the next word as its value,
		// so `--check a.bpmn b.bpmn` arrives as check="a.bpmn": take the file back.
		const booleanFlag = (name: string): boolean => {
			const value = ctx.flags[name]
			if (typeof value === "string") files.unshift(value)
			return value === true || typeof value === "string"
		}
		const check = booleanFlag("check")
		const force = booleanFlag("force")
		if (files.length === 0) throw new Error("Missing required argument: <files...>")
		const format = ctx.flags.format ?? "text"
		if (format !== "text" && format !== "json") {
			throw new Error(`Unknown --format "${String(format)}" — use text or json`)
		}
		const outFlag = ctx.flags.out
		const outDir = typeof outFlag === "string" && outFlag.length > 0 ? outFlag : undefined

		const results: FileResult[] = []
		for (const file of files) {
			const output = migratedPath(file, outDir)
			try {
				const xml = await readFile(file, "utf-8")
				const { definitions, report } = convertCamunda7(Bpmn.parse(xml))
				const result: FileResult = {
					file,
					output: null,
					counts: report.counts,
					findings: report.findings,
				}
				if (!check) {
					if (existsSync(output) && !force) {
						throw new Error(`${output} already exists — pass --force to overwrite it`)
					}
					await mkdir(dirname(output), { recursive: true })
					await writeFile(output, exportPreserving(xml, definitions), "utf-8")
					result.output = output
				}
				results.push(result)
			} catch (error) {
				results.push({
					file,
					output: null,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		}

		ctx.output.print(format === "json" ? results : formatText(results, check))

		const failed = results.filter((result) => result.error !== undefined).length
		if (failed > 0) {
			throw new Error(
				`${failed} of ${results.length} file${results.length === 1 ? "" : "s"} could not be migrated`,
			)
		}
		if (check) {
			const open = results.reduce(
				(sum, result) => sum + (result.counts?.manual ?? 0) + (result.counts?.unsupported ?? 0),
				0,
			)
			if (open > 0) {
				throw new Error(
					`Migration check failed: ${open} manual or unsupported finding${open === 1 ? "" : "s"}`,
				)
			}
		}
	},
}

export const migrateGroup: CommandGroup = {
	name: "migrate",
	description: "Migrate models from other engines to Camunda 8",
	commands: [c7Cmd],
}

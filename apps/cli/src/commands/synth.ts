import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { applyConnectorTemplate } from "@bpmnkit/connectors"
import { Bpmn, compilePlan, mergePlan } from "@bpmnkit/core"
import type { ProcessPlan } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

async function readPlan(path: string): Promise<ProcessPlan> {
	const text = await readFile(resolve(path), "utf-8")
	return JSON.parse(text) as ProcessPlan
}

const synthCmd: Command = {
	name: "synth",
	description: "Compile a ProcessPlan JSON file into deployable, laid-out BPMN XML",
	args: [{ name: "plan", description: "Path to the ProcessPlan JSON file", required: true }],
	flags: [
		{
			name: "output",
			short: "o",
			description: "Output .bpmn file path (default: <plan>.bpmn)",
			type: "string",
		},
		{
			name: "merge",
			description: "Merge into an existing .bpmn file instead of creating a new one",
			type: "string",
		},
		{
			name: "json",
			description: "Print the result (problems + xml) as JSON instead of writing a file",
			type: "boolean",
		},
	],
	examples: [
		{ description: "Compile a plan to BPMN", command: "casen synth order-process.plan.json" },
		{
			description: "Extend an existing process",
			command: "casen synth delta.plan.json --merge order-process.bpmn",
		},
	],
	async run(ctx) {
		const planPath = ctx.positional[0]
		if (!planPath) throw new Error("Missing required argument: <plan>")

		const plan = await readPlan(planPath)
		const mergeTarget = typeof ctx.flags.merge === "string" ? ctx.flags.merge : undefined

		const result = mergeTarget
			? mergePlan(Bpmn.parse(await readFile(resolve(mergeTarget), "utf-8")), plan, {
					resolveConnector: applyConnectorTemplate,
				})
			: compilePlan(plan, { resolveConnector: applyConnectorTemplate })

		if (ctx.flags.json) {
			ctx.output.print(result)
			if (!result.xml) process.exitCode = 1
			return
		}

		if (result.problems.length > 0) {
			for (const p of result.problems) ctx.output.info(`✖ [${p.path}] ${p.message}`)
		}
		if (!result.xml) {
			throw new Error(`Compilation failed with ${result.problems.length} problem(s) — see above`)
		}

		const outputPath = resolve(
			typeof ctx.flags.output === "string"
				? ctx.flags.output
				: (mergeTarget ?? planPath.replace(/\.json$/, ".bpmn")),
		)
		await writeFile(outputPath, result.xml, "utf-8")

		if (result.problems.length > 0) {
			ctx.output.info(`\nWrote ${outputPath} with ${result.problems.length} problem(s) above.`)
			process.exitCode = 1
		} else {
			ctx.output.ok(`Wrote ${outputPath}`)
		}
	},
}

export const synthGroup: CommandGroup = {
	name: "synth",
	description:
		"Compile a ProcessPlan into deployable BPMN — the deterministic AI-generation pipeline",
	commands: [synthCmd],
}

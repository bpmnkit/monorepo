import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Bpmn, extractPlan } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

const extractCmd: Command = {
	name: "extract",
	description: "Lift an existing .bpmn file back into ProcessPlan JSON form",
	args: [{ name: "file", description: "Path to the .bpmn file", required: true }],
	flags: [
		{
			name: "output",
			short: "o",
			description: "Output .json file path (default: <file>.plan.json)",
			type: "string",
		},
	],
	examples: [{ description: "Extract a plan", command: "casen plan extract order-process.bpmn" }],
	async run(ctx) {
		const filePath = ctx.positional[0]
		if (!filePath) throw new Error("Missing required argument: <file>")

		const xml = await readFile(resolve(filePath), "utf-8")
		const defs = Bpmn.parse(xml)
		const { plan, unsupported } = extractPlan(defs)

		const outputPath = resolve(
			typeof ctx.flags.output === "string"
				? ctx.flags.output
				: `${filePath.replace(/\.bpmn$/, "")}.plan.json`,
		)
		await writeFile(outputPath, `${JSON.stringify(plan, null, "\t")}\n`, "utf-8")
		ctx.output.ok(`Wrote ${outputPath}`)

		if (unsupported.length > 0) {
			ctx.output.info(
				`\n${unsupported.length} element(s) could not be lifted — left out of the plan, not guessed at:`,
			)
			for (const u of unsupported) ctx.output.info(`  [${u.id}] (${u.type}) ${u.reason}`)
		}
	},
}

const PLAN_SCHEMA_SUMMARY = `ProcessPlan (version 1)
{
  "version": 1,
  "process": { "id": string, "name"?: string, "versionTag"?: string },
  "inputs"?: [{ "name": string, "type": string, "required"?: boolean, "description"?: string }],
  "steps": PlanStep[],
  "tests"?: PlanScenario[]
}

PlanStep.kind: "start" | "connector" | "serviceTask" | "userTask" | "businessRuleTask" |
  "scriptTask" | "sendTask" | "receiveTask" | "callActivity" | "aiAgent" | "gateway" |
  "subProcess" | "wait" | "end" | "raw"

Every step: { id?, name?, documentation?, errorBoundary?: { errorCode, steps }, timerBoundary?: {...} }
FEEL convention: a leading "=" makes a string a FEEL expression; without it, the value is literal.

steps[0] must be kind "start". "gateway" steps carry { gatewayType, branches: [{ condition?, default?, steps }] }.
"connector"/"aiAgent" tool steps reference a bundled Camunda template via { template, values } —
see \`casen connector search <query>\` / \`casen connector show <templateId>\` for available templates
and their required/optional input keys.

Full type definitions: packages/core/src/plan/types.ts in the bpmnkit monorepo.`

const schemaCmd: Command = {
	name: "schema",
	description: "Print the ProcessPlan format reference",
	async run(ctx) {
		ctx.output.info(PLAN_SCHEMA_SUMMARY)
	},
}

export const planGroup: CommandGroup = {
	name: "plan",
	description:
		"ProcessPlan authoring — extract an existing process, or print the plan format reference",
	commands: [extractCmd, schemaCmd],
}

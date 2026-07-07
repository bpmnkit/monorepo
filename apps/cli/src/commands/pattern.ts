import { ALL_PATTERNS, findPattern } from "@bpmnkit/patterns"
import type { Command, CommandGroup } from "../types.js"

const listCmd: Command = {
	name: "list",
	description: "List the built-in domain process patterns",
	examples: [{ description: "List all patterns", command: "casen pattern list" }],
	async run(ctx) {
		ctx.output.print(
			ALL_PATTERNS.map((p) => ({
				id: p.id,
				name: p.name,
				description: p.description,
				keywords: p.keywords,
			})),
		)
	},
}

const getCmd: Command = {
	name: "get",
	description: "Show a domain pattern's full context: readme, worker specs, and variations",
	args: [
		{
			name: "query",
			description: "Pattern id (e.g. invoice-approval) or a free-text description to match",
			required: true,
		},
	],
	examples: [
		{ description: "By id", command: "casen pattern get invoice-approval" },
		{ description: "By description", command: 'casen pattern get "employee onboarding"' },
	],
	async run(ctx) {
		const query = ctx.positional.join(" ")
		if (!query) throw new Error("Missing required argument: <query>")

		const pattern = findPattern(query)
		if (!pattern) {
			ctx.output.info(
				`No pattern matched "${query}". Run \`casen pattern list\` to see all patterns.`,
			)
			return
		}

		ctx.output.print({
			id: pattern.id,
			name: pattern.name,
			description: pattern.description,
			readme: pattern.readme,
			workers: pattern.workers,
			variations: pattern.variations,
			note: "`template` is a rough structural reference in an older compact-diagram shape, not a ProcessPlan — use the readme/workers as context when writing your own plan, don't paste the template in as-is.",
			template: pattern.template,
		})
	},
}

export const patternGroup: CommandGroup = {
	name: "pattern",
	description: "Look up built-in domain process patterns for AI-driven process generation",
	commands: [listCmd, getCmd],
}

import { access, mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import {
	ALL_TEMPLATES,
	TEMPLATE_CATEGORIES,
	getTemplate,
	templateFiles,
} from "@bpmnkit/patterns/templates"
import type { Command, CommandGroup } from "../types.js"

const CATEGORY_IDS = TEMPLATE_CATEGORIES.map((c) => c.id)

const listCmd: Command = {
	name: "list",
	description: "List the runnable process templates in the gallery",
	flags: [
		{
			name: "category",
			short: "c",
			description: "Only list templates in this category",
			type: "string",
			enum: CATEGORY_IDS,
		},
	],
	examples: [
		{ description: "List all templates", command: "casen template list" },
		{
			description: "Only the AI agent patterns",
			command: "casen template list --category ai-agents",
		},
	],
	async run(ctx) {
		const category = typeof ctx.flags.category === "string" ? ctx.flags.category : undefined
		if (category !== undefined && !CATEGORY_IDS.some((id) => id === category)) {
			throw new Error(`Unknown category "${category}". Choose one of: ${CATEGORY_IDS.join(", ")}`)
		}
		const templates = ALL_TEMPLATES.filter((t) => category === undefined || t.category === category)
		ctx.output.printList(
			templates.map((t) => ({ id: t.id, category: t.category, title: t.title })),
			[
				{ key: "id", header: "ID" },
				{ key: "category", header: "CATEGORY" },
				{ key: "title", header: "TITLE" },
			],
		)
	},
}

async function exists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false,
	)
}

const useCmd: Command = {
	name: "use",
	description:
		"Write a template's .bpmn, its .bpmn.tests.json scenarios and any .dmn/.form files into a directory",
	args: [
		{ name: "id", description: "Template id (see casen template list)", required: true },
		{ name: "dir", description: "Target directory (default: current directory)", default: "." },
	],
	flags: [
		{
			name: "force",
			short: "f",
			description: "Overwrite files that already exist",
			type: "boolean",
			default: false,
		},
	],
	examples: [
		{ description: "Into the current directory", command: "casen template use order-to-cash" },
		{ description: "Into a folder", command: "casen template use ai-agent-tool-loop processes/" },
	],
	async run(ctx) {
		const id = ctx.positional[0]
		if (!id) throw new Error("Missing required argument: <id>")
		const template = getTemplate(id)
		if (template === undefined) {
			throw new Error(`No template "${id}". Run \`casen template list\` to see all templates.`)
		}

		const dir = resolve(ctx.positional[1] ?? ".")
		const files = templateFiles(template)
		if (ctx.flags.force !== true) {
			const taken: string[] = []
			for (const file of files) {
				if (await exists(join(dir, file.path))) taken.push(file.path)
			}
			if (taken.length > 0) {
				throw new Error(`${taken.join(", ")} already exist in ${dir}. Pass --force to overwrite.`)
			}
		}

		await mkdir(dir, { recursive: true })
		for (const file of files) {
			await writeFile(join(dir, file.path), file.content, "utf-8")
			ctx.output.ok(`Wrote ${join(dir, file.path)}`)
		}
		ctx.output.info(
			`${template.title} — ${template.scenarios.length} scenarios in ${id}.bpmn.tests.json`,
		)
		ctx.output.info(`Gallery page: https://bpmnkit.com/templates/${id}`)
		ctx.output.info("Deploy each file with: casen deploy deploy <file> --target camunda8")
	},
}

export const templateGroup: CommandGroup = {
	name: "template",
	description: "Start from a runnable process template: BPMN, test scenarios, DMN and forms",
	commands: [listCmd, useCmd],
}

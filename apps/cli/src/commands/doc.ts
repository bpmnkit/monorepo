import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import {
	Bpmn,
	Dmn,
	type DmnDefinitions,
	Form,
	type FormDefinition,
	renderDocumentationDocx,
	renderDocumentationHtml,
	renderDocumentationMarkdown,
} from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

const FORMATS = ["html", "md", "docx"] as const
type Format = (typeof FORMATS)[number]

const docExportCmd: Command = {
	name: "export",
	description:
		"Write process documentation for a BPMN file — diagram, every step in flow order, and the DMN tables and forms passed alongside",
	args: [
		{ name: "file", description: "Path to the .bpmn file", required: true },
		{
			name: "linked",
			description: "Optional .dmn and .form files to document with it (decisions, forms)",
		},
	],
	flags: [
		{
			name: "format",
			description: "html (print-ready; Print → Save as PDF), md, or docx",
			type: "string",
			default: "html",
			enum: [...FORMATS],
		},
		{
			name: "out",
			description: "Output path (default: <file>.<format> next to the input)",
			type: "string",
		},
		{
			name: "title",
			description: "Document title (default: the pool or process name)",
			type: "string",
		},
		{
			name: "paper",
			description: "Page size for docx: a4 (default) or letter",
			type: "string",
			enum: ["a4", "letter"],
		},
	],
	examples: [
		{ description: "Print-ready HTML", command: "casen doc export order.bpmn" },
		{
			description: "Word, with the decision and form the process links to",
			command: "casen doc export order.bpmn credit.dmn review.form --format docx",
		},
		{
			description: "Markdown for a wiki",
			command: "casen doc export order.bpmn --format md --out README.md",
		},
	],
	async run(ctx) {
		const [file, ...linked] = ctx.positional
		if (!file) throw new Error("Missing required argument: <file>")
		const format = String(ctx.flags.format ?? "html") as Format
		if (!FORMATS.includes(format)) {
			throw new Error(`Unknown --format "${format}". Use one of: ${FORMATS.join(", ")}`)
		}
		const paper = ctx.flags.paper ?? "a4"
		if (paper !== "a4" && paper !== "letter") {
			throw new Error(`Unknown --paper "${String(paper)}". Use a4 or letter`)
		}

		const decisions: DmnDefinitions[] = []
		const forms: FormDefinition[] = []
		for (const path of linked) {
			const ext = extname(path).toLowerCase()
			if (ext === ".dmn") decisions.push(Dmn.parse(await readFile(path, "utf-8")))
			else if (ext === ".form") forms.push(Form.parse(await readFile(path, "utf-8")))
			else throw new Error(`${path}: only .dmn and .form files can be documented with a process`)
		}

		const defs = Bpmn.parse(await readFile(file, "utf-8"))
		const title = typeof ctx.flags.title === "string" ? ctx.flags.title : undefined
		const options = { decisions, forms, title }
		const out =
			typeof ctx.flags.out === "string" && ctx.flags.out.length > 0
				? ctx.flags.out
				: `${file.replace(/\.bpmn$/i, "")}.${format}`

		if (format === "docx")
			await writeFile(out, renderDocumentationDocx(defs, { ...options, paper }))
		else if (format === "md")
			await writeFile(out, renderDocumentationMarkdown(defs, options), "utf-8")
		else await writeFile(out, renderDocumentationHtml(defs, options), "utf-8")

		ctx.output.ok(`Documentation written to ${out}`)
	},
}

export const docGroup: CommandGroup = {
	name: "doc",
	description: "Export process documentation (HTML for print/PDF, Markdown, Word) from BPMN files",
	commands: [docExportCmd],
}

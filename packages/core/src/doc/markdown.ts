import type { BpmnDefinitions } from "../bpmn/bpmn-model.js"
import {
	type DocumentationOptions,
	type DocumentedProcess,
	type DocumentedProperty,
	type ProcessDocumentation,
	buildProcessDocumentation,
} from "./model.js"

/**
 * Escapes text for Markdown that wikis may render as HTML: markup characters
 * become entities, Markdown syntax is backslash-escaped, and line starts that
 * would open a heading, quote or list are neutralised.
 */
function md(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/[\\`*_[\]|~]/g, "\\$&")
		.replace(/^(\s*)([#+-]|\d+\.)/gm, "$1\\$2")
}

/** A table cell: one line, pipes escaped. */
function cell(s: string): string {
	return md(s).replace(/\r?\n/g, "<br>")
}

function code(s: string): string {
	// A code span shows its content literally — renderers escape markup inside
	// it themselves — so only what breaks the span or the table needs handling:
	// backticks (longer fence) and pipes.
	const body = s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|")
	const fence = body.includes("`") ? "``" : "`"
	return `${fence}${fence.length > 1 ? " " : ""}${body}${fence.length > 1 ? " " : ""}${fence}`
}

function prose(s: string): string {
	return s
		.split(/\r?\n/)
		.map((line) => md(line))
		.join("  \n")
}

function value(v: string): string {
	return v.startsWith("=") ? code(v) : cell(v)
}

function propertyValue(p: DocumentedProperty): string {
	return Array.isArray(p.value) ? p.value.map(value).join("<br>") : value(p.value)
}

function table(head: string[], rows: string[][]): string[] {
	return [
		`| ${head.join(" | ")} |`,
		`| ${head.map(() => "---").join(" | ")} |`,
		...rows.map((r) => `| ${r.join(" | ")} |`),
	]
}

function processMd(p: DocumentedProcess): string[] {
	const out: string[] = [`## ${md(p.title)}`, ""]
	const meta = [`Process ID ${code(p.id)}`]
	if (p.participant) meta.push("drawn as a pool")
	meta.push(p.executable ? "executable" : "not executable")
	out.push(meta.join(" · "), "")
	if (p.documentation) out.push(prose(p.documentation), "")

	if (p.lanes.length > 0) {
		out.push("### Lanes and performers", "")
		out.push(
			...table(
				["Lane", "Responsible for"],
				p.lanes.map((l) => [
					cell([...l.path, l.name].join(" / ")),
					l.elements.length > 0 ? cell(l.elements.join(", ")) : "—",
				]),
			),
			"",
		)
	}

	if (p.elements.length === 0) {
		out.push("_This process has no elements._", "")
		return out
	}

	const laneCol = p.lanes.length > 0
	out.push("### Steps at a glance", "")
	out.push(
		...table(
			["#", "Name", "Type", ...(laneCol ? ["Lane"] : [])],
			p.elements.map((el) => [
				el.number,
				cell(el.name ?? el.id),
				cell(el.typeLabel),
				...(laneCol ? [cell(el.lane ?? "")] : []),
			]),
		),
		"",
	)

	out.push("### Step details", "")
	for (const el of p.elements) {
		out.push(`#### ${el.number} ${md(el.name ?? el.id)}`, "", `_${md(el.typeLabel)}_`, "")
		if (el.documentation) out.push(prose(el.documentation), "")
		const rows: string[][] = []
		if (el.lane) rows.push(["Lane", cell(el.lane)])
		for (const prop of el.properties) rows.push([cell(prop.label), propertyValue(prop)])
		rows.push(["ID", code(el.id)])
		out.push(...table(["Property", "Value"], rows), "")
	}
	return out
}

/** Renders already-built documentation as Markdown (GitHub-flavoured tables). */
export function documentationToMarkdown(doc: ProcessDocumentation): string {
	const out: string[] = [`# ${md(doc.title)}`, ""]
	if (doc.subtitle) out.push(md(doc.subtitle), "")
	if (doc.documentation) out.push(prose(doc.documentation), "")

	out.push("## Contents", "")
	for (const p of doc.processes) out.push(`- ${md(p.title)}`)
	if (doc.messageFlows.length > 0) out.push("- Message flows")
	if (doc.decisions.length > 0) out.push("- Decisions")
	if (doc.forms.length > 0) out.push("- Forms")
	out.push("")

	for (const p of doc.processes) out.push(...processMd(p))

	if (doc.messageFlows.length > 0) {
		out.push("## Message flows", "")
		out.push(
			...table(
				["From", "To", "Message"],
				doc.messageFlows.map((m) => [cell(m.from), cell(m.to), cell(m.name ?? m.message ?? "")]),
			),
			"",
		)
	}

	if (doc.decisions.length > 0) {
		out.push("## Decisions", "")
		for (const d of doc.decisions) {
			out.push(`### ${md(d.name)}`, "")
			const meta = [`Decision ID ${code(d.id)}`, `hit policy ${md(d.hitPolicy)}`]
			if (d.calledBy.length > 0) meta.push(`called by ${md(d.calledBy.join(", "))}`)
			out.push(meta.join(" · "), "")
			out.push(
				...table(
					[
						"#",
						...d.inputs.map((i) => `When: ${cell(i)}`),
						...d.outputs.map((o) => `Then: ${cell(o)}`),
						"Note",
					],
					d.rules.map((r, i) => [
						String(i + 1),
						...r.map((c, j) => (j < r.length - 1 ? code(c) : cell(c))),
					]),
				),
				"",
			)
		}
	}

	if (doc.forms.length > 0) {
		out.push("## Forms", "")
		for (const f of doc.forms) {
			out.push(`### ${md(f.id)}`, "")
			if (f.usedBy.length > 0) out.push(`Shown by ${md(f.usedBy.join(", "))}`, "")
			if (f.fields.length === 0) {
				out.push("_This form has no input fields._", "")
				continue
			}
			out.push(
				...table(
					["Field", "Variable", "Type", "Required", "Options"],
					f.fields.map((field) => [
						cell(field.label),
						code(field.key),
						cell(field.type),
						field.required ? "Yes" : "No",
						cell(field.options),
					]),
				),
				"",
			)
		}
	}

	return `${out.join("\n").trimEnd()}\n`
}

/**
 * Renders a BPMN model as Markdown for wikis and Confluence imports: the same
 * sections as {@link renderDocumentationHtml}, without the diagram (Markdown
 * cannot carry an inline SVG portably — export it with `exportSvg` and link it).
 */
export function renderDocumentationMarkdown(
	defs: BpmnDefinitions,
	options?: DocumentationOptions,
): string {
	return documentationToMarkdown(buildProcessDocumentation(defs, { ...options, diagram: false }))
}

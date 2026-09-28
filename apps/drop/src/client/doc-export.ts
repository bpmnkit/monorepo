import {
	Bpmn,
	type DmnDefinitions,
	type FormDefinition,
	buildProcessDocumentation,
	documentationToDocx,
	documentationToHtml,
	documentationToMarkdown,
} from "@bpmnkit/core"

/** What the documentation dialog offers. `print` opens the HTML in a new tab. */
export type DocFormat = "print" | "html" | "md" | "docx"

export const DOC_FORMATS: readonly DocFormat[] = ["print", "html", "md", "docx"]

export function isDocFormat(value: string): value is DocFormat {
	return (DOC_FORMATS as readonly string[]).includes(value)
}

/** The drop's content a document is built from: one BPMN file plus every DMN and form next to it. */
export interface DocSources {
	/** File name of the BPMN file; the document is named after it. */
	filename: string
	xml: string
	decisions: DmnDefinitions[]
	forms: FormDefinition[]
}

/** Builds the document for `format`. Pure: the caller decides how the browser gets it. */
export function buildDropDocument(
	sources: DocSources,
	format: DocFormat,
): { name: string; blob: Blob } {
	const defs = Bpmn.parse(sources.xml)
	const base = `${sources.filename.replace(/\.bpmn$/i, "")}-documentation`
	const options = { decisions: sources.decisions, forms: sources.forms }
	if (format === "md") {
		const doc = buildProcessDocumentation(defs, { ...options, diagram: false })
		return {
			name: `${base}.md`,
			blob: new Blob([documentationToMarkdown(doc)], { type: "text/markdown;charset=utf-8" }),
		}
	}
	const doc = buildProcessDocumentation(defs, options)
	if (format === "docx") {
		const bytes = documentationToDocx(doc)
		return {
			name: `${base}.docx`,
			blob: new Blob([bytes.buffer as ArrayBuffer], {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}),
		}
	}
	return {
		name: `${base}.html`,
		blob: new Blob([documentationToHtml(doc)], { type: "text/html;charset=utf-8" }),
	}
}

/** Hands a built document to the browser: a new tab for `print` (download if blocked), else a download. */
export function deliverDocument(doc: { name: string; blob: Blob }, format: DocFormat): void {
	const url = URL.createObjectURL(doc.blob)
	if (format === "print" && window.open(url, "_blank")) {
		// The new tab loads the URL asynchronously; revoking at once would race it.
		setTimeout(() => URL.revokeObjectURL(url), 60_000)
		return
	}
	const a = document.createElement("a")
	a.href = url
	a.download = doc.name
	a.click()
	URL.revokeObjectURL(url)
}

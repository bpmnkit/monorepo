import {
	type BpmnDefinitions,
	type DocumentationOptions,
	buildProcessDocumentation,
	documentationToDocx,
	documentationToHtml,
	documentationToMarkdown,
} from "@bpmnkit/core"

/** `print` opens the HTML in a new tab, ready for Print → Save as PDF; the others download. */
export type DocumentationFormat = "print" | "html" | "md" | "docx"

const TYPES = {
	html: "text/html;charset=utf-8",
	md: "text/markdown;charset=utf-8",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const

function fileBase(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
	return `${slug || "process"}-documentation`
}

function download(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

/**
 * Builds the process documentation for `defs` in `format` and hands it to the
 * browser: a new tab for `print`, a download otherwise. A blocked pop-up falls
 * back to downloading the same HTML.
 */
export function exportDocumentation(
	defs: BpmnDefinitions,
	format: DocumentationFormat,
	options: DocumentationOptions = {},
): void {
	if (format === "md") {
		const doc = buildProcessDocumentation(defs, { ...options, diagram: false })
		download(
			new Blob([documentationToMarkdown(doc)], { type: TYPES.md }),
			`${fileBase(doc.title)}.md`,
		)
		return
	}
	const doc = buildProcessDocumentation(defs, options)
	if (format === "docx") {
		const bytes = documentationToDocx(doc)
		download(
			new Blob([bytes.buffer as ArrayBuffer], { type: TYPES.docx }),
			`${fileBase(doc.title)}.docx`,
		)
		return
	}
	const blob = new Blob([documentationToHtml(doc)], { type: TYPES.html })
	if (format === "print") {
		const url = URL.createObjectURL(blob)
		const tab = window.open(url, "_blank")
		if (tab) {
			// The new tab loads the URL asynchronously; revoking at once would race it.
			setTimeout(() => URL.revokeObjectURL(url), 60_000)
			return
		}
		URL.revokeObjectURL(url)
	}
	download(blob, `${fileBase(doc.title)}.html`)
}

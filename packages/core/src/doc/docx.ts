import type { BpmnDefinitions } from "../bpmn/bpmn-model.js"
import {
	type DocumentationOptions,
	type DocumentedProcess,
	type ProcessDocumentation,
	buildProcessDocumentation,
} from "./model.js"
import { zipStore } from "./zip.js"

/** Options for {@link renderDocumentationDocx}. */
export interface DocxDocumentationOptions extends DocumentationOptions {
	/** Page size. Default `"a4"`. */
	paper?: "a4" | "letter"
}

// Page sizes in twentieths of a point (twips).
const PAPER = {
	a4: { w: 11906, h: 16838 },
	letter: { w: 12240, h: 15840 },
} as const
const MARGIN = 1134 // 20 mm
const EMU_PER_TWIP = 635

const W_NS =
	'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point — Word rejects a file that contains them.
const XML_FORBIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g

/** XML-escapes text and drops the control characters XML 1.0 cannot carry. */
function x(s: string): string {
	return s
		.replace(XML_FORBIDDEN, "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

interface RunStyle {
	bold?: boolean
	italic?: boolean
	mono?: boolean
	muted?: boolean
}

function run(text: string, style: RunStyle = {}): string {
	const props: string[] = []
	if (style.bold) props.push("<w:b/>")
	if (style.italic) props.push("<w:i/>")
	if (style.mono) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>')
	if (style.muted) props.push('<w:color w:val="4A5058"/>')
	const rPr = props.length > 0 ? `<w:rPr>${props.join("")}</w:rPr>` : ""
	const lines = text.split(/\r?\n/)
	const body = lines
		.map((l, i) => `${i > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${x(l)}</w:t>`)
		.join("")
	return `<w:r>${rPr}${body}</w:r>`
}

function para(content: string, style?: string, keepNext = false): string {
	const pPr: string[] = []
	if (style) pPr.push(`<w:pStyle w:val="${style}"/>`)
	if (keepNext) pPr.push("<w:keepNext/>")
	return `<w:p>${pPr.length > 0 ? `<w:pPr>${pPr.join("")}</w:pPr>` : ""}${content}</w:p>`
}

function text(s: string, style?: string, runStyle?: RunStyle): string {
	return para(run(s, runStyle), style)
}

type Cell = string | string[]

function tableXml(head: string[], rows: Cell[][], widths?: number[]): string {
	const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
		.map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="D9DBDF"/>`)
		.join("")
	const grid = widths
		? `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`
		: ""
	const cellXml = (content: Cell, header: boolean, i: number) => {
		const width = widths?.[i] ? `<w:tcW w:w="${widths[i]}" w:type="dxa"/>` : ""
		const shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="ECEEF1"/>' : ""
		// Several values in one cell become one paragraph each.
		const lines = Array.isArray(content) ? content : [content]
		const paras = lines.map((l) => para(run(l, header ? { bold: true } : {}), "TableText")).join("")
		return `<w:tc><w:tcPr>${width}${shade}</w:tcPr>${paras}</w:tc>`
	}
	const headRow = `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${head.map((h, i) => cellXml(h, true, i)).join("")}</w:tr>`
	const bodyRows = rows
		.map(
			(r) =>
				`<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cellXml(c, false, i)).join("")}</w:tr>`,
		)
		.join("")
	return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${grid}${headRow}${bodyRows}</w:tbl>${para("")}`
}

function sectPr(paper: { w: number; h: number }, landscape: boolean): string {
	const size = landscape
		? `<w:pgSz w:w="${paper.h}" w:h="${paper.w}" w:orient="landscape"/>`
		: `<w:pgSz w:w="${paper.w}" w:h="${paper.h}"/>`
	return `<w:sectPr>${size}<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`
}

function diagramXml(svg: string, paper: { w: number; h: number }): string {
	const w = Number(/\bwidth="([\d.]+)"/.exec(svg)?.[1] ?? 0)
	const h = Number(/\bheight="([\d.]+)"/.exec(svg)?.[1] ?? 0)
	if (!(w > 0 && h > 0)) return ""
	// Landscape page, less margins and room for the heading.
	const maxW = (paper.h - 2 * MARGIN) * EMU_PER_TWIP
	const maxH = (paper.w - 2 * MARGIN - 1200) * EMU_PER_TWIP
	const px = 9525 // EMU per CSS pixel
	const scale = Math.min(1, maxW / (w * px), maxH / (h * px))
	const cx = Math.round(w * px * scale)
	const cy = Math.round(h * px * scale)
	// The SVG is referenced from both the plain blip and the Office SVG
	// extension (the one Word writes itself). The spec wants a bitmap in the
	// plain blip as a fallback for readers without SVG support; rasterising
	// needs a canvas this package does not have, so those readers get no image.
	const blip = `<a:blip r:embed="rIdDiagram"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rIdDiagram"/></a:ext></a:extLst></a:blip>`
	return para(
		`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Diagram"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="diagram.svg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill>${blip}<a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
	)
}

function processXml(p: DocumentedProcess): string[] {
	const out: string[] = [text(p.title, "Heading1")]
	const meta = [`Process ID ${p.id}`]
	if (p.participant) meta.push("drawn as a pool")
	meta.push(p.executable ? "executable" : "not executable")
	out.push(text(meta.join(" · "), undefined, { muted: true }))
	if (p.documentation) out.push(text(p.documentation))

	if (p.lanes.length > 0) {
		out.push(text("Lanes and performers", "Heading2"))
		out.push(
			tableXml(
				["Lane", "Responsible for"],
				p.lanes.map((l) => [[...l.path, l.name].join(" / "), l.elements.join(", ") || "—"]),
			),
		)
	}
	if (p.elements.length === 0) {
		out.push(text("This process has no elements.", undefined, { italic: true }))
		return out
	}
	const laneCol = p.lanes.length > 0
	out.push(text("Steps at a glance", "Heading2"))
	out.push(
		tableXml(
			["#", "Name", "Type", ...(laneCol ? ["Lane"] : [])],
			p.elements.map((el) => [
				el.number,
				el.name ?? el.id,
				el.typeLabel,
				...(laneCol ? [el.lane ?? ""] : []),
			]),
			laneCol ? [900, 3600, 2700, 2400] : [900, 4800, 3900],
		),
	)
	out.push(text("Step details", "Heading2"))
	for (const el of p.elements) {
		out.push(text(`${el.number}  ${el.name ?? el.id}`, "Heading3"))
		out.push(para(run(el.typeLabel, { italic: true, muted: true }), undefined, true))
		if (el.documentation) out.push(para(run(el.documentation), undefined, true))
		const rows: Cell[][] = []
		if (el.lane) rows.push(["Lane", el.lane])
		for (const prop of el.properties) rows.push([prop.label, prop.value])
		rows.push(["ID", el.id])
		out.push(tableXml(["Property", "Value"], rows, [2600, 7000]))
	}
	return out
}

function documentXml(doc: ProcessDocumentation, paper: { w: number; h: number }): string {
	const body: string[] = [
		text("PROCESS DOCUMENTATION", undefined, { muted: true }),
		text(doc.title, "Title"),
	]
	if (doc.subtitle) body.push(text(doc.subtitle, undefined, { muted: true }))
	if (doc.documentation) body.push(text(doc.documentation))

	const diagram = doc.diagramSvg ? diagramXml(doc.diagramSvg, paper) : ""
	if (diagram) {
		// The diagram gets a landscape section of its own; everything else is portrait.
		body.push(`<w:p><w:pPr>${sectPr(paper, false)}</w:pPr></w:p>`)
		body.push(text("Diagram", "Heading1"), diagram)
		body.push(`<w:p><w:pPr>${sectPr(paper, true)}</w:pPr></w:p>`)
	}

	doc.processes.forEach((p, i) => {
		if (i > 0 || !diagram) body.push(para('<w:r><w:br w:type="page"/></w:r>'))
		body.push(...processXml(p))
	})

	if (doc.messageFlows.length > 0) {
		body.push(text("Message flows", "Heading1"))
		body.push(
			tableXml(
				["From", "To", "Message"],
				doc.messageFlows.map((m) => [m.from, m.to, m.name ?? m.message ?? ""]),
			),
		)
	}
	if (doc.decisions.length > 0) {
		body.push(text("Decisions", "Heading1"))
		for (const d of doc.decisions) {
			body.push(text(d.name, "Heading2"))
			const meta = [`Decision ID ${d.id}`, `hit policy ${d.hitPolicy}`]
			if (d.calledBy.length > 0) meta.push(`called by ${d.calledBy.join(", ")}`)
			body.push(text(meta.join(" · "), undefined, { muted: true }))
			body.push(
				tableXml(
					[
						"#",
						...d.inputs.map((i) => `When: ${i}`),
						...d.outputs.map((o) => `Then: ${o}`),
						"Note",
					],
					d.rules.map((r, i) => [String(i + 1), ...r]),
				),
			)
		}
	}
	if (doc.forms.length > 0) {
		body.push(text("Forms", "Heading1"))
		for (const f of doc.forms) {
			body.push(text(f.id, "Heading2"))
			if (f.usedBy.length > 0)
				body.push(text(`Shown by ${f.usedBy.join(", ")}`, undefined, { muted: true }))
			if (f.fields.length === 0) {
				body.push(text("This form has no input fields.", undefined, { italic: true }))
				continue
			}
			body.push(
				tableXml(
					["Field", "Variable", "Type", "Required", "Options"],
					f.fields.map((field) => [
						field.label,
						field.key,
						field.type,
						field.required ? "Yes" : "No",
						field.options,
					]),
				),
			)
		}
	}

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W_NS}><w:body>${body.join("")}${sectPr(paper, false)}</w:body></w:document>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="14161A"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="160"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="D9DBDF"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="40"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="A8503A"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
</w:styles>`

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

function documentRels(withDiagram: boolean): string {
	const image = withDiagram
		? '<Relationship Id="rIdDiagram" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.svg"/>'
		: ""
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${image}</Relationships>`
}

/** Renders already-built documentation as the bytes of a Word (.docx) file. */
export function documentationToDocx(
	doc: ProcessDocumentation,
	paper: "a4" | "letter" = "a4",
): Uint8Array {
	const size = PAPER[paper]
	const enc = new TextEncoder()
	const document = documentXml(doc, size)
	const withDiagram = document.includes('r:embed="rIdDiagram"')
	const files = [
		{ name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
		{ name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
		{ name: "word/document.xml", data: enc.encode(document) },
		{ name: "word/styles.xml", data: enc.encode(STYLES) },
		{ name: "word/_rels/document.xml.rels", data: enc.encode(documentRels(withDiagram)) },
	]
	if (withDiagram && doc.diagramSvg) {
		// Label halos rely on `paint-order`, which Word and LibreOffice ignore:
		// the halo would be painted over the text and hide it.
		const svg = doc.diagramSvg.replace(/;paint-order:stroke;stroke:[^;"]+;stroke-width:[^;"]+/g, "")
		files.push({ name: "word/media/diagram.svg", data: enc.encode(svg) })
	}
	return zipStore(files)
}

/**
 * Renders a BPMN model as a Word document (.docx) with the same sections as
 * {@link renderDocumentationHtml}. Headings use Word's built-in heading styles,
 * so the navigation pane and an inserted table of contents pick them up. The
 * diagram is embedded as SVG on a landscape page, with no bitmap fallback:
 * readers without SVG support (Word before 2019) show no image.
 *
 * Returns the file's bytes: write them to disk or wrap them in a `Blob`.
 */
export function renderDocumentationDocx(
	defs: BpmnDefinitions,
	options: DocxDocumentationOptions = {},
): Uint8Array {
	return documentationToDocx(buildProcessDocumentation(defs, options), options.paper)
}

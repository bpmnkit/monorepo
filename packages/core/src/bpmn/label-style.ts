import type { XmlElement } from "../types/xml-element.js"
import type { BpmnDefinitions, BpmnDiLabel } from "./bpmn-model.js"

/**
 * The `dc:Font` of a `bpmndi:BPMNLabelStyle`. Every field is optional: an
 * attribute the file omits (or carries an unusable value for) is left unset,
 * and the renderer's default applies to it.
 */
export interface BpmnLabelFont {
	/** Font family (`name`), as written — may be a comma-separated list. */
	name?: string
	/** Font size (`size`), drawn as CSS pixels — DI coordinates are pixels. */
	size?: number
	isBold?: boolean
	isItalic?: boolean
	isUnderline?: boolean
	isStrikeThrough?: boolean
}

/** CSS values for a resolved label font, ready for inline styles or `ctx.font`. */
export interface LabelFontCss {
	fontFamily: string
	/** In px. */
	fontSize: number
	fontWeight: "normal" | "bold"
	fontStyle: "normal" | "italic"
	/** `"none"`, or `underline` / `line-through` / both. */
	textDecoration: string
}

const localName = (name: string): string => name.slice(name.indexOf(":") + 1)

function parseBool(v: string | undefined): boolean | undefined {
	if (v === "true" || v === "1") return true
	if (v === "false" || v === "0") return false
	return undefined
}

function parseFont(style: XmlElement): BpmnLabelFont {
	const font = style.children.find((c) => localName(c.name) === "Font")
	if (!font) return {}
	const a = font.attributes
	const out: BpmnLabelFont = {}
	const name = a.name?.trim()
	if (name) out.name = name
	const size = a.size === undefined ? Number.NaN : Number(a.size)
	if (Number.isFinite(size) && size > 0) out.size = size
	const bold = parseBool(a.isBold)
	if (bold !== undefined) out.isBold = bold
	const italic = parseBool(a.isItalic)
	if (italic !== undefined) out.isItalic = italic
	const underline = parseBool(a.isUnderline)
	if (underline !== undefined) out.isUnderline = underline
	const strike = parseBool(a.isStrikeThrough)
	if (strike !== undefined) out.isStrikeThrough = strike
	return out
}

/**
 * Indexes every `bpmndi:BPMNLabelStyle` in the document by id.
 *
 * Styles are owned by a `BPMNDiagram`, but a label's `labelStyle` is an id
 * reference, and ids are document-unique — so all diagrams are indexed and a
 * label may use a style defined under another diagram.
 */
export function collectLabelStyles(defs: BpmnDefinitions): Map<string, BpmnLabelFont> {
	const styles = new Map<string, BpmnLabelFont>()
	for (const diagram of defs.diagrams) {
		for (const child of diagram.unknownChildren ?? []) {
			if (localName(child.name) !== "BPMNLabelStyle") continue
			const id = child.attributes.id
			if (id) styles.set(id, parseFont(child))
		}
	}
	return styles
}

/**
 * The font a DI label is drawn in: the style its `labelStyle` attribute
 * references, or `undefined` for the renderer default.
 *
 * BPMN DI has no default label style on the diagram or plane and no
 * inheritance between labels, so a label without a (resolvable) `labelStyle`
 * gets the default. `labelStyle` is typed `xsd:QName`, so a prefixed value
 * (`di:LS1`) falls back to its local part.
 */
export function resolveLabelFont(
	label: BpmnDiLabel | undefined,
	styles: ReadonlyMap<string, BpmnLabelFont>,
): BpmnLabelFont | undefined {
	const ref = label?.unknownAttributes?.labelStyle?.trim()
	if (!ref) return undefined
	return styles.get(ref) ?? styles.get(localName(ref))
}

const GENERIC_FAMILIES = new Set([
	"serif",
	"sans-serif",
	"monospace",
	"cursive",
	"fantasy",
	"system-ui",
	"ui-serif",
	"ui-sans-serif",
	"ui-monospace",
	"ui-rounded",
	"math",
	"emoji",
	"fangsong",
])

/** Quotes one family name as a CSS string; generic keywords stay bare. */
function cssFamily(family: string): string {
	if (GENERIC_FAMILIES.has(family.toLowerCase())) return family.toLowerCase()
	const escaped = family.replace(/[\\"]/g, "\\$&").replace(/[\n\r\f]/g, " ")
	return `"${escaped}"`
}

/**
 * Converts a label font into CSS values. Missing fields take the defaults
 * given; the file's family (each entry of a comma-separated `name`, quoted)
 * goes in front of `defaultFamily`, which stays as the fallback stack.
 */
export function labelFontCss(
	font: BpmnLabelFont | undefined,
	defaultFamily: string,
	defaultSize: number,
): LabelFontCss {
	const families = (font?.name ?? "")
		.split(",")
		.map((f) => f.trim().replace(/^(["'])(.*)\1$/, "$2"))
		.filter((f) => f.length > 0)
		.map(cssFamily)
	const decorations: string[] = []
	if (font?.isUnderline) decorations.push("underline")
	if (font?.isStrikeThrough) decorations.push("line-through")
	return {
		fontFamily: [...families, defaultFamily].join(", "),
		fontSize: font?.size ?? defaultSize,
		fontWeight: font?.isBold ? "bold" : "normal",
		fontStyle: font?.isItalic ? "italic" : "normal",
		textDecoration: decorations.length > 0 ? decorations.join(" ") : "none",
	}
}

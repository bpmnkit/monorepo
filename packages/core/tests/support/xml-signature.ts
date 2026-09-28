/**
 * A structural signature of an XML document, computed without using
 * `src/xml/xml-parser.ts`.
 *
 * The round-trip gate exists to catch content that `Bpmn.parse()` →
 * `Bpmn.export()` drops. Computing the signature with the SDK's own parser
 * would make the gate blind to exactly the losses it is meant to find: anything
 * that parser discards would be missing from both sides of the comparison and
 * the diff would come back clean. So this module walks the raw text instead.
 *
 * The signature is deliberately order-independent. BPMN does not assign meaning
 * to the order of `flowElements` or of attributes, so a serialiser is free to
 * reorder them; dropping them is what matters.
 */

/** Counts keyed by a stable description of a structural feature. */
export type XmlSignature = Map<string, number>

interface XmlTag {
	name: string
	/** Attribute names and values, in document order. */
	attributes: Array<[name: string, value: string]>
	selfClosing: boolean
	closing: boolean
}

/** Namespace prefixes whose elements are diagram interchange, not model content. */
export const DI_PREFIXES = new Set(["bpmndi", "dc", "di", "bioc", "color"])

/**
 * The prefix every signature uses for a well-known namespace, whatever prefix the
 * document itself declared.
 *
 * A prefix is a local alias, not content: `<process>` under a default BPMN
 * namespace, `<semantic:process>` and `<bpmn:process>` are the same element, and a
 * writer that settles on one spelling has lost nothing. Names in any other
 * namespace are keyed by the URI itself, so a rename there is invisible too.
 */
const CANONICAL_PREFIXES: Record<string, string> = {
	"http://www.omg.org/spec/BPMN/20100524/MODEL": "bpmn",
	"http://www.omg.org/spec/BPMN/20100524/DI": "bpmndi",
	"http://www.omg.org/spec/DD/20100524/DC": "dc",
	"http://www.omg.org/spec/DD/20100524/DI": "di",
	"http://www.w3.org/2001/XMLSchema-instance": "xsi",
	"http://camunda.org/schema/zeebe/1.0": "zeebe",
	"http://camunda.org/schema/modeler/1.0": "modeler",
	"http://bpmn.io/schema/bpmn/biocolor/1.0": "bioc",
	"http://www.omg.org/spec/BPMN/non-normative/color/1.0": "color",
}

type Scope = Map<string, string>

/** The namespace URI a prefix (`""` for the default namespace) resolves to. */
function resolvePrefix(scopes: Scope[], prefix: string): string | undefined {
	for (let index = scopes.length - 1; index >= 0; index--) {
		const uri = scopes[index]?.get(prefix)
		if (uri !== undefined) return uri
	}
	return undefined
}

/**
 * Rewrites a qualified name to its canonical spelling. Unprefixed attributes are
 * in no namespace and stay as they are; an element or prefixed name whose prefix
 * is not declared also stays as written, so a malformed document still diffs.
 */
function canonicalName(scopes: Scope[], name: string, isAttribute: boolean): string {
	const colon = name.indexOf(":")
	if (colon === -1 && isAttribute) return name
	const prefix = colon === -1 ? "" : name.slice(0, colon)
	const local = colon === -1 ? name : name.slice(colon + 1)
	const uri = resolvePrefix(scopes, prefix)
	if (uri === undefined) return name
	const canonical = CANONICAL_PREFIXES[uri]
	return canonical === undefined ? `{${uri}}${local}` : `${canonical}:${local}`
}

function prefixOf(qualifiedName: string): string {
	const colon = qualifiedName.indexOf(":")
	return colon === -1 ? "" : qualifiedName.slice(0, colon)
}

/**
 * Splits an element's attribute section into names and values.
 *
 * Values may contain `>`, `/`, whitespace and the other quote character, so the
 * scan tracks quoting rather than splitting on whitespace.
 */
function readAttributes(source: string): Array<[string, string]> {
	const names: Array<[string, string]> = []
	let index = 0

	while (index < source.length) {
		while (index < source.length && /\s/.test(source[index] as string)) index++
		const start = index
		while (index < source.length && !/[\s=]/.test(source[index] as string)) index++
		if (index === start) break
		const name = source.slice(start, index)

		while (index < source.length && /\s/.test(source[index] as string)) index++
		if (source[index] !== "=") {
			// Valueless attribute: not legal in XML, but do not lose the name.
			names.push([name, ""])
			continue
		}
		index++
		while (index < source.length && /\s/.test(source[index] as string)) index++

		const quote = source[index]
		const valueStart = quote === '"' || quote === "'" ? index + 1 : index
		if (quote === '"' || quote === "'") {
			index++
			while (index < source.length && source[index] !== quote) index++
			names.push([name, source.slice(valueStart, index)])
			index++
		} else {
			while (index < source.length && !/\s/.test(source[index] as string)) index++
			names.push([name, source.slice(valueStart, index)])
		}
	}

	return names
}

/**
 * Walks the document, invoking `onTag` for each element and `onText` for each
 * run of character data. Comments, CDATA sections, processing instructions and
 * the doctype are skipped; CDATA content is reported as text.
 */
function scan(xml: string, onTag: (tag: XmlTag) => void, onText: (text: string) => void): void {
	let index = 0

	while (index < xml.length) {
		const next = xml.indexOf("<", index)

		if (next === -1) {
			onText(xml.slice(index))
			return
		}

		if (next > index) onText(xml.slice(index, next))

		if (xml.startsWith("<!--", next)) {
			const end = xml.indexOf("-->", next)
			index = end === -1 ? xml.length : end + 3
			continue
		}

		if (xml.startsWith("<![CDATA[", next)) {
			const end = xml.indexOf("]]>", next)
			const stop = end === -1 ? xml.length : end
			onText(xml.slice(next + 9, stop))
			index = end === -1 ? xml.length : end + 3
			continue
		}

		if (xml.startsWith("<?", next)) {
			const end = xml.indexOf("?>", next)
			index = end === -1 ? xml.length : end + 2
			continue
		}

		if (xml.startsWith("<!", next)) {
			const end = xml.indexOf(">", next)
			index = end === -1 ? xml.length : end + 1
			continue
		}

		// An element. Find its terminating `>`, respecting quoted values.
		let cursor = next + 1
		let quote: string | null = null
		while (cursor < xml.length) {
			const char = xml[cursor] as string
			if (quote !== null) {
				if (char === quote) quote = null
			} else if (char === '"' || char === "'") {
				quote = char
			} else if (char === ">") {
				break
			}
			cursor++
		}

		const raw = xml.slice(next + 1, cursor)
		const closing = raw.startsWith("/")
		const selfClosing = raw.endsWith("/")
		const body = raw.slice(closing ? 1 : 0, selfClosing ? -1 : undefined)
		const nameEnd = body.search(/[\s/]/)
		const name = nameEnd === -1 ? body : body.slice(0, nameEnd)

		if (name.length > 0) {
			onTag({
				name,
				attributes: closing ? [] : readAttributes(nameEnd === -1 ? "" : body.slice(nameEnd)),
				selfClosing,
				closing,
			})
		}

		index = cursor + 1
	}
}

export interface SignatureOptions {
	/** Drop diagram interchange from the signature. Default: false. */
	excludeDi?: boolean
}

/**
 * Builds the structural signature of a BPMN document.
 *
 * Four families of feature are counted, each a way content can go missing:
 *
 * - `element:<name>` — how many of each element exist.
 * - `attr:<element>@<name>` — which attributes each element carries.
 * - `child:<parent> > <child>` — where elements sit, so a surviving element
 *   that is reparented still registers as a change.
 * - `text:<element>` — elements with non-whitespace character data, which is
 *   how `bpmn:documentation` bodies and FEEL condition expressions are carried.
 */
export function xmlSignature(xml: string, options: SignatureOptions = {}): XmlSignature {
	const signature: XmlSignature = new Map()
	const stack: string[] = []
	const scopes: Scope[] = []
	let pendingText: { name: string; text: string } | null = null

	const bump = (key: string): void => {
		signature.set(key, (signature.get(key) ?? 0) + 1)
	}

	const ignored = (name: string): boolean =>
		options.excludeDi === true && DI_PREFIXES.has(prefixOf(name))

	const flushText = (): void => {
		if (pendingText === null) return
		if (pendingText.text.trim().length > 0 && !ignored(pendingText.name)) {
			bump(`text:${pendingText.name}`)
		}
		pendingText = null
	}

	scan(
		xml,
		(tag) => {
			flushText()

			if (tag.closing) {
				stack.pop()
				scopes.pop()
				return
			}

			const scope: Scope = new Map()
			for (const [attribute, value] of tag.attributes) {
				if (attribute === "xmlns") scope.set("", value)
				else if (attribute.startsWith("xmlns:")) scope.set(attribute.slice(6), value)
			}
			scopes.push(scope)
			const name = canonicalName(scopes, tag.name, false)

			if (!ignored(name)) {
				bump(`element:${name}`)
				for (const [attribute] of tag.attributes) {
					if (attribute === "xmlns" || attribute.startsWith("xmlns:")) continue
					bump(`attr:${name}@${canonicalName(scopes, attribute, true)}`)
				}
				const parent = stack[stack.length - 1]
				if (parent !== undefined) bump(`child:${parent} > ${name}`)
			}

			if (tag.selfClosing) {
				scopes.pop()
				return
			}

			stack.push(name)
			pendingText = { name, text: "" }
		},
		(text) => {
			if (pendingText !== null) pendingText.text += text
		},
	)

	flushText()
	return signature
}

/** One structural feature whose count changed between two documents. */
export interface SignatureChange {
	feature: string
	before: number
	after: number
}

/**
 * Compares two signatures. Returns one entry per feature whose count differs,
 * sorted by feature name so failures read consistently.
 */
export function diffSignatures(before: XmlSignature, after: XmlSignature): SignatureChange[] {
	const features = [...new Set([...before.keys(), ...after.keys()])].sort()

	return features
		.map((feature) => ({
			feature,
			before: before.get(feature) ?? 0,
			after: after.get(feature) ?? 0,
		}))
		.filter((change) => change.before !== change.after)
}

/** Renders a change the way the allow-list and failure output spell it. */
export function formatChange(change: SignatureChange): string {
	return `${change.feature}: ${change.before} -> ${change.after}`
}

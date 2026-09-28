/**
 * The slice of hast (https://github.com/syntax-tree/hast) this package produces.
 * Declared structurally so the package needs neither `@types/hast` nor unified.
 */
export interface HastText {
	type: "text"
	value: string
}

export interface HastElement {
	type: "element"
	tagName: string
	properties: Record<string, string | string[]>
	children: HastChild[]
}

export type HastChild = HastElement | HastText

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

/** Decodes the named entities HTML escapers emit, and every numeric one. */
export function decodeEntities(s: string): string {
	return s.replace(/&(?:(amp|lt|gt|quot|apos)|#(\d+)|#x([0-9a-f]+));/gi, (m, name, dec, hex) => {
		if (name) return ENTITIES[name.toLowerCase()] ?? m
		const code = dec ? Number(dec) : Number.parseInt(hex, 16)
		return code <= 0x10ffff ? String.fromCodePoint(code) : m
	})
}

/**
 * Parses markup this package generated into hast.
 *
 * Only for that markup: every attribute is double-quoted, text is escaped, and
 * there are no comments, doctypes or raw-text elements. It is not an HTML parser.
 *
 * Attribute names are kept as written (`stroke-width`, `aria-labelledby`); hast
 * tooling resolves them through `property-information`, which accepts attribute
 * names as well as property names.
 */
export function toHast(markup: string): HastChild[] {
	const root: HastElement = { type: "element", tagName: "root", properties: {}, children: [] }
	const stack: HastElement[] = [root]
	const token = /<\/([\w:-]+)>|<([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g
	for (const m of markup.matchAll(token)) {
		const parent = stack[stack.length - 1] ?? root
		const [, close, open, attrs, selfClosing, text] = m
		if (close) {
			if (stack.length > 1) stack.pop()
		} else if (open) {
			const properties: Record<string, string | string[]> = {}
			for (const a of (attrs ?? "").matchAll(/([\w:-]+)="([^"]*)"/g)) {
				const value = decodeEntities(a[2] ?? "")
				if (a[1] === "class") properties.className = value.split(/\s+/)
				else if (a[1]) properties[a[1]] = value
			}
			const el: HastElement = { type: "element", tagName: open, properties, children: [] }
			parent.children.push(el)
			if (!selfClosing) stack.push(el)
		} else if (text) {
			parent.children.push({ type: "text", value: decodeEntities(text) })
		}
	}
	return root.children
}

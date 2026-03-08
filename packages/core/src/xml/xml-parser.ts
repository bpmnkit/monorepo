import type { XmlElement } from "../types/xml-element.js";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse an XML string into an XmlElement tree.
 * Returns the root element with all namespace prefixes preserved.
 * @throws Error if the XML has no root element.
 */
export function parseXml(xml: string): XmlElement {
	const p = new XmlReader(xml);
	const root = p.parseDocument();
	if (!root) throw new Error("Failed to parse XML: no root element found");
	return root;
}

class XmlReader {
	private s: string;
	private i = 0;

	constructor(source: string) {
		this.s = source;
	}

	parseDocument(): XmlElement | undefined {
		let root: XmlElement | undefined;
		while (this.i < this.s.length) {
			this.skipWhitespace();
			if (this.i >= this.s.length) break;
			if (this.s[this.i] !== "<") {
				// text outside root — skip
				this.i++;
				continue;
			}
			if (this.startsWith("<?")) {
				this.skipPi();
			} else if (this.startsWith("<!--")) {
				this.skipComment();
			} else if (this.startsWith("<!")) {
				this.skipBang();
			} else {
				root = this.parseElement();
				break;
			}
		}
		return root;
	}

	private parseElement(): XmlElement {
		this.expect("<");
		const name = this.readName();
		const attributes: Record<string, string> = {};
		this.readAttributes(attributes);
		this.skipWhitespace();

		if (this.s[this.i] === "/" && this.s[this.i + 1] === ">") {
			// self-closing
			this.i += 2;
			return { name, attributes, children: [] };
		}

		this.expect(">");

		const children: XmlElement[] = [];
		let text: string | undefined;

		while (this.i < this.s.length) {
			if (this.startsWith("</")) break;

			if (this.s[this.i] === "<") {
				if (this.startsWith("<!--")) {
					this.skipComment();
				} else if (this.startsWith("<![CDATA[")) {
					const cd = this.readCData();
					text = text === undefined ? cd : text + cd;
				} else if (this.startsWith("<?")) {
					this.skipPi();
				} else {
					children.push(this.parseElement());
				}
			} else {
				const t = this.readText();
				if (t.length > 0) {
					text = text === undefined ? t : text + t;
				}
			}
		}

		// closing tag </name>
		this.expect("</");
		const closing = this.readName();
		if (closing !== name) {
			throw new Error(`Mismatched closing tag: expected </${name}>, got </${closing}>`);
		}
		this.skipWhitespace();
		this.expect(">");

		const el: XmlElement = { name, attributes, children };
		if (text !== undefined) el.text = text;
		return el;
	}

	private readAttributes(attrs: Record<string, string>): void {
		while (this.i < this.s.length) {
			this.skipWhitespace();
			const ch = this.s[this.i];
			if (ch === ">" || ch === "/") return;
			const key = this.readName();
			this.skipWhitespace();
			this.expect("=");
			this.skipWhitespace();
			const value = this.readAttrValue();
			attrs[key] = value;
		}
	}

	private readAttrValue(): string {
		const quote = this.s[this.i];
		if (quote !== '"' && quote !== "'") {
			throw new Error(`Expected quote at position ${this.i}`);
		}
		this.i++;
		const start = this.i;
		while (this.i < this.s.length && this.s[this.i] !== quote) {
			this.i++;
		}
		const value = this.s.substring(start, this.i);
		this.i++; // skip closing quote
		return decodeXmlEntities(value);
	}

	private readText(): string {
		const start = this.i;
		while (this.i < this.s.length && this.s[this.i] !== "<") {
			this.i++;
		}
		return decodeXmlEntities(this.s.substring(start, this.i));
	}

	private readName(): string {
		const start = this.i;
		while (this.i < this.s.length) {
			const c = this.s[this.i];
			if (
				c === " " ||
				c === "\t" ||
				c === "\n" ||
				c === "\r" ||
				c === ">" ||
				c === "/" ||
				c === "="
			)
				break;
			this.i++;
		}
		return this.s.substring(start, this.i);
	}

	private readCData(): string {
		this.i += 9; // skip <![CDATA[
		const end = this.s.indexOf("]]>", this.i);
		if (end === -1) throw new Error("Unterminated CDATA section");
		const text = this.s.substring(this.i, end);
		this.i = end + 3;
		return text;
	}

	private skipPi(): void {
		this.i += 2; // skip <?
		const end = this.s.indexOf("?>", this.i);
		this.i = end === -1 ? this.s.length : end + 2;
	}

	private skipComment(): void {
		this.i += 4; // skip <!--
		const end = this.s.indexOf("-->", this.i);
		this.i = end === -1 ? this.s.length : end + 3;
	}

	private skipBang(): void {
		// Skip <!DOCTYPE ...> and similar
		this.i += 2;
		let depth = 1;
		while (this.i < this.s.length && depth > 0) {
			if (this.s[this.i] === "<") depth++;
			else if (this.s[this.i] === ">") depth--;
			this.i++;
		}
	}

	private skipWhitespace(): void {
		while (this.i < this.s.length) {
			const c = this.s[this.i];
			if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") break;
			this.i++;
		}
	}

	private expect(str: string): void {
		if (!this.s.startsWith(str, this.i)) {
			throw new Error(`Expected "${str}" at position ${this.i}`);
		}
		this.i += str.length;
	}

	private startsWith(prefix: string): boolean {
		return this.s.startsWith(prefix, this.i);
	}
}

// ---------------------------------------------------------------------------
// Entity helpers
// ---------------------------------------------------------------------------

/** Decode XML predefined and numeric character entities in a string. */
function decodeXmlEntities(s: string): string {
	if (!s.includes("&")) return s;
	return s.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g, (m) => {
		if (m === "&amp;") return "&";
		if (m === "&lt;") return "<";
		if (m === "&gt;") return ">";
		if (m === "&quot;") return '"';
		if (m === "&apos;") return "'";
		if (m.startsWith("&#x")) return String.fromCodePoint(Number.parseInt(m.slice(3, -1), 16));
		return String.fromCodePoint(Number.parseInt(m.slice(2, -1), 10));
	});
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/**
 * Serialize an XmlElement tree to an XML string.
 * Produces a well-formed XML document with declaration.
 */
export function serializeXml(element: XmlElement): string {
	const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>\n'];
	writeElement(parts, element, 0);
	parts.push("\n");
	return parts.join("");
}

function writeElement(parts: string[], el: XmlElement, depth: number): void {
	const indent = "  ".repeat(depth);
	parts.push(indent, "<", el.name);

	for (const [key, value] of Object.entries(el.attributes)) {
		parts.push(" ", key, '="', escapeAttr(value), '"');
	}

	const hasChildren = el.children.length > 0;
	const hasText = el.text !== undefined;

	if (!hasChildren && !hasText) {
		parts.push("/>\n");
		return;
	}

	parts.push(">");

	if (hasText) {
		parts.push(escapeText(el.text as string));
	}

	if (hasChildren) {
		parts.push("\n");
		for (const child of el.children) {
			writeElement(parts, child, depth + 1);
		}
		parts.push(indent);
	}

	parts.push("</", el.name, ">\n");
}

function escapeAttr(value: string): string {
	let s = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
	// Re-encode whitespace that XML parsers would normalize in attribute values
	s = s.replaceAll("\n", "&#10;").replaceAll("\r", "&#13;").replaceAll("\t", "&#9;");
	return s;
}

function escapeText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

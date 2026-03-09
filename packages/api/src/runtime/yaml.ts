/**
 * Minimal YAML parser for Camunda client config files.
 * Handles block mappings, block sequences, inline arrays, all scalar types,
 * quoted strings, and comments. No external dependencies.
 */

type Scalar = string | number | boolean | null
// Use interface + JSON-like recursion to satisfy TS's circular type restrictions
export interface YamlObject {
	[key: string]: Scalar | YamlObject | YamlArray
}
interface YamlArray extends Array<Scalar | YamlObject | YamlArray> {}
type YamlValue = Scalar | YamlObject | YamlArray

interface Line {
	indent: number
	/** Trimmed content with inline comment stripped. */
	content: string
}

export function parseYaml(text: string): YamlObject {
	const lines = buildLines(text)
	const [value] = parseMapping(lines, 0, 0)
	return value
}

// ─── Preprocessing ────────────────────────────────────────────────────────────

function buildLines(text: string): Line[] {
	const result: Line[] = []
	for (const raw of text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
		let indent = 0
		for (const ch of raw) {
			if (ch === " ") indent++
			else if (ch === "\t") indent += 2
			else break
		}
		const content = stripInlineComment(raw.trim())
		if (content !== "") result.push({ indent, content })
	}
	return result
}

function stripInlineComment(s: string): string {
	let inSingle = false
	let inDouble = false
	for (let i = 0; i < s.length; i++) {
		const ch = s[i]
		if (ch === "'" && !inDouble) {
			inSingle = !inSingle
			continue
		}
		if (ch === '"' && !inSingle) {
			inDouble = !inDouble
			continue
		}
		if (ch === "#" && !inSingle && !inDouble && i > 0 && s[i - 1] === " ") {
			return s.slice(0, i).trimEnd()
		}
	}
	return s
}

// ─── Recursive parser ─────────────────────────────────────────────────────────

/** Parse a mapping block. Returns [object, nextPos]. */
function parseMapping(lines: Line[], startPos: number, baseIndent: number): [YamlObject, number] {
	const obj: YamlObject = {}
	let pos = startPos

	while (pos < lines.length) {
		const line = lines[pos]
		if (!line || line.indent < baseIndent) break
		if (line.indent > baseIndent) {
			// Indented line where we don't expect it — skip safely
			pos++
			continue
		}

		const [key, rest] = splitMappingKey(line.content)
		if (key === null) {
			pos++
			continue
		}
		pos++

		if (rest === null) {
			// Value is on following lines
			const next = lines[pos]
			if (!next || next.indent <= baseIndent) {
				obj[key] = null
				continue
			}
			const childIndent = next.indent
			if (next.content.startsWith("- ") || next.content === "-") {
				const [seq, nextPos] = parseSequence(lines, pos, childIndent)
				obj[key] = seq
				pos = nextPos
			} else {
				const [map, nextPos] = parseMapping(lines, pos, childIndent)
				obj[key] = map
				pos = nextPos
			}
		} else if (rest.startsWith("[")) {
			obj[key] = parseInlineArray(rest)
		} else {
			obj[key] = parseScalar(rest)
		}
	}

	return [obj, pos]
}

/** Parse a sequence block. Returns [array, nextPos]. */
function parseSequence(lines: Line[], startPos: number, baseIndent: number): [YamlValue[], number] {
	const arr: YamlValue[] = []
	let pos = startPos

	while (pos < lines.length) {
		const line = lines[pos]
		if (!line || line.indent < baseIndent) break
		if (!line.content.startsWith("- ") && line.content !== "-") break

		const itemText = line.content.slice(1).trimStart()
		pos++

		if (itemText === "") {
			const next = lines[pos]
			if (!next || next.indent <= baseIndent) {
				arr.push(null)
				continue
			}
			// Could be a nested mapping or sequence
			if (next.content.startsWith("- ") || next.content === "-") {
				const [child, nextPos] = parseSequence(lines, pos, next.indent)
				arr.push(child)
				pos = nextPos
			} else {
				const [child, nextPos] = parseMapping(lines, pos, next.indent)
				arr.push(child)
				pos = nextPos
			}
		} else if (itemText.startsWith("[")) {
			arr.push(parseInlineArray(itemText))
		} else {
			arr.push(parseScalar(itemText))
		}
	}

	return [arr, pos]
}

function parseInlineArray(text: string): YamlValue[] {
	let inner = text.trim()
	if (inner.startsWith("[")) inner = inner.slice(1)
	if (inner.endsWith("]")) inner = inner.slice(0, -1)
	if (!inner.trim()) return []
	return splitByComma(inner).map((item) => parseScalar(item.trim()))
}

// ─── Key extraction ───────────────────────────────────────────────────────────

/**
 * Split `key: value rest` → [key, "value rest"] or [key, null] for blank value.
 * Returns [null, null] if the line is not a mapping entry.
 */
function splitMappingKey(content: string): [string | null, string | null] {
	// Quoted key
	if (content.startsWith('"') || content.startsWith("'")) {
		const q = content[0] as string
		const close = content.indexOf(q, 1)
		if (close >= 0 && content[close + 1] === ":") {
			const key = content.slice(1, close)
			const after = content.slice(close + 2).trimStart()
			return [key, after || null]
		}
		return [null, null]
	}

	// Plain key — find `:` that is not part of `://`
	for (let i = 0; i < content.length; i++) {
		if (content[i] !== ":") continue
		const next = content[i + 1]
		if (next === "/" || next === ":") continue // skip :// and ::
		if (next !== " " && next !== undefined) continue // must be `: ` or end of string
		const key = content.slice(0, i).trim()
		if (!key) continue
		const after = content.slice(i + 1).trimStart()
		return [key, after || null]
	}
	return [null, null]
}

// ─── Scalar parsing ───────────────────────────────────────────────────────────

function parseScalar(s: string): Scalar {
	const str = s.trim()
	if (str === "" || str === "null" || str === "~") return null
	if (str === "true" || str === "yes" || str === "on") return true
	if (str === "false" || str === "no" || str === "off") return false

	if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
		return str
			.slice(1, -1)
			.replace(/\\n/g, "\n")
			.replace(/\\t/g, "\t")
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\")
	}
	if (str.startsWith("'") && str.endsWith("'") && str.length >= 2) {
		return str.slice(1, -1).replace(/''/g, "'")
	}

	if (/^-?\d+$/.test(str)) return Number.parseInt(str, 10)
	if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(str)) return Number.parseFloat(str)

	return str
}

function splitByComma(text: string): string[] {
	const parts: string[] = []
	let depth = 0
	let current = ""
	let inSingle = false
	let inDouble = false
	for (const ch of text) {
		if (ch === "'" && !inDouble) inSingle = !inSingle
		else if (ch === '"' && !inSingle) inDouble = !inDouble
		else if (!inSingle && !inDouble) {
			if (ch === "[" || ch === "{") depth++
			else if (ch === "]" || ch === "}") depth--
			else if (ch === "," && depth === 0) {
				parts.push(current.trim())
				current = ""
				continue
			}
		}
		current += ch
	}
	if (current.trim()) parts.push(current.trim())
	return parts
}

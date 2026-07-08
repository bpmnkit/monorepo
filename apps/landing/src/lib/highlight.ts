// Minimal TypeScript syntax highlighter for the landing page's code panels.
// Pure string in, HTML string out — safe to run both at Astro build time
// (generating CODE_HTML from CODE) and in the browser (the playground editor).

export function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function isAlpha(c: string): boolean {
	return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$"
}

function isAlphaNum(c: string): boolean {
	return isAlpha(c) || (c >= "0" && c <= "9")
}

const KEYWORDS = new Set([
	"import",
	"export",
	"const",
	"let",
	"var",
	"return",
	"new",
	"from",
	"function",
	"if",
	"else",
	"for",
	"of",
	"in",
	"true",
	"false",
	"null",
	"undefined",
	"class",
	"extends",
	"async",
	"await",
	"type",
	"interface",
	"try",
	"catch",
	"throw",
	"switch",
	"case",
	"break",
	"continue",
	"do",
	"while",
	"delete",
	"typeof",
	"instanceof",
	"void",
	"static",
	"get",
	"set",
	"default",
	"this",
	"super",
	"as",
])

export function tokenize(raw: string): string {
	let out = ""
	let i = 0
	const len = raw.length

	while (i < len) {
		const c = raw.charAt(i)

		// Line comment
		if (c === "/" && raw.charAt(i + 1) === "/") {
			let j = i
			while (j < len && raw.charAt(j) !== "\n") j++
			out += `<span class="comment">${esc(raw.slice(i, j))}</span>`
			i = j
			continue
		}

		// String literals: " ' `
		if (c === '"' || c === "'" || c === "`") {
			const quote = c
			let j = i + 1
			while (j < len) {
				const qc = raw.charAt(j)
				if (qc === "\\") {
					j += 2
					continue
				}
				if (qc === quote) {
					j++
					break
				}
				j++
			}
			out += `<span class="str">${esc(raw.slice(i, j))}</span>`
			i = j
			continue
		}

		// Identifier, keyword, or method call
		if (isAlpha(c)) {
			let j = i + 1
			while (j < len && isAlphaNum(raw.charAt(j))) j++
			const word = raw.slice(i, j)
			// Peek past whitespace — method call if followed by "("
			let k = j
			while (k < len && raw.charAt(k) === " ") k++
			// A word right after "." is a property/method access (e.g. Bpmn.export(...)),
			// where reserved words like "export" are valid names — never keywords there.
			const isMemberAccess = i > 0 && raw.charAt(i - 1) === "."
			// A word immediately followed by ":" is an object-literal key (e.g. { type: "oauth2" }),
			// not a keyword usage — reserved words like "type" are valid key names there.
			const isPropertyKey = raw.charAt(k) === ":"
			if (raw.charAt(k) === "(" && (isMemberAccess || !KEYWORDS.has(word))) {
				out += `<span class="fn">${esc(word)}</span>`
			} else if (!isMemberAccess && !isPropertyKey && KEYWORDS.has(word)) {
				out += `<span class="kw">${esc(word)}</span>`
			} else {
				out += esc(word)
			}
			i = j
			continue
		}

		out += esc(c)
		i++
	}

	return out
}

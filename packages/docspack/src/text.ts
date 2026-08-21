/** Tokenising, stemming and token counting — shared by the builder and the index. */

const CONSONANT = "[^aeiou][^aeiouy]*"
const VOWEL = "[aeiouy][aeiou]*"
const M_GT_0 = new RegExp(`^(${CONSONANT})?${VOWEL}${CONSONANT}`)
const M_EQ_1 = new RegExp(`^(${CONSONANT})?${VOWEL}${CONSONANT}(${VOWEL})?$`)
const M_GT_1 = new RegExp(`^(${CONSONANT})?(${VOWEL}${CONSONANT}){2,}`)
const HAS_VOWEL = new RegExp(`^(${CONSONANT})?[aeiouy]`)

const STEP2: Record<string, string> = {
	ational: "ate",
	tional: "tion",
	enci: "ence",
	anci: "ance",
	izer: "ize",
	bli: "ble",
	alli: "al",
	entli: "ent",
	eli: "e",
	ousli: "ous",
	ization: "ize",
	ation: "ate",
	ator: "ate",
	alism: "al",
	iveness: "ive",
	fulness: "ful",
	ousness: "ous",
	aliti: "al",
	iviti: "ive",
	biliti: "ble",
	logi: "log",
}
const STEP3: Record<string, string> = {
	icate: "ic",
	ative: "",
	alize: "al",
	iciti: "ic",
	ical: "ic",
	ful: "",
	ness: "",
}
const DOUBLE_END = /([^aeiouylsz])\1$/
const CVC = new RegExp(`^${CONSONANT}${VOWEL}[^aeiouwxy]$`)

/**
 * The Porter (1980) stemmer, so a query for `authenticate` reaches a chunk that
 * only ever says `authentication`. Both reduce to `authent`.
 */
export function stem(input: string): string {
	let w = input
	if (w.length < 3) return w

	// Step 1a — plurals.
	if (/sses$|ies$/.test(w)) w = w.slice(0, -2)
	else if (/[^s]s$/.test(w)) w = w.slice(0, -1)

	// Step 1b — past participles and gerunds.
	let restore = false
	if (/eed$/.test(w)) {
		if (M_GT_0.test(w.slice(0, -3))) w = w.slice(0, -1)
	} else {
		const stripped = /(ed|ing)$/.exec(w)
		if (stripped) {
			const base = w.slice(0, w.length - stripped[0].length)
			if (HAS_VOWEL.test(base)) {
				w = base
				restore = true
			}
		}
	}
	if (restore) {
		if (/(at|bl|iz)$/.test(w)) w += "e"
		else if (DOUBLE_END.test(w)) w = w.slice(0, -1)
		else if (M_EQ_1.test(w) && CVC.test(w)) w += "e"
	}

	// Step 1c — terminal y.
	if (/y$/.test(w) && HAS_VOWEL.test(w.slice(0, -1))) w = `${w.slice(0, -1)}i`

	// Steps 2 and 3 — derivational suffixes, longest match first.
	w = replaceSuffix(w, STEP2, M_GT_0)
	w = replaceSuffix(w, STEP3, M_GT_0)

	// Step 4 — strip the suffix outright when the stem is long enough.
	const tail =
		/(?:ion|ement|ance|ence|able|ible|ment|ant|ent|ism|ate|iti|ous|ive|ize|al|er|ic|ou)$/.exec(w)
	if (tail) {
		const base = w.slice(0, w.length - tail[0].length)
		// `-ion` only comes off a stem that kept the `s` or `t` in front of it.
		const removable = tail[0] === "ion" ? /[st]$/.test(base) : true
		if (removable && M_GT_1.test(base)) w = base
	}

	// Step 5 — terminal e and doubled l.
	if (/e$/.test(w)) {
		const base = w.slice(0, -1)
		if (M_GT_1.test(base) || (M_EQ_1.test(base) && !CVC.test(base))) w = base
	}
	if (/ll$/.test(w) && M_GT_1.test(w.slice(0, -1))) w = w.slice(0, -1)

	return w
}

function replaceSuffix(w: string, table: Record<string, string>, measure: RegExp): string {
	for (const [suffix, replacement] of Object.entries(table)) {
		if (!w.endsWith(suffix)) continue
		const base = w.slice(0, w.length - suffix.length)
		if (!measure.test(base)) continue
		return base + replacement
	}
	return w
}

/**
 * Words a query and a chunk share no meaning through: indexing them costs space
 * and matching on them ranks every chunk equally.
 */
export const STOP_WORDS: ReadonlySet<string> = new Set([
	"a",
	"about",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"but",
	"by",
	"can",
	"do",
	"does",
	"for",
	"from",
	"how",
	"i",
	"if",
	"in",
	"into",
	"is",
	"it",
	"its",
	"of",
	"on",
	"or",
	"our",
	"that",
	"the",
	"their",
	"then",
	"there",
	"these",
	"this",
	"to",
	"use",
	"using",
	"was",
	"what",
	"when",
	"where",
	"which",
	"who",
	"why",
	"will",
	"with",
	"you",
	"your",
])

/** Split text into lowercase word tokens, keeping the dots inside `a.b` identifiers. */
export function tokenize(text: string): string[] {
	return text.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? []
}

/** Tokenize, drop stop words, stem — the form both the index and a query use. */
export function terms(text: string): string[] {
	const out: string[] = []
	for (const token of tokenize(text)) {
		if (STOP_WORDS.has(token)) continue
		// `Bpmn.createProcess` is worth matching whole and by its parts.
		if (/[._-]/.test(token)) {
			out.push(token)
			for (const part of token.split(/[._-]+/)) {
				if (part.length > 1 && !STOP_WORDS.has(part)) out.push(stem(part))
			}
			continue
		}
		out.push(stem(token))
	}
	return out
}

/**
 * Approximate the token count of a string. Deterministic and close enough to
 * budget an answer against — docspack counts from the manifest before it reads
 * any content, so this must not need the content to be tokenised twice.
 */
export function estimateTokens(text: string): number {
	if (text.trim() === "") return 0
	const words = text.trim().split(/\s+/).length
	const punctuation = (text.match(/[^\w\s]/g) ?? []).length
	return Math.max(1, Math.round(words * 1.3 + punctuation * 0.3))
}

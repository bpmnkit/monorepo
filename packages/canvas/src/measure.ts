// Real text measurement for label layout, with an SSR/test-safe fallback.
//
// In a browser we measure with an offscreen canvas 2D context (accurate and
// fast, matching what bpmn-js does); where that is unavailable or unreliable
// (SSR, jsdom/happy-dom) we fall back to an average character-width estimate.

/** Approximate glyph width at the label font — the no-canvas fallback. */
const AVG_CHAR_PX = 6.5

/** Font used for internal/external labels (mirrors `.bpmnkit-label` in css.ts). */
const LABEL_FONT = "11px system-ui, -apple-system, sans-serif"

const estimate = (text: string): number => text.length * AVG_CHAR_PX

let _measure: ((text: string) => number) | null = null

/** Lazily resolves a measurer once, memoizing per unique string (bounded). */
function resolveMeasurer(): (text: string) => number {
	if (_measure) return _measure

	if (typeof document === "undefined") {
		_measure = estimate
		return _measure
	}

	let ctx: CanvasRenderingContext2D | null = null
	try {
		ctx = document.createElement("canvas").getContext("2d")
	} catch {
		ctx = null
	}
	// Fall back when the environment has no working canvas text metrics
	// (happy-dom/jsdom report 0-width) — keeps deterministic label wrapping.
	if (!ctx) {
		_measure = estimate
		return _measure
	}
	ctx.font = LABEL_FONT
	const probe = ctx.measureText("MMMM").width
	if (!probe || !Number.isFinite(probe)) {
		_measure = estimate
		return _measure
	}

	const context = ctx
	const cache = new Map<string, number>()
	_measure = (text: string): number => {
		let w = cache.get(text)
		if (w === undefined) {
			w = context.measureText(text).width
			if (cache.size >= 5000) cache.clear()
			cache.set(text, w)
		}
		return w
	}
	return _measure
}

/** Measures the rendered width (px) of `text` at the label font. */
export function measureTextWidth(text: string): number {
	return resolveMeasurer()(text)
}

/** Breaks a single word wider than `maxPx` into hyphenated chunks. */
function hyphenate(word: string, maxPx: number): string[] {
	const out: string[] = []
	let chunk = ""
	for (const ch of word) {
		const tentative = chunk + ch
		// Reserve room for a trailing hyphen while a chunk is still growing.
		if (chunk && measureTextWidth(`${tentative}-`) > maxPx) {
			out.push(`${chunk}-`)
			chunk = ch
		} else {
			chunk = tentative
		}
	}
	if (chunk) out.push(chunk)
	return out
}

/**
 * Splits `text` into lines that fit within `maxPx`, measuring each candidate.
 * A word wider than `maxPx` is broken mid-word with a hyphen (bpmn-js parity).
 */
export function wrapText(text: string, maxPx: number): string[] {
	if (!text.trim()) return []
	const words = text.split(/\s+/)
	const lines: string[] = []
	let line = ""

	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (measureTextWidth(candidate) <= maxPx) {
			line = candidate
			continue
		}
		// The candidate overflows: flush the current line first.
		if (line) {
			lines.push(line)
			line = ""
		}
		if (measureTextWidth(word) <= maxPx) {
			line = word
		} else {
			const chunks = hyphenate(word, maxPx)
			for (let i = 0; i < chunks.length - 1; i++) {
				const c = chunks[i]
				if (c) lines.push(c)
			}
			line = chunks[chunks.length - 1] ?? ""
		}
	}

	if (line) lines.push(line)
	return lines.length > 0 ? lines : [text]
}

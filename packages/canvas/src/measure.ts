// Real text measurement for label layout, with an SSR/test-safe fallback.
//
// In a browser we measure with an offscreen canvas 2D context (accurate and
// fast, matching what bpmn-js does); where that is unavailable or unreliable
// (SSR, jsdom/happy-dom) we fall back to an average character-width estimate.

import type { LabelFontCss } from "@bpmnkit/core"

/** Approximate glyph width at the label font — the no-canvas fallback. */
const AVG_CHAR_PX = 6.5

/** Default label font size (px) and family — mirrors `.bpmnkit-label` in css.ts. */
export const LABEL_FONT_SIZE = 11
export const LABEL_FONT_FAMILY = "system-ui, -apple-system, sans-serif"

/** Font used for internal/external labels without a DI label style. */
const LABEL_FONT = `${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`

/** The canvas `font` shorthand for a resolved label style. */
function fontShorthand(font: LabelFontCss | undefined): string {
	if (!font) return LABEL_FONT
	return `${font.fontStyle} ${font.fontWeight} ${font.fontSize}px ${font.fontFamily}`
}

/** No-canvas estimate, scaled from the 11px default by size and weight. */
function estimate(text: string, font: LabelFontCss | undefined): number {
	if (!font) return text.length * AVG_CHAR_PX
	const bold = font.fontWeight === "bold" ? 1.1 : 1
	return text.length * AVG_CHAR_PX * (font.fontSize / LABEL_FONT_SIZE) * bold
}

type Measurer = (text: string, font: LabelFontCss | undefined) => number

let _measure: Measurer | null = null

/** Lazily resolves a measurer once, memoizing per unique font + string (bounded). */
function resolveMeasurer(): Measurer {
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
	let current = LABEL_FONT
	const cache = new Map<string, number>()
	_measure = (text: string, font: LabelFontCss | undefined): number => {
		const shorthand = fontShorthand(font)
		const key = shorthand === LABEL_FONT ? text : `${shorthand}\n${text}`
		let w = cache.get(key)
		if (w === undefined) {
			if (current !== shorthand) {
				context.font = shorthand
				current = shorthand
			}
			w = context.measureText(text).width
			if (cache.size >= 5000) cache.clear()
			cache.set(key, w)
		}
		return w
	}
	return _measure
}

/** Measures the rendered width (px) of `text` at the label font, or at `font` when given. */
export function measureTextWidth(text: string, font?: LabelFontCss): number {
	return resolveMeasurer()(text, font)
}

/** Breaks a single word wider than `maxPx` into hyphenated chunks. */
function hyphenate(word: string, maxPx: number, font: LabelFontCss | undefined): string[] {
	const out: string[] = []
	let chunk = ""
	for (const ch of word) {
		const tentative = chunk + ch
		// Reserve room for a trailing hyphen while a chunk is still growing.
		if (chunk && measureTextWidth(`${tentative}-`, font) > maxPx) {
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
 * Splits `text` into lines that fit within `maxPx`, measuring each candidate
 * at the label font — or at `font`, a label's resolved DI label style.
 * A word wider than `maxPx` is broken mid-word with a hyphen (bpmn-js parity).
 */
export function wrapText(text: string, maxPx: number, font?: LabelFontCss): string[] {
	if (!text.trim()) return []
	const words = text.split(/\s+/)
	const lines: string[] = []
	let line = ""

	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (measureTextWidth(candidate, font) <= maxPx) {
			line = candidate
			continue
		}
		// The candidate overflows: flush the current line first.
		if (line) {
			lines.push(line)
			line = ""
		}
		if (measureTextWidth(word, font) <= maxPx) {
			line = word
		} else {
			const chunks = hyphenate(word, maxPx, font)
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

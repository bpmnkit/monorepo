/** Truncate `text` to at most `maxLen` characters, appending "…" when shortened. */
export function truncate(text: string, maxLen: number): string {
	if (maxLen <= 0) return ""
	if (text.length <= maxLen) return text
	if (maxLen === 1) return "…"
	return `${text.slice(0, maxLen - 1)}…`
}

/** Pad `text` with trailing spaces so the result is exactly `width` characters wide. */
export function padEnd(text: string, width: number): string {
	if (text.length >= width) return text.slice(0, width)
	return text + " ".repeat(width - text.length)
}

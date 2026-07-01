/**
 * Extracts the first BPMN XML block from LLM output.
 * Looks for <?xml...> through </bpmn:definitions> or </definitions>.
 */
export function extractXmlBlock(text: string): string | null {
	const match = text.match(/<\?xml[\s\S]*?<\/(?:bpmn:)?definitions>/)
	return match ? match[0] : null
}

/**
 * Extracts TypeScript code from LLM output.
 * Strips markdown fences if present; returns raw text if no fences found.
 * Returns null if no code detected (no fences and no recognizable TS patterns).
 */
export function extractTsBlock(text: string): string | null {
	const trimmed = text.trim()
	if (!trimmed) return null

	// Try to find a fenced code block (```ts, ```typescript, or ```)
	const fenced = trimmed.match(/^```(?:typescript|ts)?\n([\s\S]*?)\n```$/m)
	if (fenced) return fenced[1].trim()

	// Also check for mid-text fenced block
	const midFenced = trimmed.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/)
	if (midFenced) return midFenced[1].trim()

	// No fences — check if it looks like TS (contains keywords or syntax)
	const tsPatterns =
		/\b(import|export|const|let|var|function|interface|type|class|async|await|=>\s*|{\s*\w+|\w+\s*:\s*\w+)\b/
	if (tsPatterns.test(trimmed)) {
		return trimmed
	}

	// Plain text, not code
	return null
}

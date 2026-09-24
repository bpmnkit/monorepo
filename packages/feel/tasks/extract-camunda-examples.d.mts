/** A documented example that can be evaluated standalone. */
export interface CamundaCase {
	/** Stable key: the expression, whitespace collapsed, plus any binding. */
	id: string
	/** The docspack chunk the example comes from. */
	page: string
	/** The nearest heading above the example. */
	section: string
	/** The docs.camunda.io page. */
	source: string
	expression: string
	/** A FEEL context expression giving the variables, if the example needs any. */
	context: string | null
	/** The documented result as a FEEL literal; null when an error is expected. */
	expected: string | null
	error: boolean
	/** How the documented result was corrected to read as FEEL, if it was. */
	note: string | null
}

/** A documented example that cannot be evaluated standalone, and why. */
export interface SkippedExample {
	page: string
	section: string
	expression: string
	result: string | null
	reason: string
}

export const DEFAULT_CHUNKS_DIR: string

export function extractCamundaExamples(chunksDir?: string): {
	cases: CamundaCase[]
	skipped: SkippedExample[]
}

export function isFeelLiteral(text: string): boolean

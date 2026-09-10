/**
 * A diagram as monospaced text, for pasting somewhere a picture cannot go.
 *
 * A code review is a text medium. "Look at the diagram" means opening the file
 * in something that draws it, which a reviewer reading a pull request in a
 * browser tab will not do — so the diagram loses the argument to the XML diff
 * beside it. `@bpmnkit/ascii` renders the same layout as the canvas into
 * characters, which paste into a review comment, a commit message, or an issue.
 */

import { renderBpmnAscii } from "@bpmnkit/ascii"

/** How the rendering is wrapped for its destination. */
export type AsciiWrapper = "plain" | "fenced"

/** Removes the indent every line shares, keeping their alignment with each other. */
function dedent(lines: readonly string[]): string[] {
	const indents = lines
		.filter((line) => line.trim() !== "")
		.map((line) => line.length - line.trimStart().length)
	const margin = indents.length === 0 ? 0 : Math.min(...indents)
	return lines.map((line) => line.slice(margin))
}

/**
 * Renders a diagram, optionally inside a fenced code block.
 *
 * Fencing is the default for a reason: every destination this is meant for —
 * a review comment, an issue, a commit body rendered by a forge — collapses
 * runs of spaces unless the text is fenced, and a collapsed BPMN diagram is
 * noise rather than a diagram.
 *
 * The title is suppressed and the drawing dedented, in that order. The layout
 * places the diagram wherever its own coordinates fall, which for a real
 * process is tens of columns from the left; with a title line sitting at column
 * zero there is no shared indent to remove, so the title has to go first for
 * the dedent to mean anything. Nothing is lost — the reader already knows which
 * file this came from.
 *
 * @param xml - The diagram source.
 * @param wrapper - `fenced` wraps in a ```text block; `plain` leaves it bare.
 */
export function renderForPaste(xml: string, wrapper: AsciiWrapper = "fenced"): string {
	const art = dedent(renderBpmnAscii(xml, { title: false }).split("\n"))
		.join("\n")
		.replace(/^\n+/, "")
		.replace(/\s+$/, "")
	return wrapper === "plain" ? art : ["```text", art, "```"].join("\n")
}

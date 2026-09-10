/**
 * Keeping a visual editor and a text document from talking over each other.
 *
 * Both sides can change the same file. The webview edits the diagram and the
 * document must follow; the user edits the XML — or reverts it, or checks out
 * a branch — and the diagram must follow. Wire those two together naively and
 * they feed each other forever: every write fires a change, every change
 * triggers a write.
 *
 * The cut is one piece of state — the text this pair last agreed on. A change
 * that matches it is this editor's own echo and is ignored; anything else came
 * from somewhere that does not know about the diagram, and the view has to be
 * rebuilt from it. Nothing here imports `vscode`, because the loop is the part
 * worth testing and an extension host is not.
 */

export class DocumentSync {
	/** The text both sides last agreed on. */
	private agreed: string

	constructor(initial: string) {
		this.agreed = initial
	}

	/**
	 * The webview produced new text. Returns whether to write it to the document.
	 *
	 * A write is refused when the text already matches what the document holds:
	 * a visual editor re-serialises on every command, and a command that changed
	 * nothing would otherwise mark the file dirty for no reason.
	 *
	 * @param text - What the webview now says the document should be.
	 * @param current - What the document says right now.
	 */
	fromWebview(text: string, current: string): boolean {
		if (text === current) {
			// Still worth recording: the two sides agree, so the change event this
			// would have produced is not going to arrive to clear it.
			this.agreed = text
			return false
		}
		this.agreed = text
		return true
	}

	/**
	 * The document now holds this text. Returns whether to rebuild the webview.
	 *
	 * False means the change was this editor's own write coming back around.
	 * True means someone else did it — a keystroke in a text editor on the same
	 * file, an undo, a revert, a branch switch — and the diagram is now stale.
	 *
	 * @param text - The document's current text.
	 */
	fromDocument(text: string): boolean {
		if (text === this.agreed) return false
		this.agreed = text
		return true
	}
}

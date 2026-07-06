import type { BpmnDefinitions } from "@bpmnkit/core"

interface Entry {
	defs: BpmnDefinitions
	/** Human-readable label for HUD tooltips (e.g. "Move", "Rename"). */
	label: string
	/** Coalescing key — consecutive pushes with the same key merge into one entry. */
	key?: string
}

/**
 * Snapshot-based undo/redo history for the BPMN editor.
 *
 * Each entry stores a reference to an immutable `BpmnDefinitions`. Because
 * `modeling.ts` operations return structurally-shared copies (only the touched
 * elements are new objects), 100 single-element edits on a large model share
 * almost all of their memory — the stack never deep-copies.
 *
 * Consecutive pushes carrying the same `key` are *coalesced*: the top entry is
 * replaced in place rather than appended, so a burst (e.g. typing a label,
 * dragging a colour slider) collapses to a single undo step.
 */
export class CommandStack {
	private _entries: Entry[] = []
	private _cursor = -1
	private readonly _maxSize = 100

	/**
	 * Appends a new snapshot, clearing any redo states, and enforces maxSize.
	 * When `key` matches the current top entry's key (and no redo is pending),
	 * the top entry is replaced instead — coalescing a burst into one step.
	 */
	push(defs: BpmnDefinitions, label = "", key?: string): void {
		const top = this._entries[this._cursor]
		const atTop = this._cursor === this._entries.length - 1
		if (key !== undefined && atTop && top && top.key === key) {
			// Coalesce: keep the same undo entry, update its resulting state.
			top.defs = defs
			top.label = label || top.label
			return
		}

		this._entries.splice(this._cursor + 1)
		this._entries.push({ defs, label, key })
		if (this._entries.length > this._maxSize) {
			this._entries.shift()
		}
		this._cursor = this._entries.length - 1
	}

	/** Returns the current snapshot, or null if the stack is empty. */
	current(): BpmnDefinitions | null {
		return this._entries[this._cursor]?.defs ?? null
	}

	/** Moves the cursor back one step and returns that snapshot. */
	undo(): BpmnDefinitions | null {
		if (!this.canUndo()) return null
		this._cursor--
		return this._entries[this._cursor]?.defs ?? null
	}

	/** Moves the cursor forward one step and returns that snapshot. */
	redo(): BpmnDefinitions | null {
		if (!this.canRedo()) return null
		this._cursor++
		return this._entries[this._cursor]?.defs ?? null
	}

	canUndo(): boolean {
		return this._cursor > 0
	}

	canRedo(): boolean {
		return this._cursor < this._entries.length - 1
	}

	/** Label of the change that `undo()` would revert, or null. */
	undoLabel(): string | null {
		return this.canUndo() ? (this._entries[this._cursor]?.label ?? "") : null
	}

	/** Label of the change that `redo()` would re-apply, or null. */
	redoLabel(): string | null {
		return this.canRedo() ? (this._entries[this._cursor + 1]?.label ?? "") : null
	}

	clear(): void {
		this._entries = []
		this._cursor = -1
	}
}

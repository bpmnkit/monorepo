import type { BpmnDefinitions } from "@bpmnkit/core"

/**
 * Snapshot-based undo/redo history for the BPMN editor.
 * Each push stores a full copy of the definitions model; since BPMN models
 * are small the memory overhead is negligible.
 */
export class CommandStack {
	private _snapshots: BpmnDefinitions[] = []
	private _cursor = -1
	private readonly _maxSize = 100

	/** Appends a new snapshot, clearing any redo states, and enforces maxSize. */
	push(defs: BpmnDefinitions): void {
		this._snapshots.splice(this._cursor + 1)
		this._snapshots.push(defs)
		if (this._snapshots.length > this._maxSize) {
			this._snapshots.shift()
		}
		this._cursor = this._snapshots.length - 1
	}

	/** Returns the current snapshot, or null if the stack is empty. */
	current(): BpmnDefinitions | null {
		return this._snapshots[this._cursor] ?? null
	}

	/** Moves the cursor back one step and returns that snapshot. */
	undo(): BpmnDefinitions | null {
		if (!this.canUndo()) return null
		this._cursor--
		return this._snapshots[this._cursor] ?? null
	}

	/** Moves the cursor forward one step and returns that snapshot. */
	redo(): BpmnDefinitions | null {
		if (!this.canRedo()) return null
		this._cursor++
		return this._snapshots[this._cursor] ?? null
	}

	canUndo(): boolean {
		return this._cursor > 0
	}

	canRedo(): boolean {
		return this._cursor < this._snapshots.length - 1
	}

	clear(): void {
		this._snapshots = []
		this._cursor = -1
	}
}

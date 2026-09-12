/**
 * The writer's half: an editor, loaded only when someone actually claims one.
 *
 * This module is reached through a dynamic `import()`, and that is the point.
 * `@bpmnkit/editor` and the history panel are most of a hundred kilobytes, and
 * the overwhelming majority of people who open a drop are reading it. They
 * should not pay for a palette they will never click. A watcher's bundle stays
 * what it was; this chunk is fetched the moment "Edit" is pressed and not a
 * moment before.
 *
 * **Ops go out; the room decides.** Every change describes itself as an
 * `EditorOp`, which goes to the room and from there to the watchers. The editor
 * applies it locally first — waiting for a round trip before each drag frame
 * would make the editor feel broken — so a rejection means the local document
 * is ahead of the truth and has to be replaced with it. Rejections should be
 * vanishingly rare; the editor produces documents the room will take.
 *
 * **Two histories, never merged.** Local checkpoints go to IndexedDB every half
 * minute of dirty editing: per-browser, per-device, free, and frequent — undo
 * that survives a refresh. The server's milestones are scarce, shared and
 * bounded. They answer different questions, so they are shown as separate
 * panels with separate labels. A merged list would quietly imply the local ones
 * are shared. They are not.
 */
import type { ViewportState } from "@bpmnkit/canvas"
import { Bpmn, type BpmnDefinitions } from "@bpmnkit/core"
import { BpmnEditor, type EditorOp, initEditorHud } from "@bpmnkit/editor"
import { createHistoryPanel, saveCheckpoint } from "@bpmnkit/plugins/history"

/** How long the editor must sit still before a local checkpoint is written. */
const CHECKPOINT_IDLE_MS = 30_000

export interface EditSessionOptions {
	container: HTMLElement
	/** The document to open, as the room currently has it. */
	xml: string
	/** The view the reader already had, so the swap does not move anything. */
	viewport: ViewportState
	theme: "light" | "dark"
	/** Scopes the local checkpoints. Opaque strings to the history plugin. */
	shareId: string
	filename: string
	/** Sends one edit to the room. */
	sendOp(op: EditorOp): void
}

export interface EditSession {
	/** Replaces the document — after a rejection, or a restored checkpoint. */
	replace(xml: string): void
	/** The document as edited, for the page to keep showing after Done. */
	currentXml(): string
	/** The local-checkpoint panel, for the page to place. */
	historyPanel: HTMLElement
	refreshHistory(): Promise<void>
	/** Flushes a pending checkpoint and tears the editor down. */
	destroy(): void
}

export function startEditSession(options: EditSessionOptions): EditSession {
	const editor = new BpmnEditor({
		container: options.container,
		xml: options.xml,
		theme: options.theme,
		grid: true,
		// The viewer's view is carried across instead. `"none"` also means
		// `loadDefinitions` schedules no deferred fit, so a later `replace` cannot
		// re-frame the diagram a frame after `setViewport` placed it.
		fit: "none",
	})
	editor.setViewport(options.viewport)
	// The palette, the toolbar and the undo buttons. Only a writer ever gets
	// here, so there is no HUD to hide from a watcher — a reader's page never
	// constructs an editor at all.
	initEditorHud(editor)

	// ── Local checkpoints ──────────────────────────────────────────────────────

	let checkpointTimer: ReturnType<typeof setTimeout> | null = null
	let dirty = false

	const writeCheckpoint = (): void => {
		if (!dirty) return
		dirty = false
		// Failure is not worth telling anyone about: this is a convenience on top
		// of a server that already has the document.
		void saveCheckpoint(options.shareId, options.filename, editor.exportXml()).catch(() => {})
	}

	const scheduleCheckpoint = (): void => {
		dirty = true
		if (checkpointTimer !== null) clearTimeout(checkpointTimer)
		checkpointTimer = setTimeout(writeCheckpoint, CHECKPOINT_IDLE_MS)
	}

	// Leaving the page is the one moment a pending checkpoint would otherwise be
	// lost, and `pagehide` is the event that still fires on a mobile tab switch.
	const onPageHide = () => writeCheckpoint()
	addEventListener("pagehide", onPageHide)

	// ── Ops ────────────────────────────────────────────────────────────────────

	/** Set while a replacement is being loaded, so it is not sent back as an edit. */
	let replacing = false

	editor.on("diagram:op", (op) => {
		if (replacing) return
		options.sendOp(op)
		scheduleCheckpoint()
	})

	// ── The local history panel ────────────────────────────────────────────────

	const panel = createHistoryPanel({
		getCurrentContext: () => ({ projectId: options.shareId, fileId: options.filename }),
		// Restoring is an ordinary edit: it goes to the room as a snapshot op like
		// any other change, so the watchers follow it rather than being left behind.
		loadXml: (xml) => {
			let restored: BpmnDefinitions
			try {
				restored = Bpmn.parse(xml)
			} catch {
				// A checkpoint that will not parse is from some other build. Leaving
				// the editor where it is beats replacing a working document with none.
				return
			}
			editor.applyChange(() => restored)
		},
	})

	return {
		replace(xml: string): void {
			const viewport = editor.getViewport()
			replacing = true
			try {
				editor.load(xml)
				editor.setViewport(viewport)
			} finally {
				replacing = false
			}
		},
		currentXml: () => editor.exportXml(),
		historyPanel: panel.el,
		refreshHistory: () => panel.refresh(),
		destroy(): void {
			removeEventListener("pagehide", onPageHide)
			if (checkpointTimer !== null) clearTimeout(checkpointTimer)
			writeCheckpoint()
			panel.el.remove()
			editor.destroy()
		},
	}
}

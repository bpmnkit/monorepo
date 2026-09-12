/**
 * A single-slot localStorage draft for the editor, so a refresh does not lose a
 * diagram that was never saved anywhere.
 *
 * It covers exactly one gap. Files that live in a project are already autosaved
 * to IndexedDB by `@bpmnkit/plugins/storage`, which bails when there is no
 * current file id — so a diagram opened straight from the welcome screen
 * persists nowhere at all, and a reload returns the welcome screen. Drafting is
 * therefore gated on `getCurrentContext()` being null; drafting a project file
 * too would put a second, competing copy behind a confusing prompt.
 *
 * Storage only — no imports, no DOM — so it tests without a workspace build.
 */

/** Where the draft lives. One slot: the editor has one active diagram. */
export const DRAFT_KEY = "bpmnkit-editor-draft"

/** Set for the tab's lifetime once the prompt has been answered or waved off. */
export const DISMISSED_KEY = "bpmnkit-editor-draft-dismissed"

/** Drafts older than this are noise rather than recoverable work. */
export const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** An unsaved diagram, as stored. */
export interface Draft {
	xml: string
	/** The tab name at the time of writing, or null for an unnamed diagram. */
	name: string | null
	savedAt: number
}

function isDraft(value: unknown): value is Draft {
	if (typeof value !== "object" || value === null) return false
	const d = value as Record<string, unknown>
	return (
		typeof d.xml === "string" &&
		d.xml.length > 0 &&
		typeof d.savedAt === "number" &&
		(d.name === null || typeof d.name === "string")
	)
}

/**
 * Writes the draft, replacing any previous one. Never throws: storage can be
 * full, or blocked entirely in a private window, and losing a draft must not
 * take the editor down with it.
 */
export function saveDraft(xml: string, name: string | null, now = Date.now()): void {
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify({ xml, name, savedAt: now } satisfies Draft))
	} catch {
		// Quota exceeded or storage unavailable — the draft is a convenience.
	}
}

/**
 * Returns the stored draft, or null when there is none, it is unreadable, or it
 * has aged out. An expired or malformed draft is cleared on the way past, so a
 * bad value cannot sit in storage prompting forever.
 */
export function readDraft(now = Date.now()): Draft | null {
	let raw: string | null
	try {
		raw = localStorage.getItem(DRAFT_KEY)
	} catch {
		return null
	}
	if (raw === null) return null

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		clearDraft()
		return null
	}

	if (!isDraft(parsed)) {
		clearDraft()
		return null
	}
	if (now - parsed.savedAt > MAX_DRAFT_AGE_MS) {
		clearDraft()
		return null
	}
	return parsed
}

/** Removes the draft. Called once the work is safe — shared, or restored and re-saved. */
export function clearDraft(): void {
	try {
		localStorage.removeItem(DRAFT_KEY)
	} catch {
		// Storage unavailable — nothing to remove.
	}
}

/**
 * Whether the restore prompt has already been answered in this tab.
 *
 * Declining keeps the draft rather than deleting it — a stray click must not
 * destroy the only copy of someone's work — so without this the prompt would
 * return on every load until they restored.
 */
export function isPromptDismissed(): boolean {
	try {
		return sessionStorage.getItem(DISMISSED_KEY) !== null
	} catch {
		return false
	}
}

/** Marks the prompt answered for this tab. */
export function dismissPrompt(): void {
	try {
		sessionStorage.setItem(DISMISSED_KEY, "1")
	} catch {
		// Storage unavailable — the prompt will ask again next load.
	}
}

/** Renders a draft's age for the prompt: "just now", "8 minutes ago", "3 days ago". */
export function describeAge(savedAt: number, now = Date.now()): string {
	const seconds = Math.max(0, Math.round((now - savedAt) / 1000))
	if (seconds < 60) return "just now"

	const minutes = Math.round(seconds / 60)
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

	const hours = Math.round(minutes / 60)
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

	const days = Math.round(hours / 24)
	return `${days} day${days === 1 ? "" : "s"} ago`
}

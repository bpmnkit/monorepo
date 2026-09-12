/**
 * Which drops the editor may write to, and why not when it may not.
 *
 * Three carve-outs, each for a different reason, and all three enforced here
 * rather than by hiding a button. A hidden button is a suggestion; a socket is
 * an API, and anyone who opens devtools has one.
 *
 * The reasons are worth stating because "no" without one reads as a bug:
 *
 * - **The demo** is served from memory and has no row anywhere. There is
 *   nothing to save to, so the page offers a copy instead.
 * - **A pinned drop** is one an operator marked as never expiring — a fixture,
 *   a reference, something linked from elsewhere. Anyone-with-the-link editing
 *   is right for an ordinary drop and wrong for that.
 * - **More than one process** is past what the editor models. It edits one
 *   process; a file with several would come back with the others intact but
 *   unreachable, which is worse than not offering to edit it.
 */
import type { BpmnDefinitions } from "@bpmnkit/core"
import { DEMO_SHARE_ID } from "../shared/constants.js"

/** Why a file cannot be edited. */
export type ReadOnlyReason = "demo" | "pinned" | "multi-process"

/** A sentence for the writer, not a code. */
export function describeReadOnly(reason: ReadOnlyReason): string {
	switch (reason) {
		case "demo":
			return "the demo drop cannot be edited — drop a copy of it to make one you own"
		case "pinned":
			return "this drop is pinned by an operator and is read-only"
		case "multi-process":
			return "the editor handles one process at a time, and this file has several"
	}
}

/** The built-in demo, which has no row to write to. */
export function isDemoShare(shareId: string): boolean {
	return shareId === DEMO_SHARE_ID
}

/** An operator has marked this drop as never expiring. */
export async function isPinned(db: D1Database, shareId: string): Promise<boolean> {
	const row = await db
		.prepare("SELECT expires_at FROM drops WHERE id = ?")
		.bind(shareId)
		.first<{ expires_at: number | null }>()
	return row !== null && row.expires_at === null
}

/** More processes than the editor can address. */
export function isMultiProcess(defs: BpmnDefinitions): boolean {
	return defs.processes.length !== 1
}

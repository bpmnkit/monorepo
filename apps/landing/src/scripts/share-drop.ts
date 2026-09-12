/**
 * "Share as a drop" — posts the open diagram straight to BPMN Kit Drop and hands
 * back a link, so a diagram can be authored here and shared without ever becoming
 * a file on disk.
 *
 * It posts to the same endpoint the drop page itself uses, so an authored diagram
 * clears exactly the gate a dropped file does — same parser, same size caps, same
 * Terms acknowledgment. `bpmnkit.com/drop*` is carved out to the Drop Worker in
 * production, so the request is same-origin; `astro.config.mjs` proxies the same
 * prefix in dev to keep it that way.
 *
 * Transport only, so it carries no dependency on the editor or the DOM and can
 * be tested on its own; the dialog that drives it lives in `share-drop-dialog.ts`.
 */

/** The Drop upload endpoint, relative so it stays same-origin. */
export const DROP_UPLOAD_PATH = "/drop/api/drops"

/** What a successful upload returns, plus the error shape the Worker uses. */
interface UploadResponse {
	url?: string
	error?: string
	details?: string[]
}

/** The result of a share attempt. `path` is Drop-relative, e.g. `/drop/aB3xY`. */
export type ShareOutcome = { ok: true; path: string } | { ok: false; message: string }

/**
 * Names the shared file. The Worker sanitizes and de-duplicates names itself, so
 * this only has to produce something a person would recognise in a download.
 */
export function dropFileName(name: string | null): string {
	const base = (name ?? "").trim()
	if (base === "") return "diagram.bpmn"
	return /\.bpmn$/i.test(base) ? base : `${base}.bpmn`
}

/**
 * Turns a failed upload into something worth reading. Per-file parser messages
 * are the most actionable thing the Worker returns, so they win over the summary.
 */
export function uploadErrorMessage(status: number, payload: UploadResponse | null): string {
	if (payload?.details && payload.details.length > 0) return payload.details.join("\n")
	if (payload?.error) return payload.error
	if (status === 413) return "That diagram is too large to share."
	if (status === 429) return "Too many uploads from here. Try again in a few minutes."
	return `Sharing failed (${status}). Please try again.`
}

/** Posts one diagram to Drop as a single-file upload. */
export async function shareToDrop(xml: string, filename: string): Promise<ShareOutcome> {
	const body = new FormData()
	body.append("files", new File([xml], filename, { type: "application/xml" }), filename)

	let res: Response
	try {
		res = await fetch(DROP_UPLOAD_PATH, { method: "POST", body })
	} catch {
		return { ok: false, message: "Could not reach Drop. Check your connection and try again." }
	}

	const payload = (await res.json().catch(() => null)) as UploadResponse | null
	if (res.status === 201 && payload?.url) return { ok: true, path: payload.url }
	return { ok: false, message: uploadErrorMessage(res.status, payload) }
}

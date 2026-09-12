/**
 * The version-log routes: a file's timeline, and restoring an entry from it.
 *
 * Restoring is an **append**, never a rewind. It writes the chosen body as the
 * new current state and cuts a milestone for it, so the thing you restored
 * *from* is still in the ring afterwards. Undoing a restore is another restore.
 */
import { Bpmn, semanticHash } from "@bpmnkit/core"
import type { Env } from "../env.js"
import { getCurrentBody, getDrop, getFileRef } from "../lib/db.js"
import { isDemo } from "../lib/demo.js"
import { json } from "../lib/http.js"
import { sha256Hex } from "../lib/ids.js"
import { parseModel } from "../lib/validate.js"
import { appendMilestone, getVersionBody, listVersions, setCurrent } from "../lib/versions.js"
import { MAX_MILESTONES, ORIGINAL_SEQ, RETENTION_MS } from "../shared/constants.js"

/** Restores are their own editing session, so each one is its own milestone. */
function restoreSessionId(now: number): string {
	return `restore-${now}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * The original's semantic hash, so milestone 1 can be labelled against it.
 *
 * Computed on demand rather than stored: it is one parse of one file, only when
 * someone opens the history panel, and it keeps the upload path untouched.
 * Returns undefined for anything that is not parseable BPMN, which downgrades
 * that one label to "model changed" — overstating a layout edit rather than
 * hiding a real one.
 */
async function originalSemanticHash(body: string, kind: string): Promise<string | undefined> {
	if (kind !== "bpmn") return undefined
	try {
		return await semanticHash(Bpmn.parse(body))
	} catch {
		return undefined
	}
}

/** GET /drop/:id/history/:filename — the file's timeline, newest first. */
export async function handleHistory(
	shareId: string,
	filename: string,
	env: Env,
): Promise<Response> {
	if (isDemo(shareId)) return json({ error: "the demo drop has no history" }, { status: 404 })

	const found = await getDrop(env.DB, shareId)
	if (!found) return json({ error: "not found" }, { status: 404 })
	const ref = await getFileRef(env.DB, shareId, filename)
	if (!ref) return json({ error: "not found" }, { status: 404 })

	const original = await env.DB.prepare(
		"SELECT body FROM file_content WHERE file_id = ? AND rep = 'original'",
	)
		.bind(ref.id)
		.first<{ body: string }>()

	const entries = await listVersions(env.DB, ref.id, {
		createdAt: found.drop.created_at,
		bytes: ref.sizeOriginal,
		contentHash: ref.contentHash,
		semanticHash: original ? await originalSemanticHash(original.body, ref.kind) : undefined,
	})

	return json({ filename, maxMilestones: MAX_MILESTONES, entries })
}

/**
 * POST /drop/:id/restore/:filename/:seq — make an earlier state current again.
 *
 * `seq` 0 is the uploaded original, which is always restorable because nothing
 * ever overwrites it.
 */
export async function handleRestore(
	shareId: string,
	filename: string,
	seq: number,
	env: Env,
	now: number,
): Promise<Response> {
	if (isDemo(shareId)) return json({ error: "the demo drop cannot be edited" }, { status: 403 })
	if (!Number.isInteger(seq) || seq < 0) return json({ error: "bad version" }, { status: 400 })

	const found = await getDrop(env.DB, shareId)
	if (!found) return json({ error: "not found" }, { status: 404 })
	// An admin-pinned drop never expires and is not anyone's to rewrite.
	if (found.drop.expires_at === null) {
		return json({ error: "this drop is read-only" }, { status: 403 })
	}
	const ref = await getFileRef(env.DB, shareId, filename)
	if (!ref) return json({ error: "not found" }, { status: 404 })

	const target =
		seq === ORIGINAL_SEQ
			? await env.DB.prepare(
					"SELECT body, ? AS content_hash FROM file_content WHERE file_id = ? AND rep = 'original'",
				)
					.bind(ref.contentHash, ref.id)
					.first<{ body: string; content_hash: string }>()
					.then((r) => (r ? { body: r.body, hash: r.content_hash } : null))
			: await getVersionBody(env.DB, ref.id, seq)

	if (!target) return json({ error: "that version is no longer kept" }, { status: 404 })

	// The state being replaced becomes a milestone first, so restoring can never
	// be the thing that loses work.
	const live = await getCurrentBody(env.DB, shareId, filename, "original")
	if (live) {
		await appendMilestone(env.DB, {
			fileId: ref.id,
			body: live.body,
			contentHash: live.hash,
			semanticHash: (await originalSemanticHash(live.body, ref.kind)) ?? live.hash,
			sessionId: restoreSessionId(now),
			now,
		})
	}

	let modelJson: string
	try {
		modelJson = JSON.stringify(parseModel(ref.kind, target.body).model)
	} catch {
		return json({ error: "that version can no longer be parsed" }, { status: 422 })
	}

	await setCurrent(env.DB, {
		fileId: ref.id,
		shareId,
		body: target.body,
		json: modelJson,
		contentHash: await sha256Hex(target.body),
		expiresAt: now + RETENTION_MS,
		now,
	})

	return json({ restored: seq, filename })
}

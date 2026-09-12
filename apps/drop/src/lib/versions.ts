/**
 * The version log: a pinned original plus a bounded ring of milestones.
 *
 * The guarantee this file exists to keep is one sentence long — **a file has at
 * most {@link MAX_MILESTONES} rows in `file_versions`, plus its untouchable
 * original** — and it is what makes anonymous, autosaving, mutable drops safe.
 * Anyone with the link may overwrite a drop; nobody can destroy what it was.
 *
 * Two rules do the bounding:
 *
 * - **Collapse.** A milestone is keyed by `<hourBucket>:<sessionId>`, so
 *   repeated saves inside one hour of one editing session replace that row
 *   instead of adding one. A new session always starts a new milestone, so one
 *   person's work is never overwritten by the next person's inside the same hour.
 * - **Prune.** After every write, everything older than the newest
 *   {@link MAX_MILESTONES} is deleted in the same batch.
 *
 * Suppression keys on `content_hash`, never on `semanticHash`: the latter
 * deliberately excludes all diagram interchange, so an hour spent purely on
 * layout hashes identically and would be discarded as a no-op. `semanticHash`
 * earns its place labelling a milestone instead — see {@link versionLabel}.
 */
import { MAX_MILESTONES, MILESTONE_BUCKET_MS, ORIGINAL_SEQ } from "../shared/constants.js"

/** One stored milestone, without its body. */
export interface VersionRow {
	seq: number
	bucket: string
	content_hash: string
	semantic_hash: string
	op_count: number
	created_at: number
}

/** What a milestone changed, relative to the state before it. */
export type VersionLabel = "original" | "layout" | "model"

/** An entry in a file's timeline, newest first. `seq` 0 is the uploaded original. */
export interface VersionEntry {
	seq: number
	createdAt: number
	label: VersionLabel
	bytes: number
	opCount: number
}

/** The outcome of an append: either a milestone was written, or nothing changed. */
export type AppendResult =
	| { written: true; seq: number; replaced: boolean }
	| { written: false; reason: "unchanged" }

/**
 * The collapse key for a moment in an editing session.
 *
 * Exported because it is the whole of the bounding rule that is worth reading
 * on its own, and the whole of what a test needs to drive.
 */
export function bucketKey(now: number, sessionId: string): string {
	return `${Math.floor(now / MILESTONE_BUCKET_MS)}:${sessionId}`
}

/**
 * Classifies a milestone against the state before it.
 *
 * Free, because both hashes are already stored: equal content means nothing was
 * written at all, and equal semantics with different content means the change
 * lived entirely in the diagram's layout.
 */
export function versionLabel(
	previous: { content_hash: string; semantic_hash: string } | null,
	current: { content_hash: string; semantic_hash: string },
): VersionLabel {
	if (!previous) return "original"
	return previous.semantic_hash === current.semantic_hash ? "layout" : "model"
}

/** The newest milestone for a file, or null when it has never been edited. */
export async function latestVersion(db: D1Database, fileId: string): Promise<VersionRow | null> {
	return await db
		.prepare(
			`SELECT seq, bucket, content_hash, semantic_hash, op_count, created_at
			 FROM file_versions WHERE file_id = ? ORDER BY seq DESC LIMIT 1`,
		)
		.bind(fileId)
		.first<VersionRow>()
}

/**
 * Records a milestone, unless nothing has changed since the last one.
 *
 * `previousContentHash` is the hash of the state this milestone supersedes — the
 * newest milestone's, or the uploaded original's when there is none yet. Passing
 * it in keeps the caller's single read of the file's current state authoritative
 * rather than reading it twice.
 */
export async function appendMilestone(
	db: D1Database,
	params: {
		fileId: string
		body: string
		contentHash: string
		semanticHash: string
		sessionId: string
		opCount?: number
		now: number
	},
): Promise<AppendResult> {
	const { fileId, body, contentHash, semanticHash, sessionId, now } = params
	const opCount = params.opCount ?? 0
	const bucket = bucketKey(now, sessionId)

	const latest = await latestVersion(db, fileId)
	// Nothing changed since the state this would supersede: opened, panned
	// around, left. Writing a milestone for that would burn a slot for nothing.
	const previousHash = latest?.content_hash ?? (await originalHash(db, fileId))
	if (previousHash === contentHash) return { written: false, reason: "unchanged" }

	const sameBucket = latest?.bucket === bucket
	const seq = sameBucket ? latest.seq : (latest?.seq ?? ORIGINAL_SEQ) + 1

	const write = sameBucket
		? db
				.prepare(
					`UPDATE file_versions
					 SET body = ?, content_hash = ?, semantic_hash = ?, op_count = op_count + ?, created_at = ?
					 WHERE file_id = ? AND seq = ?`,
				)
				.bind(body, contentHash, semanticHash, opCount, now, fileId, seq)
		: db
				.prepare(
					`INSERT INTO file_versions
					   (file_id, seq, bucket, body, content_hash, semantic_hash, op_count, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(fileId, seq, bucket, body, contentHash, semanticHash, opCount, now)

	// Prune in the same batch as the write, so the ring can never be over its
	// bound between two statements. `seq` is monotonic per file, so "older than
	// the newest MAX_MILESTONES" is a plain arithmetic comparison.
	await db.batch([
		write,
		db
			.prepare(
				`DELETE FROM file_versions
				 WHERE file_id = ?
				   AND seq <= (SELECT MAX(seq) FROM file_versions WHERE file_id = ?) - ?`,
			)
			.bind(fileId, fileId, MAX_MILESTONES),
	])

	return { written: true, seq, replaced: sameBucket }
}

/** The uploaded original's content hash — the state milestone 1 supersedes. */
async function originalHash(db: D1Database, fileId: string): Promise<string | null> {
	const row = await db
		.prepare("SELECT content_hash FROM files WHERE id = ?")
		.bind(fileId)
		.first<{ content_hash: string }>()
	return row?.content_hash ?? null
}

/**
 * A file's timeline, newest first, ending in the uploaded original.
 *
 * `originalSemanticHash` lets milestone 1 be labelled against the original;
 * without it that one entry falls back to "model", which is the safer read of
 * an unknown change.
 */
export async function listVersions(
	db: D1Database,
	fileId: string,
	original: { createdAt: number; bytes: number; semanticHash?: string; contentHash: string },
): Promise<VersionEntry[]> {
	const { results } = await db
		.prepare(
			`SELECT seq, bucket, content_hash, semantic_hash, op_count, created_at,
			        LENGTH(body) AS bytes
			 FROM file_versions WHERE file_id = ? ORDER BY seq ASC`,
		)
		.bind(fileId)
		.all<VersionRow & { bytes: number }>()

	const entries: VersionEntry[] = []
	let previous: { content_hash: string; semantic_hash: string } | null = {
		content_hash: original.contentHash,
		// Absent, every comparison reads as "model changed", which overstates a
		// layout-only edit rather than hiding a real one.
		semantic_hash: original.semanticHash ?? "",
	}
	for (const row of results) {
		entries.push({
			seq: row.seq,
			createdAt: row.created_at,
			label: versionLabel(previous, row),
			bytes: row.bytes,
			opCount: row.op_count,
		})
		previous = row
	}

	// Built oldest-first so each entry can be labelled against its predecessor;
	// returned newest-first, with the original as the last thing you scroll to.
	entries.reverse()
	entries.push({
		seq: ORIGINAL_SEQ,
		createdAt: original.createdAt,
		label: "original",
		bytes: original.bytes,
		opCount: 0,
	})
	return entries
}

/** One milestone's stored body, or null when that seq is not in the ring. */
export async function getVersionBody(
	db: D1Database,
	fileId: string,
	seq: number,
): Promise<{ body: string; hash: string } | null> {
	const row = await db
		.prepare("SELECT body, content_hash FROM file_versions WHERE file_id = ? AND seq = ?")
		.bind(fileId, seq)
		.first<{ body: string; content_hash: string }>()
	return row ? { body: row.body, hash: row.content_hash } : null
}

/**
 * Replaces a file's live state, and slides the drop's retention forward.
 *
 * `file_content` is untouched by design — the uploaded bytes stay reachable
 * however many times a drop is edited.
 */
export async function setCurrent(
	db: D1Database,
	params: {
		fileId: string
		shareId: string
		body: string
		json: string
		contentHash: string
		expiresAt: number
		now: number
	},
): Promise<void> {
	await db.batch([
		db
			.prepare(
				`INSERT INTO file_current (file_id, body, json, content_hash, updated_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(file_id) DO UPDATE SET
				   body = excluded.body,
				   json = excluded.json,
				   content_hash = excluded.content_hash,
				   updated_at = excluded.updated_at`,
			)
			.bind(params.fileId, params.body, params.json, params.contentHash, params.now),
		db
			.prepare("UPDATE drops SET updated_at = ?, expires_at = ? WHERE id = ?")
			.bind(params.now, params.expiresAt, params.shareId),
	])
}

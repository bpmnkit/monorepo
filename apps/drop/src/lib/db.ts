import type { FileKind, ReportReason } from "../shared/constants.js"
import { RETENTION_MS } from "../shared/constants.js"
import type { FileMeta } from "./meta.js"
import type { ValidatedFile } from "./validate.js"

/** A drop's metadata row. */
export interface DropRow {
	id: string
	file_count: number
	size_total: number
	tos_version: string
	created_at: number
	last_viewed_at: number
	view_count: number
	expires_at: number | null
}

/** A file row (no body). */
export interface FileRow {
	id: string
	drop_id: string
	position: number
	kind: FileKind
	filename: string
	name: string | null
	content_hash: string
	size_original: number
	size_json: number
	meta: string
}

/** A file with its parsed metadata, as returned to callers. */
export interface FileInfo {
	id: string
	position: number
	kind: FileKind
	filename: string
	name: string | null
	sizeOriginal: number
	sizeJson: number
	meta: FileMeta
}

/** Aggregate public counters: total drops and total views. */
export async function getStats(db: D1Database): Promise<{ drops: number; views: number }> {
	const row = await db
		.prepare("SELECT COUNT(*) AS drops, COALESCE(SUM(view_count), 0) AS views FROM drops")
		.first<{ drops: number; views: number }>()
	return { drops: row?.drops ?? 0, views: row?.views ?? 0 }
}

/** Return the subset of `hashes` that are banned. */
export async function findBannedHashes(db: D1Database, hashes: string[]): Promise<string[]> {
	if (hashes.length === 0) return []
	const placeholders = hashes.map(() => "?").join(", ")
	const { results } = await db
		.prepare(`SELECT content_hash FROM banned_hashes WHERE content_hash IN (${placeholders})`)
		.bind(...hashes)
		.all<{ content_hash: string }>()
	return results.map((r) => r.content_hash)
}

/** Atomically store a drop and all its files/content in one transactional batch. */
export async function insertDrop(
	db: D1Database,
	params: {
		shareId: string
		files: Array<ValidatedFile & { id: string; hash: string }>
		tosVersion: string
		now: number
	},
): Promise<void> {
	const { shareId, files, tosVersion, now } = params
	const sizeTotal = files.reduce((n, f) => n + f.sizeOriginal, 0)
	const expiresAt = now + RETENTION_MS

	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`INSERT INTO drops (id, file_count, size_total, tos_version, created_at, last_viewed_at, view_count, expires_at)
				 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
			)
			.bind(shareId, files.length, sizeTotal, tosVersion, now, now, expiresAt),
	]

	files.forEach((f, i) => {
		statements.push(
			db
				.prepare(
					`INSERT INTO files (id, drop_id, position, kind, filename, name, content_hash, size_original, size_json, meta)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					f.id,
					shareId,
					i,
					f.kind,
					f.filename,
					f.name,
					f.hash,
					f.sizeOriginal,
					f.sizeJson,
					JSON.stringify(f.meta),
				),
			db
				.prepare(`INSERT INTO file_content (file_id, rep, body) VALUES (?, 'original', ?)`)
				.bind(f.id, f.original),
			db
				.prepare(`INSERT INTO file_content (file_id, rep, body) VALUES (?, 'json', ?)`)
				.bind(f.id, f.json),
		)
	})

	await db.batch(statements)
}

/** Fetch a drop's metadata and ordered file list (no bodies). Returns null if unknown. */
export async function getDrop(
	db: D1Database,
	shareId: string,
): Promise<{ drop: DropRow; files: FileInfo[] } | null> {
	const drop = await db.prepare("SELECT * FROM drops WHERE id = ?").bind(shareId).first<DropRow>()
	if (!drop) return null

	const { results } = await db
		.prepare("SELECT * FROM files WHERE drop_id = ? ORDER BY position ASC")
		.bind(shareId)
		.all<FileRow>()

	const files: FileInfo[] = results.map((r) => ({
		id: r.id,
		position: r.position,
		kind: r.kind,
		filename: r.filename,
		name: r.name,
		sizeOriginal: r.size_original,
		sizeJson: r.size_json,
		meta: JSON.parse(r.meta) as FileMeta,
	}))

	return { drop, files }
}

/**
 * Fetch one *uploaded* representation of a file — the pinned original, whatever
 * has been edited since. Nothing ever writes to these rows, which is what makes
 * "the original survives" a property of the schema rather than a promise.
 *
 * For what the file says *now*, use {@link getCurrentBody}.
 */
export async function getFileBody(
	db: D1Database,
	shareId: string,
	filename: string,
	rep: "original" | "json",
): Promise<{ kind: FileKind; body: string; hash: string } | null> {
	const row = await db
		.prepare(
			`SELECT f.kind AS kind, f.content_hash AS hash, c.body AS body
			 FROM files f JOIN file_content c ON c.file_id = f.id
			 WHERE f.drop_id = ? AND f.filename = ? AND c.rep = ?`,
		)
		.bind(shareId, filename, rep)
		.first<{ kind: FileKind; hash: string; body: string }>()
	return row ? { kind: row.kind, body: row.body, hash: row.hash } : null
}

/**
 * Fetch a file's current state: the edited body when the drop has been edited,
 * and the uploaded one when it has not.
 *
 * The hash comes from the same row as the body, so the ETag tracks what is
 * actually served rather than what was once uploaded.
 */
export async function getCurrentBody(
	db: D1Database,
	shareId: string,
	filename: string,
	rep: "original" | "json",
): Promise<{ kind: FileKind; body: string; hash: string } | null> {
	const row = await db
		.prepare(
			`SELECT f.kind AS kind,
			        COALESCE(cur.content_hash, f.content_hash) AS hash,
			        COALESCE(${rep === "json" ? "cur.json" : "cur.body"}, c.body) AS body
			 FROM files f
			 JOIN file_content c ON c.file_id = f.id AND c.rep = ?
			 LEFT JOIN file_current cur ON cur.file_id = f.id
			 WHERE f.drop_id = ? AND f.filename = ?`,
		)
		.bind(rep, shareId, filename)
		.first<{ kind: FileKind; hash: string; body: string }>()
	return row ? { kind: row.kind, body: row.body, hash: row.hash } : null
}

/** Resolve a file's row id and upload metadata, for the version-log routes. */
export async function getFileRef(
	db: D1Database,
	shareId: string,
	filename: string,
): Promise<{ id: string; kind: FileKind; contentHash: string; sizeOriginal: number } | null> {
	const row = await db
		.prepare(
			"SELECT id, kind, content_hash, size_original FROM files WHERE drop_id = ? AND filename = ?",
		)
		.bind(shareId, filename)
		.first<{ id: string; kind: FileKind; content_hash: string; size_original: number }>()
	return row
		? {
				id: row.id,
				kind: row.kind,
				contentHash: row.content_hash,
				sizeOriginal: row.size_original,
			}
		: null
}

/**
 * Record views in bulk and slide the retention window forward.
 *
 * Called from the room's alarm rather than from the page handler, so a busy drop
 * costs one write per flush window instead of one per view.
 */
export async function recordViews(
	db: D1Database,
	shareId: string,
	count: number,
	now: number,
	expiresAt: number,
): Promise<void> {
	if (count <= 0) return
	await db
		.prepare(
			"UPDATE drops SET view_count = view_count + ?, last_viewed_at = ?, expires_at = ? WHERE id = ?",
		)
		.bind(count, now, expiresAt, shareId)
		.run()
}

/**
 * Delete a drop and its children. When `ban` is set, every content hash in the
 * drop is added to `banned_hashes` and its open reports are marked resolved.
 * Returns false if the drop did not exist.
 */
export async function deleteDrop(
	db: D1Database,
	shareId: string,
	options: { ban: boolean; reason?: string; now: number },
): Promise<boolean> {
	const existing = await getDrop(db, shareId)
	if (!existing) return false

	const statements: D1PreparedStatement[] = []

	if (options.ban) {
		// The reported hashes as well as the live ones: content edited away to
		// dodge a report is refused the moment anyone edits it back, because the
		// ban list is keyed on content and re-checked on every save.
		const hashes = [
			...new Set([...(await hashesForDrop(db, shareId)), ...(await reportedHashes(db, shareId))]),
		]
		for (const hash of hashes) {
			statements.push(
				db
					.prepare(
						"INSERT OR IGNORE INTO banned_hashes (content_hash, reason, created_at) VALUES (?, ?, ?)",
					)
					.bind(hash, options.reason ?? "policy", options.now),
			)
		}
		statements.push(
			db
				.prepare(`UPDATE reports SET status = 'resolved' WHERE drop_id = ? AND status = 'open'`)
				.bind(shareId),
		)
	}

	const children = "(SELECT id FROM files WHERE drop_id = ?)"
	statements.push(
		db.prepare(`DELETE FROM file_versions WHERE file_id IN ${children}`).bind(shareId),
		db.prepare(`DELETE FROM file_current WHERE file_id IN ${children}`).bind(shareId),
		db.prepare(`DELETE FROM file_content WHERE file_id IN ${children}`).bind(shareId),
		db.prepare("DELETE FROM files WHERE drop_id = ?").bind(shareId),
		db.prepare("DELETE FROM drops WHERE id = ?").bind(shareId),
	)

	await db.batch(statements)
	return true
}

/**
 * Every content hash a drop has worn: what was uploaded, and what it is now.
 *
 * Both, because a mutable drop has two answers and banning either alone leaves
 * a way back in — ban only the upload and the edited form can be re-uploaded
 * freely; ban only the current form and the original can. This was reading
 * `files.content_hash` alone, which since track D has meant the *upload*, so an
 * operator banning an edited drop was banning the wrong bytes.
 */
async function hashesForDrop(db: D1Database, shareId: string): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT f.content_hash AS uploaded, cur.content_hash AS current
			 FROM files f LEFT JOIN file_current cur ON cur.file_id = f.id
			 WHERE f.drop_id = ?`,
		)
		.bind(shareId)
		.all<{ uploaded: string; current: string | null }>()
	return results.flatMap((r) => (r.current ? [r.uploaded, r.current] : [r.uploaded]))
}

/** Every state anyone has reported this drop in. */
async function reportedHashes(db: D1Database, shareId: string): Promise<string[]> {
	const { results } = await db
		.prepare("SELECT content_hashes FROM reports WHERE drop_id = ? AND content_hashes IS NOT NULL")
		.bind(shareId)
		.all<{ content_hashes: string }>()
	return results.flatMap((r) => {
		try {
			const parsed = JSON.parse(r.content_hashes) as unknown
			return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : []
		} catch {
			return []
		}
	})
}

/** What a drop's files currently hash to — the state a reporter is looking at. */
export async function currentHashes(db: D1Database, shareId: string): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT COALESCE(cur.content_hash, f.content_hash) AS hash
			 FROM files f LEFT JOIN file_current cur ON cur.file_id = f.id
			 WHERE f.drop_id = ? ORDER BY f.position`,
		)
		.bind(shareId)
		.all<{ hash: string }>()
	return results.map((r) => r.hash)
}

/** Delete every drop whose sliding TTL has elapsed. Returns the number removed. */
export async function deleteExpired(db: D1Database, now: number): Promise<number> {
	const { results } = await db
		.prepare("SELECT id FROM drops WHERE expires_at IS NOT NULL AND expires_at < ?")
		.bind(now)
		.all<{ id: string }>()
	if (results.length === 0) return 0

	const ids = results.map((r) => r.id)
	const placeholders = ids.map(() => "?").join(", ")
	const children = `(SELECT id FROM files WHERE drop_id IN (${placeholders}))`
	await db.batch([
		db.prepare(`DELETE FROM file_versions WHERE file_id IN ${children}`).bind(...ids),
		db.prepare(`DELETE FROM file_current WHERE file_id IN ${children}`).bind(...ids),
		db.prepare(`DELETE FROM file_content WHERE file_id IN ${children}`).bind(...ids),
		db.prepare(`DELETE FROM files WHERE drop_id IN (${placeholders})`).bind(...ids),
		db.prepare(`DELETE FROM drops WHERE id IN (${placeholders})`).bind(...ids),
	])
	return ids.length
}

/** Insert an abuse report. Returns false if this reporter already has an open report on the drop. */
export async function insertReport(
	db: D1Database,
	params: {
		shareId: string
		reason: ReportReason
		details: string | null
		reporterHash: string | null
		/** What the drop's files hashed to when this was filed. */
		contentHashes: string[]
		now: number
	},
): Promise<boolean> {
	try {
		await db
			.prepare(
				`INSERT INTO reports (drop_id, reason, details, reporter, status, created_at, content_hashes)
				 VALUES (?, ?, ?, ?, 'open', ?, ?)`,
			)
			.bind(
				params.shareId,
				params.reason,
				params.details,
				params.reporterHash,
				params.now,
				JSON.stringify(params.contentHashes),
			)
			.run()
		return true
	} catch (err) {
		// Unique index on (drop_id, reporter) WHERE status='open' — duplicate is a no-op success.
		if (err instanceof Error && /UNIQUE|constraint/i.test(err.message)) return false
		throw err
	}
}

/** A report joined with basic drop metadata, for the admin queue. */
export interface ReportView {
	id: number
	drop_id: string
	reason: ReportReason
	details: string | null
	status: string
	created_at: number
	drop_exists: number
	/**
	 * Whether the drop still holds the content that was reported.
	 *
	 * `"same"` — what you will see is what was reported. `"edited"` — it has
	 * changed since, so judge the report on its description and the history, not
	 * on what the page shows now. `"unknown"` — filed before reports recorded it.
	 */
	reported_state: "same" | "edited" | "unknown"
}

/** List reports by status (default open), newest first. */
export async function listReports(
	db: D1Database,
	status: string,
	limit = 100,
): Promise<ReportView[]> {
	const { results } = await db
		.prepare(
			`SELECT r.id, r.drop_id, r.reason, r.details, r.status, r.created_at, r.content_hashes,
			        (SELECT COUNT(*) FROM drops d WHERE d.id = r.drop_id) AS drop_exists
			 FROM reports r WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ?`,
		)
		.bind(status, limit)
		.all<Omit<ReportView, "reported_state"> & { content_hashes: string | null }>()

	// Compared per report rather than in SQL: the set is small, and the answer is
	// about two lists being equal, which SQL states badly.
	return await Promise.all(
		results.map(async ({ content_hashes, ...row }) => ({
			...row,
			reported_state: await compareReported(db, row.drop_id, content_hashes),
		})),
	)
}

/** Whether a drop still holds what a report recorded. */
async function compareReported(
	db: D1Database,
	shareId: string,
	recorded: string | null,
): Promise<"same" | "edited" | "unknown"> {
	if (!recorded) return "unknown"
	let reported: string[]
	try {
		reported = JSON.parse(recorded) as string[]
	} catch {
		return "unknown"
	}
	const now = await currentHashes(db, shareId)
	// A deleted drop has no current state to differ from; the report stands as
	// filed, which is what "same" means here.
	if (now.length === 0) return "same"
	return reported.length === now.length && reported.every((h, i) => h === now[i])
		? "same"
		: "edited"
}

/** Update a report's status. Returns false if the id was unknown. */
export async function setReportStatus(
	db: D1Database,
	id: number,
	status: "resolved" | "dismissed",
): Promise<boolean> {
	const res = await db.prepare("UPDATE reports SET status = ? WHERE id = ?").bind(status, id).run()
	return (res.meta.changes ?? 0) > 0
}

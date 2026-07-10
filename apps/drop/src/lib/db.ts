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

/** Fetch one stored representation of a file by drop + filename. Returns null if unknown. */
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

/** Record a view: bump the counter and slide the retention window forward. */
export async function recordView(db: D1Database, shareId: string, now: number): Promise<void> {
	await db
		.prepare(
			"UPDATE drops SET view_count = view_count + 1, last_viewed_at = ?, expires_at = ? WHERE id = ?",
		)
		.bind(now, now + RETENTION_MS, shareId)
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
		const hashes = [...new Set(await hashesForDrop(db, shareId))]
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

	statements.push(
		db
			.prepare("DELETE FROM file_content WHERE file_id IN (SELECT id FROM files WHERE drop_id = ?)")
			.bind(shareId),
		db.prepare("DELETE FROM files WHERE drop_id = ?").bind(shareId),
		db.prepare("DELETE FROM drops WHERE id = ?").bind(shareId),
	)

	await db.batch(statements)
	return true
}

async function hashesForDrop(db: D1Database, shareId: string): Promise<string[]> {
	const { results } = await db
		.prepare("SELECT content_hash FROM files WHERE drop_id = ?")
		.bind(shareId)
		.all<{ content_hash: string }>()
	return results.map((r) => r.content_hash)
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
	await db.batch([
		db
			.prepare(
				`DELETE FROM file_content WHERE file_id IN (SELECT id FROM files WHERE drop_id IN (${placeholders}))`,
			)
			.bind(...ids),
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
		now: number
	},
): Promise<boolean> {
	try {
		await db
			.prepare(
				`INSERT INTO reports (drop_id, reason, details, reporter, status, created_at)
				 VALUES (?, ?, ?, ?, 'open', ?)`,
			)
			.bind(params.shareId, params.reason, params.details, params.reporterHash, params.now)
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
}

/** List reports by status (default open), newest first. */
export async function listReports(
	db: D1Database,
	status: string,
	limit = 100,
): Promise<ReportView[]> {
	const { results } = await db
		.prepare(
			`SELECT r.id, r.drop_id, r.reason, r.details, r.status, r.created_at,
			        (SELECT COUNT(*) FROM drops d WHERE d.id = r.drop_id) AS drop_exists
			 FROM reports r WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ?`,
		)
		.bind(status, limit)
		.all<ReportView>()
	return results
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

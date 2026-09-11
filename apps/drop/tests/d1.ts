/**
 * A D1 stand-in backed by Node's built-in SQLite, so the version log can be
 * tested against the real migration SQL rather than a hand-stubbed result.
 *
 * The existing route tests stub `prepare()` to return canned values, which is
 * right for a route but proves nothing about a bucket upsert or a prune. This
 * runs the statements. It implements only the slice of the D1 surface
 * `src/lib` actually uses — `prepare().bind().first()/all()/run()` and
 * `batch()` — and nothing more.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

type Row = Record<string, unknown>

function normalise(row: Row | undefined): Row | null {
	// node:sqlite returns null-prototype objects; tests compare against literals.
	return row ? { ...row } : null
}

/** Applies every migration in `migrations/`, in filename order, to a fresh database. */
export function migratedDb(): D1Database {
	const db = new DatabaseSync(":memory:")
	db.exec("PRAGMA foreign_keys = ON")
	const dir = join(import.meta.dirname, "..", "migrations")
	for (const file of readdirSync(dir).sort()) {
		if (file.endsWith(".sql")) db.exec(readFileSync(join(dir, file), "utf8"))
	}
	return wrap(db)
}

function wrap(db: DatabaseSync): D1Database {
	function prepare(sql: string): D1PreparedStatement {
		let params: unknown[] = []
		const stmt: D1PreparedStatement = {
			bind(...args: unknown[]) {
				params = args
				return stmt
			},
			async first<T>(column?: string) {
				const row = normalise(db.prepare(sql).get(...(params as never[])) as Row | undefined)
				if (row === null) return null
				return (column === undefined ? row : row[column]) as T
			},
			async all<T>() {
				const results = (db.prepare(sql).all(...(params as never[])) as Row[]).map(
					(r) => ({ ...r }) as T,
				)
				return { results, success: true, meta: {} } as D1Result<T>
			},
			async run<T>() {
				const info = db.prepare(sql).run(...(params as never[]))
				return {
					results: [] as T[],
					success: true,
					meta: { changes: Number(info.changes) },
				} as unknown as D1Result<T>
			},
			raw: async () => [],
		} as unknown as D1PreparedStatement
		return stmt
	}

	return {
		prepare,
		async batch<T>(statements: D1PreparedStatement[]) {
			// D1 runs a batch as one transaction; so does this, so a half-applied
			// prune can never be what a test observes.
			db.exec("BEGIN")
			try {
				const out: D1Result<T>[] = []
				for (const s of statements) out.push(await s.run<T>())
				db.exec("COMMIT")
				return out
			} catch (err) {
				db.exec("ROLLBACK")
				throw err
			}
		},
		async exec(sql: string) {
			db.exec(sql)
			return { count: 0, duration: 0 }
		},
		dump: async () => new ArrayBuffer(0),
		withSession: () => {
			throw new Error("not implemented")
		},
	} as unknown as D1Database
}

/** Inserts a drop with one file, matching what `insertDrop` writes. */
export function seedFile(
	db: D1Database,
	opts: { shareId?: string; fileId?: string; body?: string; hash?: string; now?: number } = {},
): { shareId: string; fileId: string; hash: string; body: string; now: number } {
	const shareId = opts.shareId ?? "share1"
	const fileId = opts.fileId ?? "file1"
	const body = opts.body ?? "<definitions/>"
	const hash = opts.hash ?? "hash-original"
	const now = opts.now ?? 1_000_000

	const raw = db as unknown as {
		prepare(sql: string): { bind(...a: unknown[]): { run(): Promise<unknown> } }
	}
	void raw
		.prepare(
			`INSERT INTO drops (id, file_count, size_total, tos_version, created_at, last_viewed_at, view_count, expires_at)
			 VALUES (?, 1, ?, '2026-07-09', ?, ?, 0, ?)`,
		)
		.bind(shareId, body.length, now, now, now + 1)
		.run()
	void raw
		.prepare(
			`INSERT INTO files (id, drop_id, position, kind, filename, name, content_hash, size_original, size_json, meta)
			 VALUES (?, ?, 0, 'bpmn', 'order.bpmn', 'Order', ?, ?, ?, '{}')`,
		)
		.bind(fileId, shareId, hash, body.length, body.length)
		.run()
	void raw
		.prepare("INSERT INTO file_content (file_id, rep, body) VALUES (?, 'original', ?)")
		.bind(fileId, body)
		.run()
	void raw
		.prepare("INSERT INTO file_content (file_id, rep, body) VALUES (?, 'json', ?)")
		.bind(fileId, "{}")
		.run()

	return { shareId, fileId, hash, body, now }
}

/** Counts a file's stored milestones — the number the bound is stated in. */
export async function milestoneCount(db: D1Database, fileId: string): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) AS n FROM file_versions WHERE file_id = ?")
		.bind(fileId)
		.first<{ n: number }>()
	return row?.n ?? 0
}

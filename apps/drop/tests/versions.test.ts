import { beforeEach, describe, expect, it } from "vitest"
import {
	appendMilestone,
	bucketKey,
	getVersionBody,
	latestVersion,
	listVersions,
	setCurrent,
	versionLabel,
} from "../src/lib/versions.js"
import { MAX_MILESTONES, MILESTONE_BUCKET_MS } from "../src/shared/constants.js"
import { migratedDb, milestoneCount, seedFile } from "./d1.js"

const HOUR = MILESTONE_BUCKET_MS

let db: D1Database
let file: ReturnType<typeof seedFile>

beforeEach(() => {
	db = migratedDb()
	file = seedFile(db)
})

/** Appends a milestone whose content differs every time, so nothing is suppressed. */
function save(n: number, now: number, sessionId = "s1") {
	return appendMilestone(db, {
		fileId: file.fileId,
		body: `<definitions n="${n}"/>`,
		contentHash: `hash-${n}`,
		semanticHash: `sem-${n}`,
		sessionId,
		now,
	})
}

describe("the bound", () => {
	it("keeps at most MAX_MILESTONES, however long anyone edits", async () => {
		// 500 saves across 40 hours and 12 sessions — the acceptance case from
		// doc/drop-live-editing-plan.md §3.
		let n = 0
		for (let session = 0; session < 12; session++) {
			for (let i = 0; i < 42; i++) {
				n++
				await save(n, file.now + session * 4 * HOUR + i * 90_000, `s${session}`)
			}
		}
		expect(n).toBeGreaterThanOrEqual(500)
		expect(await milestoneCount(db, file.fileId)).toBe(MAX_MILESTONES)
	})

	it("keeps the newest milestones, not the oldest", async () => {
		for (let i = 1; i <= MAX_MILESTONES + 5; i++) await save(i, file.now + i * HOUR, `s${i}`)
		const latest = await latestVersion(db, file.fileId)
		expect(latest?.content_hash).toBe(`hash-${MAX_MILESTONES + 5}`)
		// The pruned ones are genuinely gone, not merely hidden.
		expect(await getVersionBody(db, file.fileId, 1)).toBeNull()
		expect(await getVersionBody(db, file.fileId, MAX_MILESTONES + 5)).not.toBeNull()
	})

	it("never touches the uploaded original — it is not in the ring", async () => {
		for (let i = 1; i <= MAX_MILESTONES + 20; i++) await save(i, file.now + i * HOUR, `s${i}`)
		const original = await db
			.prepare("SELECT body FROM file_content WHERE file_id = ? AND rep = 'original'")
			.bind(file.fileId)
			.first<{ body: string }>()
		expect(original?.body).toBe(file.body)
	})
})

describe("collapsing", () => {
	it("collapses an hour of one session into a single milestone", async () => {
		for (let i = 0; i < 40; i++) await save(i, file.now + i * 60_000) // 40 minutes
		expect(await milestoneCount(db, file.fileId)).toBe(1)
	})

	it("starts a new milestone when the hour rolls over", async () => {
		await save(1, file.now)
		await save(2, file.now + HOUR)
		expect(await milestoneCount(db, file.fileId)).toBe(2)
	})

	it("starts a new milestone for a new session inside the same hour", async () => {
		// The 10:45 case: a stranger's save must not overwrite the previous
		// editor's milestone just because it lands in the same hour.
		await save(1, file.now, "anna")
		await save(2, file.now + 15 * 60_000, "stranger")
		expect(await milestoneCount(db, file.fileId)).toBe(2)
		expect((await getVersionBody(db, file.fileId, 1))?.body).toBe('<definitions n="1"/>')
	})

	it("reports whether it replaced or appended", async () => {
		expect(await save(1, file.now)).toEqual({ written: true, seq: 1, replaced: false })
		expect(await save(2, file.now + 60_000)).toEqual({ written: true, seq: 1, replaced: true })
		expect(await save(3, file.now + HOUR)).toEqual({ written: true, seq: 2, replaced: false })
	})

	it("accumulates the op count across a collapsed bucket", async () => {
		const base = {
			fileId: file.fileId,
			semanticHash: "sem",
			sessionId: "s1",
			body: "<a/>",
		}
		await appendMilestone(db, { ...base, contentHash: "h1", opCount: 3, now: file.now })
		await appendMilestone(db, { ...base, contentHash: "h2", opCount: 4, now: file.now + 60_000 })
		expect((await latestVersion(db, file.fileId))?.op_count).toBe(7)
	})
})

describe("suppression", () => {
	it("writes nothing when the content matches the original", async () => {
		const result = await appendMilestone(db, {
			fileId: file.fileId,
			body: file.body,
			contentHash: file.hash, // identical to the upload
			semanticHash: "sem",
			sessionId: "s1",
			now: file.now,
		})
		expect(result).toEqual({ written: false, reason: "unchanged" })
		expect(await milestoneCount(db, file.fileId)).toBe(0)
	})

	it("writes nothing when the content matches the newest milestone", async () => {
		await save(1, file.now)
		const again = await appendMilestone(db, {
			fileId: file.fileId,
			body: '<definitions n="1"/>',
			contentHash: "hash-1",
			semanticHash: "sem-1",
			sessionId: "s2",
			now: file.now + HOUR,
		})
		expect(again).toEqual({ written: false, reason: "unchanged" })
		expect(await milestoneCount(db, file.fileId)).toBe(1)
	})

	it("does not suppress a layout-only change — the hashes that differ are the content ones", async () => {
		// semanticHash excludes all diagram interchange, so an hour of pure
		// layout work hashes identically. Suppressing on it would throw that away.
		await appendMilestone(db, {
			fileId: file.fileId,
			body: "<moved/>",
			contentHash: "hash-moved",
			semanticHash: "sem-same",
			sessionId: "s1",
			now: file.now,
		})
		await appendMilestone(db, {
			fileId: file.fileId,
			body: "<moved-again/>",
			contentHash: "hash-moved-again",
			semanticHash: "sem-same",
			sessionId: "s2",
			now: file.now + HOUR,
		})
		expect(await milestoneCount(db, file.fileId)).toBe(2)
	})

	it("a claim-and-leave never consumes a slot", async () => {
		for (let i = 0; i < 50; i++) {
			await appendMilestone(db, {
				fileId: file.fileId,
				body: file.body,
				contentHash: file.hash,
				semanticHash: "sem",
				sessionId: `s${i}`,
				now: file.now + i * HOUR,
			})
		}
		expect(await milestoneCount(db, file.fileId)).toBe(0)
	})
})

describe("bucketKey", () => {
	it("is stable inside an hour and moves across one", () => {
		expect(bucketKey(0, "s")).toBe(bucketKey(HOUR - 1, "s"))
		expect(bucketKey(0, "s")).not.toBe(bucketKey(HOUR, "s"))
	})

	it("separates sessions", () => {
		expect(bucketKey(0, "anna")).not.toBe(bucketKey(0, "ben"))
	})
})

describe("versionLabel", () => {
	const prev = { content_hash: "a", semantic_hash: "s" }

	it("calls the first entry the original", () => {
		expect(versionLabel(null, prev)).toBe("original")
	})

	it("calls an unchanged-semantics edit layout-only", () => {
		expect(versionLabel(prev, { content_hash: "b", semantic_hash: "s" })).toBe("layout")
	})

	it("calls a changed-semantics edit a model change", () => {
		expect(versionLabel(prev, { content_hash: "b", semantic_hash: "t" })).toBe("model")
	})
})

describe("listVersions", () => {
	const original = {
		createdAt: 500,
		bytes: 13,
		contentHash: "hash-original",
		semanticHash: "sem-0",
	}

	it("ends in the uploaded original, newest first", async () => {
		await save(1, file.now, "s1")
		await save(2, file.now + HOUR, "s2")
		await save(3, file.now + 2 * HOUR, "s3")

		const entries = await listVersions(db, file.fileId, original)
		expect(entries.map((e) => e.seq)).toEqual([3, 2, 1, 0])
		expect(entries.at(-1)?.label).toBe("original")
		expect(entries.at(-1)?.createdAt).toBe(500)
	})

	it("labels each milestone against the one before it", async () => {
		await appendMilestone(db, {
			fileId: file.fileId,
			body: "<a/>",
			contentHash: "h1",
			semanticHash: "sem-0", // same meaning as the original: a layout edit
			sessionId: "s1",
			now: file.now,
		})
		await appendMilestone(db, {
			fileId: file.fileId,
			body: "<b/>",
			contentHash: "h2",
			semanticHash: "sem-changed",
			sessionId: "s2",
			now: file.now + HOUR,
		})

		const entries = await listVersions(db, file.fileId, original)
		expect(entries.find((e) => e.seq === 1)?.label).toBe("layout")
		expect(entries.find((e) => e.seq === 2)?.label).toBe("model")
	})

	it("is just the original for a drop nobody has edited", async () => {
		const entries = await listVersions(db, file.fileId, original)
		expect(entries).toHaveLength(1)
		expect(entries[0]?.seq).toBe(0)
	})
})

describe("setCurrent", () => {
	it("replaces the live state without touching the original", async () => {
		await setCurrent(db, {
			fileId: file.fileId,
			shareId: file.shareId,
			body: "<edited/>",
			json: '{"edited":true}',
			contentHash: "hash-edited",
			expiresAt: file.now + 999,
			now: file.now + 5,
		})
		const current = await db
			.prepare("SELECT body, json, content_hash FROM file_current WHERE file_id = ?")
			.bind(file.fileId)
			.first<{ body: string; json: string; content_hash: string }>()
		expect(current).toEqual({
			body: "<edited/>",
			json: '{"edited":true}',
			content_hash: "hash-edited",
		})

		const original = await db
			.prepare("SELECT body FROM file_content WHERE file_id = ? AND rep = 'original'")
			.bind(file.fileId)
			.first<{ body: string }>()
		expect(original?.body).toBe(file.body)
	})

	it("is an upsert — a second edit replaces the first", async () => {
		const base = {
			fileId: file.fileId,
			shareId: file.shareId,
			json: "{}",
			expiresAt: file.now + 999,
		}
		await setCurrent(db, { ...base, body: "<one/>", contentHash: "h1", now: file.now + 1 })
		await setCurrent(db, { ...base, body: "<two/>", contentHash: "h2", now: file.now + 2 })
		const rows = await db
			.prepare("SELECT COUNT(*) AS n FROM file_current WHERE file_id = ?")
			.bind(file.fileId)
			.first<{ n: number }>()
		expect(rows?.n).toBe(1)
	})

	it("slides retention forward, so an edited drop does not expire underneath its editors", async () => {
		await setCurrent(db, {
			fileId: file.fileId,
			shareId: file.shareId,
			body: "<edited/>",
			json: "{}",
			contentHash: "hash-edited",
			expiresAt: 9_999_999,
			now: file.now + 5,
		})
		const drop = await db
			.prepare("SELECT expires_at, updated_at FROM drops WHERE id = ?")
			.bind(file.shareId)
			.first<{ expires_at: number; updated_at: number }>()
		expect(drop?.expires_at).toBe(9_999_999)
		expect(drop?.updated_at).toBe(file.now + 5)
	})
})

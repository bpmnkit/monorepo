import { beforeEach, describe, expect, it } from "vitest"
import { recordViews } from "../src/lib/db.js"
import { migratedDb, seedFile } from "./d1.js"

let db: D1Database
let file: ReturnType<typeof seedFile>

beforeEach(() => {
	db = migratedDb()
	file = seedFile(db)
})

async function drop() {
	return await db
		.prepare("SELECT view_count, last_viewed_at, expires_at FROM drops WHERE id = ?")
		.bind(file.shareId)
		.first<{ view_count: number; last_viewed_at: number; expires_at: number }>()
}

describe("recordViews", () => {
	it("adds a whole window's views in one write", async () => {
		// The room batches joins and flushes once; fifty viewers must land as fifty
		// views, not one, and not fifty writes.
		await recordViews(db, file.shareId, 50, 2_000_000, 9_000_000)
		expect((await drop())?.view_count).toBe(50)
	})

	it("accumulates across flushes", async () => {
		await recordViews(db, file.shareId, 3, 2_000_000, 9_000_000)
		await recordViews(db, file.shareId, 4, 2_100_000, 9_100_000)
		expect((await drop())?.view_count).toBe(7)
	})

	it("slides retention forward", async () => {
		await recordViews(db, file.shareId, 1, 2_000_000, 9_000_000)
		const row = await drop()
		expect(row?.last_viewed_at).toBe(2_000_000)
		expect(row?.expires_at).toBe(9_000_000)
	})

	it("writes nothing for an empty window", async () => {
		const before = await drop()
		await recordViews(db, file.shareId, 0, 2_000_000, 9_000_000)
		// An alarm that fires with nothing pending must not touch the row at all —
		// otherwise it would slide retention for a drop nobody opened.
		expect(await drop()).toEqual(before)
	})

	it("ignores a negative count rather than crediting it backwards", async () => {
		await recordViews(db, file.shareId, 5, 2_000_000, 9_000_000)
		await recordViews(db, file.shareId, -3, 2_100_000, 9_100_000)
		expect((await drop())?.view_count).toBe(5)
	})

	it("leaves other drops alone", async () => {
		const other = seedFile(db, { shareId: "share2", fileId: "file2" })
		await recordViews(db, file.shareId, 9, 2_000_000, 9_000_000)
		const row = await db
			.prepare("SELECT view_count FROM drops WHERE id = ?")
			.bind(other.shareId)
			.first<{ view_count: number }>()
		expect(row?.view_count).toBe(0)
	})
})

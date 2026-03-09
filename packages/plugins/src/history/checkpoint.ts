const DB_NAME = "bpmn-sdk-ai"
const STORE = "checkpoints"
const MAX_TODAY = 50
const HISTORICAL_DAYS = 10

export interface Checkpoint {
	id: string
	projectId: string
	fileId: string
	timestamp: number
	xml: string
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: "id" })
				store.createIndex("byFile", ["projectId", "fileId"], { unique: false })
				store.createIndex("byTimestamp", "timestamp", { unique: false })
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

export async function saveCheckpoint(
	projectId: string,
	fileId: string,
	xml: string,
): Promise<void> {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite")
		const store = tx.objectStore(STORE)

		const getReq = store.index("byFile").getAll(IDBKeyRange.only([projectId, fileId]))
		getReq.onsuccess = () => {
			const existing = getReq.result as Checkpoint[]

			const todayStart = new Date()
			todayStart.setHours(0, 0, 0, 0)
			const todayMs = todayStart.getTime()
			const cutoffMs = todayMs - HISTORICAL_DAYS * 24 * 60 * 60 * 1000

			// Today's checkpoints — keep MAX_TODAY - 1 (oldest pruned first)
			const todayOnes = existing
				.filter((cp) => cp.timestamp >= todayMs)
				.sort((a, b) => a.timestamp - b.timestamp)
			for (const cp of todayOnes.slice(0, Math.max(0, todayOnes.length - (MAX_TODAY - 1)))) {
				store.delete(cp.id)
			}

			// Historical checkpoints — keep 1 (latest) per day, prune older than cutoff
			const historical = existing.filter((cp) => cp.timestamp >= cutoffMs && cp.timestamp < todayMs)
			const byDay = new Map<string, Checkpoint[]>()
			for (const cp of historical) {
				const d = new Date(cp.timestamp)
				const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
				const arr = byDay.get(key) ?? []
				arr.push(cp)
				byDay.set(key, arr)
			}
			for (const [, cps] of byDay) {
				const sorted = cps.sort((a, b) => b.timestamp - a.timestamp)
				for (const cp of sorted.slice(1)) store.delete(cp.id)
			}
			// Delete anything beyond the historical window
			for (const cp of existing.filter((c) => c.timestamp < cutoffMs)) {
				store.delete(cp.id)
			}

			store.add({
				id: crypto.randomUUID(),
				projectId,
				fileId,
				timestamp: Date.now(),
				xml,
			} satisfies Checkpoint)
		}

		tx.oncomplete = () => {
			db.close()
			resolve()
		}
		tx.onerror = () => {
			db.close()
			reject(tx.error)
		}
	})
}

export async function listCheckpoints(projectId: string, fileId: string): Promise<Checkpoint[]> {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly")
		const store = tx.objectStore(STORE)
		const req = store.index("byFile").getAll(IDBKeyRange.only([projectId, fileId]))
		req.onsuccess = () => {
			db.close()
			resolve((req.result as Checkpoint[]).sort((a, b) => b.timestamp - a.timestamp))
		}
		req.onerror = () => {
			db.close()
			reject(req.error)
		}
	})
}

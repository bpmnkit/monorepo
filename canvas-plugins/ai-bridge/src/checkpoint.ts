const DB_NAME = "bpmn-sdk-ai";
const STORE = "checkpoints";
const MAX_PER_FILE = 50;

export interface Checkpoint {
	id: string;
	projectId: string;
	fileId: string;
	timestamp: number;
	xml: string;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: "id" });
				store.createIndex("byFile", ["projectId", "fileId"], { unique: false });
				store.createIndex("byTimestamp", "timestamp", { unique: false });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveCheckpoint(
	projectId: string,
	fileId: string,
	xml: string,
): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		const store = tx.objectStore(STORE);

		const getReq = store.index("byFile").getAll(IDBKeyRange.only([projectId, fileId]));
		getReq.onsuccess = () => {
			const existing = (getReq.result as Checkpoint[]).sort((a, b) => a.timestamp - b.timestamp);
			// Prune oldest if at limit
			const toDelete = existing.slice(0, Math.max(0, existing.length - (MAX_PER_FILE - 1)));
			for (const cp of toDelete) {
				store.delete(cp.id);
			}
			store.add({
				id: crypto.randomUUID(),
				projectId,
				fileId,
				timestamp: Date.now(),
				xml,
			} satisfies Checkpoint);
		};

		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

export async function listCheckpoints(projectId: string, fileId: string): Promise<Checkpoint[]> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly");
		const store = tx.objectStore(STORE);
		const req = store.index("byFile").getAll(IDBKeyRange.only([projectId, fileId]));
		req.onsuccess = () => {
			db.close();
			resolve((req.result as Checkpoint[]).sort((a, b) => b.timestamp - a.timestamp));
		};
		req.onerror = () => {
			db.close();
			reject(req.error);
		};
	});
}

import type {
	FileContentRecord,
	FileRecord,
	ProjectMruRecord,
	ProjectRecord,
	WorkspaceRecord,
} from "./types.js";

const DB_NAME = "bpmn-sdk-storage";
// Dexie 4.x internally stored version 10 for user-space version 1.
// Use 12 to add the projectMru object store.
const DB_VERSION = 12;

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const r = indexedDB.open(DB_NAME, DB_VERSION);
		r.onupgradeneeded = () => {
			const d = r.result;
			// Guard each store: Dexie may have already created them at version 10.
			if (!d.objectStoreNames.contains("workspaces")) {
				const ws = d.createObjectStore("workspaces", { keyPath: "id" });
				ws.createIndex("name", "name");
			}
			if (!d.objectStoreNames.contains("projects")) {
				const prj = d.createObjectStore("projects", { keyPath: "id" });
				prj.createIndex("workspaceId", "workspaceId");
			}
			if (!d.objectStoreNames.contains("files")) {
				const fl = d.createObjectStore("files", { keyPath: "id" });
				fl.createIndex("projectId", "projectId");
				fl.createIndex("workspaceId", "workspaceId");
			}
			if (!d.objectStoreNames.contains("fileContents")) {
				d.createObjectStore("fileContents", { keyPath: "fileId" });
			}
			if (!d.objectStoreNames.contains("projectMru")) {
				d.createObjectStore("projectMru", { keyPath: "projectId" });
			}
		};
		r.onsuccess = () => {
			_db = r.result;
			resolve(_db);
		};
		r.onerror = () => reject(r.error);
	});
}

function getDb(): Promise<IDBDatabase> {
	return _db !== null ? Promise.resolve(_db) : openDb();
}

function wrap<T>(r: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});
}

function sorted<T>(items: T[], field: string): T[] {
	return [...items].sort((a, b) => {
		const av = String((a as unknown as Record<string, unknown>)[field] ?? "");
		const bv = String((b as unknown as Record<string, unknown>)[field] ?? "");
		return av.localeCompare(bv);
	});
}

function makeTable<T>(name: string) {
	async function fetchAll(index?: string, value?: string): Promise<T[]> {
		const d = await getDb();
		const os = d.transaction(name, "readonly").objectStore(name);
		const r =
			index !== undefined && value !== undefined ? os.index(index).getAll(value) : os.getAll();
		return wrap<T[]>(r as IDBRequest<T[]>);
	}

	return {
		async get(key: string): Promise<T | undefined> {
			const d = await getDb();
			return wrap<T | undefined>(
				d.transaction(name, "readonly").objectStore(name).get(key) as IDBRequest<T | undefined>,
			);
		},

		async add(record: T): Promise<void> {
			const d = await getDb();
			await wrap(d.transaction(name, "readwrite").objectStore(name).add(record));
		},

		async update(key: string, changes: Partial<T>): Promise<void> {
			const d = await getDb();
			const tx = d.transaction(name, "readwrite");
			const os = tx.objectStore(name);
			const current = await wrap<T | undefined>(os.get(key) as IDBRequest<T | undefined>);
			if (current !== undefined) {
				await wrap(os.put(Object.assign({}, current, changes)));
			}
		},

		async delete(key: string): Promise<void> {
			const d = await getDb();
			await wrap(d.transaction(name, "readwrite").objectStore(name).delete(key));
		},

		orderBy(field: string) {
			return {
				toArray: (): Promise<T[]> => fetchAll().then((items) => sorted(items, field)),
			};
		},

		where(index: string) {
			return {
				equals: (value: string) => ({
					toArray: (): Promise<T[]> => fetchAll(index, value),
					sortBy: (field: string): Promise<T[]> =>
						fetchAll(index, value).then((items) => sorted(items, field)),
					delete: async (): Promise<void> => {
						const d = await getDb();
						const tx = d.transaction(name, "readwrite");
						const os = tx.objectStore(name);
						const keys = await wrap(os.index(index).getAllKeys(value));
						await Promise.all(keys.map((k) => wrap(os.delete(k))));
					},
				}),
			};
		},

		filter: (pred: (item: T) => boolean) => ({
			toArray: (): Promise<T[]> => fetchAll().then((items) => items.filter(pred)),
		}),
	};
}

export const db = {
	workspaces: makeTable<WorkspaceRecord>("workspaces"),
	projects: makeTable<ProjectRecord>("projects"),
	files: makeTable<FileRecord>("files"),
	fileContents: makeTable<FileContentRecord>("fileContents"),
	projectMru: makeTable<ProjectMruRecord>("projectMru"),
};

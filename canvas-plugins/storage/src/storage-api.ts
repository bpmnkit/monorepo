import { AutoSave } from "./auto-save.js";
import { db } from "./db.js";
import type {
	FileContentRecord,
	FileRecord,
	FileType,
	ProjectRecord,
	WorkspaceRecord,
} from "./types.js";

export interface StorageApiOptions {
	/** Called when the user opens a file from the menu. */
	onOpenFile(file: FileRecord, content: string): void;
}

const CURRENT_PROJECT_KEY = "bpmn-sdk-current-project";

function now(): number {
	return Date.now();
}

function newId(): string {
	return crypto.randomUUID();
}

export class StorageApi {
	private _currentFileId: string | null = null;
	private _currentProjectId: string | null;
	private readonly _autoSave: AutoSave;
	private _listeners: Array<() => void> = [];

	// In-memory caches for synchronous menu building
	private _workspaces: WorkspaceRecord[] = [];
	private _projects = new Map<string, ProjectRecord[]>();

	constructor(private readonly _options: StorageApiOptions) {
		this._currentProjectId = localStorage.getItem(CURRENT_PROJECT_KEY);
		this._autoSave = new AutoSave(async (fileId, content) => {
			await this._persistContent(fileId, content);
			this._notify();
		});
	}

	/** Load caches and restore last-opened project. Returns the project files if restoring. */
	async initialize(): Promise<FileRecord[] | null> {
		this._workspaces = await db.workspaces.orderBy("name").toArray();
		for (const ws of this._workspaces) {
			const projects = await db.projects.where("workspaceId").equals(ws.id).sortBy("name");
			this._projects.set(ws.id, projects);
		}
		if (this._currentProjectId) {
			const project = await db.projects.get(this._currentProjectId);
			if (project) {
				return db.files.where("projectId").equals(this._currentProjectId).sortBy("name");
			}
			// Project no longer exists — clear persisted id
			this.setCurrentProjectId(null);
		}
		return null;
	}

	getCurrentProjectId(): string | null {
		return this._currentProjectId;
	}

	setCurrentProjectId(id: string | null): void {
		this._currentProjectId = id;
		if (id === null) {
			localStorage.removeItem(CURRENT_PROJECT_KEY);
		} else {
			localStorage.setItem(CURRENT_PROJECT_KEY, id);
		}
	}

	getCachedWorkspaces(): WorkspaceRecord[] {
		return this._workspaces;
	}

	getCachedProjects(wsId: string): ProjectRecord[] {
		return this._projects.get(wsId) ?? [];
	}

	getProjectName(id: string): string | null {
		for (const projects of this._projects.values()) {
			const p = projects.find((pr) => pr.id === id);
			if (p) return p.name;
		}
		return null;
	}

	/** Open a project: sets it as current and returns its files. */
	async openProject(id: string): Promise<FileRecord[]> {
		this.setCurrentProjectId(id);
		const files = await db.files.where("projectId").equals(id).sortBy("name");
		for (const file of files) {
			const content = await this.getFileContent(file.id);
			if (content !== null) {
				this._options.onOpenFile(file, content);
			}
		}
		this._notify();
		return files;
	}

	/**
	 * Save the given open tabs as files in a project, creating new file records
	 * (or updating existing ones by matching name+type) and activating the project.
	 */
	async saveTabsToProject(
		projectId: string,
		workspaceId: string,
		tabs: Array<{ tabId: string; name: string; type: FileType; content: string }>,
	): Promise<string[]> {
		const existingFiles = await db.files.where("projectId").equals(projectId).toArray();
		const fileIdByKey = new Map<string, string>();
		for (const f of existingFiles) {
			fileIdByKey.set(`${f.name}::${f.type}`, f.id);
		}

		const tabIds: string[] = [];
		for (const tab of tabs) {
			const key = `${tab.name}::${tab.type}`;
			const existingId = fileIdByKey.get(key);
			if (existingId) {
				await this._persistContent(existingId, tab.content);
				await db.files.update(existingId, { updatedAt: now() });
				tabIds.push(existingId);
			} else {
				const file = await this.createFile(projectId, workspaceId, tab.name, tab.type, tab.content);
				tabIds.push(file.id);
			}
		}

		this.setCurrentProjectId(projectId);
		this._notify();
		return tabIds;
	}

	// ─── Workspaces ──────────────────────────────────────────────────────────────

	async createWorkspace(name: string): Promise<WorkspaceRecord> {
		const ws: WorkspaceRecord = { id: newId(), name, createdAt: now(), updatedAt: now() };
		await db.workspaces.add(ws);
		this._workspaces = [...this._workspaces, ws].sort((a, b) => a.name.localeCompare(b.name));
		this._notify();
		return ws;
	}

	async getWorkspaces(): Promise<WorkspaceRecord[]> {
		return db.workspaces.orderBy("name").toArray();
	}

	async renameWorkspace(id: string, name: string): Promise<void> {
		await db.workspaces.update(id, { name, updatedAt: now() });
		this._workspaces = this._workspaces.map((w) => (w.id === id ? { ...w, name } : w));
		this._workspaces.sort((a, b) => a.name.localeCompare(b.name));
		this._notify();
	}

	async deleteWorkspace(id: string): Promise<void> {
		const projects = await db.projects.where("workspaceId").equals(id).toArray();
		for (const p of projects) await this._deleteProjectData(p.id);
		await db.workspaces.delete(id);
		this._workspaces = this._workspaces.filter((w) => w.id !== id);
		this._projects.delete(id);
		if (this._currentFileId !== null) {
			const f = await db.files.get(this._currentFileId);
			if (!f || f.workspaceId === id) this._currentFileId = null;
		}
		if (this._currentProjectId) {
			const p = await db.projects.get(this._currentProjectId);
			if (!p || p.workspaceId === id) this.setCurrentProjectId(null);
		}
		this._notify();
	}

	// ─── Projects ────────────────────────────────────────────────────────────────

	async createProject(workspaceId: string, name: string): Promise<ProjectRecord> {
		const p: ProjectRecord = { id: newId(), workspaceId, name, createdAt: now(), updatedAt: now() };
		await db.projects.add(p);
		const existing = this._projects.get(workspaceId) ?? [];
		const updated = [...existing, p].sort((a, b) => a.name.localeCompare(b.name));
		this._projects.set(workspaceId, updated);
		this._notify();
		return p;
	}

	async getProjects(workspaceId: string): Promise<ProjectRecord[]> {
		return db.projects.where("workspaceId").equals(workspaceId).sortBy("name");
	}

	async renameProject(id: string, name: string): Promise<void> {
		await db.projects.update(id, { name, updatedAt: now() });
		for (const [wsId, projects] of this._projects) {
			const idx = projects.findIndex((p) => p.id === id);
			if (idx !== -1) {
				const updated = projects.map((p) => (p.id === id ? { ...p, name } : p));
				updated.sort((a, b) => a.name.localeCompare(b.name));
				this._projects.set(wsId, updated);
				break;
			}
		}
		this._notify();
	}

	async deleteProject(id: string): Promise<void> {
		await this._deleteProjectData(id);
		if (this._currentProjectId === id) this.setCurrentProjectId(null);
		this._notify();
	}

	private async _deleteProjectData(projectId: string): Promise<void> {
		const files = await db.files.where("projectId").equals(projectId).toArray();
		for (const f of files) {
			await db.fileContents.delete(f.id);
			if (this._currentFileId === f.id) this._currentFileId = null;
		}
		await db.files.where("projectId").equals(projectId).delete();
		await db.projects.delete(projectId);
		// Update cache
		for (const [wsId, projects] of this._projects) {
			if (projects.some((p) => p.id === projectId)) {
				this._projects.set(
					wsId,
					projects.filter((p) => p.id !== projectId),
				);
				break;
			}
		}
	}

	// ─── Files ───────────────────────────────────────────────────────────────────

	async createFile(
		projectId: string,
		workspaceId: string,
		name: string,
		type: FileType,
		content: string,
	): Promise<FileRecord> {
		const file: FileRecord = {
			id: newId(),
			projectId,
			workspaceId,
			name,
			type,
			isShared: false,
			gitPath: null,
			createdAt: now(),
			updatedAt: now(),
		};
		const fc: FileContentRecord = { fileId: file.id, content, version: 1 };
		await db.files.add(file);
		await db.fileContents.add(fc);
		this._notify();
		return file;
	}

	async getFiles(projectId: string): Promise<FileRecord[]> {
		return db.files.where("projectId").equals(projectId).sortBy("name");
	}

	async getSharedFiles(): Promise<FileRecord[]> {
		return db.files.filter((f) => f.isShared).toArray();
	}

	async getFileContent(fileId: string): Promise<string | null> {
		const fc = await db.fileContents.get(fileId);
		return fc?.content ?? null;
	}

	async renameFile(id: string, name: string): Promise<void> {
		await db.files.update(id, { name, updatedAt: now() });
		this._notify();
	}

	async setFileShared(id: string, isShared: boolean): Promise<void> {
		await db.files.update(id, { isShared, updatedAt: now() });
		this._notify();
	}

	async deleteFile(id: string): Promise<void> {
		await db.fileContents.delete(id);
		await db.files.delete(id);
		if (this._currentFileId === id) this._currentFileId = null;
		this._notify();
	}

	// ─── Navigation ──────────────────────────────────────────────────────────────

	async openFile(fileId: string): Promise<void> {
		const file = await db.files.get(fileId);
		if (!file) return;
		const content = await this.getFileContent(fileId);
		if (content === null) return;
		this._currentFileId = fileId;
		this._options.onOpenFile(file, content);
		this._notify();
	}

	getCurrentFileId(): string | null {
		return this._currentFileId;
	}

	setCurrentFileId(id: string | null): void {
		this._currentFileId = id;
	}

	getCurrentContext(): { projectId: string; fileId: string } | null {
		if (this._currentProjectId === null || this._currentFileId === null) return null;
		return { projectId: this._currentProjectId, fileId: this._currentFileId };
	}

	// ─── Auto-save ───────────────────────────────────────────────────────────────

	scheduleSave(fileId: string, content: string): void {
		this._autoSave.schedule(fileId, content);
	}

	async flush(): Promise<void> {
		await this._autoSave.flush();
	}

	private async _persistContent(fileId: string, content: string): Promise<void> {
		const existing = await db.fileContents.get(fileId);
		if (existing) {
			await db.fileContents.update(fileId, { content, version: existing.version + 1 });
		} else {
			await db.fileContents.add({ fileId, content, version: 1 });
		}
		const ts = now();
		await db.files.update(fileId, { updatedAt: ts });
		// Bump project's updatedAt so it sorts correctly in getRecentProjects
		if (this._currentProjectId !== null) {
			await db.projects.update(this._currentProjectId, { updatedAt: ts });
			this._updateProjectCacheTimestamp(this._currentProjectId, ts);
		}
	}

	private _updateProjectCacheTimestamp(projectId: string, ts: number): void {
		for (const [wsId, projects] of this._projects) {
			const idx = projects.findIndex((p) => p.id === projectId);
			if (idx === -1) continue;
			this._projects.set(
				wsId,
				projects.map((p) => (p.id === projectId ? { ...p, updatedAt: ts } : p)),
			);
			break;
		}
	}

	// ─── MRU (most-recently-used files per project) ───────────────────────────────

	/** Returns the MRU file-ID list for a project (most recent first). */
	async getMru(projectId: string): Promise<string[]> {
		const record = await db.projectMru.get(projectId);
		return record?.fileIds ?? [];
	}

	/** Pushes a file ID to the front of the project's MRU list (deduplicates, max 50). */
	async pushMruFile(projectId: string, fileId: string): Promise<void> {
		const existing = await db.projectMru.get(projectId);
		const current = existing?.fileIds ?? [];
		const updated = [fileId, ...current.filter((id) => id !== fileId)].slice(0, 50);
		if (existing) {
			await db.projectMru.update(projectId, { fileIds: updated });
		} else {
			await db.projectMru.add({ projectId, fileIds: updated });
		}
	}

	// ─── Recent projects ─────────────────────────────────────────────────────────

	/**
	 * Returns up to 10 projects sorted by most recently saved (descending).
	 * Uses the in-memory cache — call after `initialize()` completes.
	 */
	getRecentProjects(): Array<{ project: ProjectRecord; workspace: WorkspaceRecord }> {
		const result: Array<{ project: ProjectRecord; workspace: WorkspaceRecord }> = [];
		for (const [wsId, projects] of this._projects) {
			const ws = this._workspaces.find((w) => w.id === wsId);
			if (!ws) continue;
			for (const p of projects) {
				result.push({ project: p, workspace: ws });
			}
		}
		return result.sort((a, b) => b.project.updatedAt - a.project.updatedAt).slice(0, 10);
	}

	// ─── Change listeners ─────────────────────────────────────────────────────────

	onChange(cb: () => void): () => void {
		this._listeners.push(cb);
		return () => {
			this._listeners = this._listeners.filter((l) => l !== cb);
		};
	}

	private _notify(): void {
		for (const l of this._listeners) l();
	}
}

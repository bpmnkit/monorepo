import { sharedIndexedDb } from "./indexeddb.js"
import type { FileMeta, FsCapableAdapter, FsEntry, ModelFile } from "./types.js"

function extToType(ext: string): ModelFile["type"] | null {
	switch (ext) {
		case "bpmn":
			return "bpmn"
		case "dmn":
			return "dmn"
		case "form":
			return "form"
		case "md":
			return "md"
		default:
			return null
	}
}

function nameFromPath(relPath: string): string {
	const base = relPath.split("/").pop() ?? relPath
	const dot = base.lastIndexOf(".")
	return dot > 0 ? base.slice(0, dot) : base
}

interface FsFileInfo {
	relativePath: string
	name: string
	absPath: string
	fileType: "bpmn" | "dmn" | "form" | "md"
	content: string
	meta: FileMeta | null
}

/**
 * Storage adapter that reads/writes files through the proxy's /fs/* endpoints.
 * Used when a project folder is selected by the user.
 */
export class ProxyFsAdapter implements FsCapableAdapter {
	readonly supportsFs = true as const

	private readonly proxyUrl: string
	private readonly projectPath: string
	/** Maps stable UUID → relative path within the project. */
	private idToPath = new Map<string, string>()

	constructor(proxyUrl: string, projectPath: string) {
		this.proxyUrl = proxyUrl.replace(/\/$/, "")
		this.projectPath = projectPath
	}

	private absPath(relPath: string): string {
		return `${this.projectPath}/${relPath}`
	}

	/**
	 * `path=<abs>&root=<project>` — the proxy only touches files inside a
	 * workspace root, and naming the root on every call keeps that working
	 * after the proxy restarts, when it has forgotten which roots were opened.
	 */
	private pathQuery(relPath: string): string {
		return `path=${encodeURIComponent(this.absPath(relPath))}&root=${encodeURIComponent(this.projectPath)}`
	}

	private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
		const url = `${this.proxyUrl}${endpoint}`
		const res = await fetch(url, {
			method,
			headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		})
		if (!res.ok) {
			const text = await res.text().catch(() => res.statusText)
			throw new Error(`FS ${method} ${endpoint}: ${res.status} ${text}`)
		}
		return res.json() as Promise<T>
	}

	// ── StorageAdapter ───────────────────────────────────────────────────────

	async listModels(): Promise<ModelFile[]> {
		const files = await this.request<FsFileInfo[]>(
			"GET",
			`/fs/list?root=${encodeURIComponent(this.projectPath)}`,
		)
		this.idToPath.clear()
		const models: ModelFile[] = []
		for (const f of files) {
			const type = extToType(f.fileType)
			if (!type) continue
			const id = f.meta?.id ?? crypto.randomUUID()
			this.idToPath.set(id, f.relativePath)
			models.push({
				id,
				name: f.name,
				type,
				content: f.content,
				path: f.relativePath,
				processDefinitionId: f.meta?.processDefinitionId,
				runVariables: f.meta?.runVariables,
				tags: f.meta?.tags,
				createdAt: f.meta?.createdAt ?? Date.now(),
				updatedAt: Date.now(),
			})
		}
		return models
	}

	async getModel(id: string): Promise<ModelFile | null> {
		const relPath = this.idToPath.get(id)
		if (!relPath) return null
		const [content, meta] = await Promise.all([
			this.request<{ content: string }>("GET", `/fs/read?${this.pathQuery(relPath)}`).then(
				(r) => r.content,
			),
			this.loadMeta(relPath),
		])
		const ext = relPath.split(".").pop() ?? ""
		const type = extToType(ext)
		if (!type) return null
		return {
			id,
			name: nameFromPath(relPath),
			type,
			content,
			path: relPath,
			processDefinitionId: meta?.processDefinitionId,
			runVariables: meta?.runVariables,
			tags: meta?.tags,
			createdAt: meta?.createdAt ?? Date.now(),
			updatedAt: Date.now(),
		}
	}

	async saveModel(model: Omit<ModelFile, "updatedAt">): Promise<ModelFile> {
		const now = Date.now()
		const id = model.id || crypto.randomUUID()
		const relPath = model.path ?? this.idToPath.get(id)
		if (!relPath)
			throw new Error("Cannot save model: no path set (new FS-mode models require a path)")

		const abs = this.absPath(relPath)
		await this.request("POST", "/fs/write", {
			path: abs,
			content: model.content,
			root: this.projectPath,
		})

		const meta: FileMeta = {
			id,
			processDefinitionId: model.processDefinitionId,
			runVariables: model.runVariables,
			tags: model.tags,
			createdAt: model.createdAt || now,
		}
		// Preserve scenarios/inputVars from existing meta
		const existing = await this.loadMeta(relPath)
		if (existing?.scenarios) meta.scenarios = existing.scenarios
		if (existing?.inputVars) meta.inputVars = existing.inputVars
		await this.saveMeta(relPath, meta)

		this.idToPath.set(id, relPath)
		return { ...model, id, path: relPath, updatedAt: now }
	}

	async deleteModel(id: string): Promise<void> {
		const relPath = this.idToPath.get(id)
		if (!relPath) return
		await this.request("DELETE", `/fs/file?${this.pathQuery(relPath)}`)
		this.idToPath.delete(id)
	}

	async getPreference<T>(key: string, fallback: T): Promise<T> {
		return sharedIndexedDb.getPreference(key, fallback)
	}

	async setPreference<T>(key: string, value: T): Promise<void> {
		return sharedIndexedDb.setPreference(key, value)
	}

	// ── FsCapableAdapter ─────────────────────────────────────────────────────

	async listTree(): Promise<FsEntry[]> {
		return this.request<FsEntry[]>("GET", `/fs/tree?root=${encodeURIComponent(this.projectPath)}`)
	}

	async moveModel(fromRelPath: string, toRelPath: string): Promise<ModelFile> {
		const fromAbs = this.absPath(fromRelPath)
		const toAbs = this.absPath(toRelPath)
		await this.request("POST", "/fs/move", { from: fromAbs, to: toAbs, root: this.projectPath })

		// Update UUID cache
		for (const [id, p] of this.idToPath) {
			if (p === fromRelPath) {
				this.idToPath.set(id, toRelPath)
				const model = await this.getModel(id)
				return model ?? Promise.reject(new Error("Move succeeded but model not found"))
			}
		}
		throw new Error(`No model found at path: ${fromRelPath}`)
	}

	async createFolder(relPath: string): Promise<void> {
		const abs = this.absPath(relPath)
		await this.request("POST", "/fs/mkdir", { path: abs, root: this.projectPath })
	}

	async saveMeta(relPath: string, meta: FileMeta): Promise<void> {
		const abs = this.absPath(relPath)
		await this.request("POST", "/fs/meta", { path: abs, meta, root: this.projectPath })
	}

	async loadMeta(relPath: string): Promise<FileMeta | null> {
		try {
			return await this.request<FileMeta>("GET", `/fs/meta?${this.pathQuery(relPath)}`)
		} catch {
			return null
		}
	}
}

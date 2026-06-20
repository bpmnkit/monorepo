import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { Modal } from "@cascivo/react"
import {
	BookOpen,
	ChevronDown,
	ChevronRight,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	Grid,
	List,
	Move,
	Plus,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { StatusPill } from "../components/StatusPill.js"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import { getFsAdapter, isFsMode, storage } from "../storage/index.js"
import type { FsEntry, ModelFile } from "../storage/types.js"
import { useModelsStore } from "../stores/models.js"
import { useProjectsStore } from "../stores/projects.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"
import type { ProcessTemplate } from "../templates/index.js"
import { PROCESS_TEMPLATES } from "../templates/index.js"

type ModelType = "bpmn" | "dmn" | "form" | "md"
type ViewMode = "grid" | "list"

const TYPE_LABELS: Record<ModelType, string> = {
	bpmn: "BPMN",
	dmn: "DMN",
	form: "Form",
	md: "Markdown",
}

function makeEmptyContent(type: ModelType, name: string): string {
	const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-")
	if (type === "bpmn") return Bpmn.makeEmpty(id, name)
	if (type === "dmn") return Dmn.export(Dmn.makeEmpty())
	if (type === "form") return Form.export(Form.makeEmpty(id))
	return `# ${name}\n`
}

function BpmnPreview({ xml, theme }: { xml: string; theme: string }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)

	useEffect(() => {
		const container = containerRef.current
		if (!container || !xml) return
		const canvas = new BpmnCanvas({
			container,
			theme: theme === "light" ? "light" : "dark",
			grid: false,
			fit: "contain",
		})
		canvas.load(xml)
		canvasRef.current = canvas
		return () => {
			canvas.destroy()
			canvasRef.current = null
		}
	}, [xml, theme])

	return <div ref={containerRef} className="h-full w-full" style={{ pointerEvents: "none" }} />
}

function ProcessCard({
	model,
	onDelete,
	onMove,
}: { model: ModelFile; onDelete: () => void; onMove: () => void }) {
	const [, navigate] = useLocation()
	const [hovered, setHovered] = useState(false)
	const { theme } = useThemeStore()

	return (
		<article
			className="relative rounded-lg border border-border bg-surface overflow-hidden hover:border-accent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			aria-label={`Model: ${model.name}`}
		>
			<div className="h-36 bg-surface-2 overflow-hidden">
				{model.type === "bpmn" && model.content ? (
					<BpmnPreview xml={model.content} theme={theme} />
				) : (
					<div className="flex h-full items-center justify-center gap-2 text-muted">
						<FileText size={22} />
						<span className="text-xs uppercase tracking-wider">
							{TYPE_LABELS[model.type as ModelType]}
						</span>
					</div>
				)}
			</div>
			<div className="p-3">
				<div className="flex items-center justify-between gap-2">
					<span className="text-sm font-medium text-fg truncate">{model.name}</span>
					<span className="text-xs rounded bg-surface-2 px-1.5 py-0.5 text-muted shrink-0">
						{TYPE_LABELS[model.type as ModelType]}
					</span>
				</div>
				<p className="text-xs text-muted mt-1">{new Date(model.updatedAt).toLocaleDateString()}</p>
			</div>
			{hovered && (
				<div className="absolute inset-0 flex items-center justify-center gap-2 bg-bg/70 animate-in fade-in duration-150">
					<Button
						size="sm"
						onClick={(e) => {
							e.stopPropagation()
							navigate(`/models/${model.id}`)
						}}
					>
						Open
					</Button>
					{isFsMode() && (
						<Button
							size="sm"
							variant="outline"
							onClick={(e) => {
								e.stopPropagation()
								onMove()
							}}
							aria-label={`Move ${model.name}`}
						>
							<Move size={14} />
						</Button>
					)}
					<Button
						size="sm"
						variant="danger"
						onClick={(e) => {
							e.stopPropagation()
							onDelete()
						}}
						aria-label={`Delete ${model.name}`}
					>
						<Trash2 size={14} />
					</Button>
				</div>
			)}
		</article>
	)
}

// ── Folder tree ───────────────────────────────────────────────────────────────

interface FolderTreeProps {
	entries: FsEntry[]
	selected: string
	expanded: Set<string>
	onSelect: (path: string) => void
	onToggle: (path: string) => void
}

function FolderTree({ entries, selected, expanded, onSelect, onToggle }: FolderTreeProps) {
	return (
		<ul className="text-sm">
			{entries.map((entry) => {
				if (entry.type === "dir") {
					const isExpanded = expanded.has(entry.relativePath)
					const isSelected = selected === entry.relativePath
					return (
						<li key={entry.relativePath}>
							<button
								type="button"
								className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
									isSelected ? "bg-accent/15 text-accent" : "text-fg hover:bg-surface-2"
								}`}
								onClick={() => {
									onToggle(entry.relativePath)
									onSelect(entry.relativePath)
								}}
							>
								{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
								{isExpanded ? (
									<FolderOpen size={14} className="shrink-0 text-muted" />
								) : (
									<Folder size={14} className="shrink-0 text-muted" />
								)}
								<span className="truncate">{entry.name}</span>
							</button>
							{isExpanded && entry.children && entry.children.length > 0 && (
								<div className="ml-4 border-l border-border/40 pl-1">
									<FolderTree
										entries={entry.children}
										selected={selected}
										expanded={expanded}
										onSelect={onSelect}
										onToggle={onToggle}
									/>
								</div>
							)}
						</li>
					)
				}
				return null
			})}
		</ul>
	)
}

// ── Move dialog ───────────────────────────────────────────────────────────────

function MoveDialog({
	model,
	tree,
	onClose,
	onMove,
}: {
	model: ModelFile
	tree: FsEntry[]
	onClose: () => void
	onMove: (toFolder: string) => Promise<void>
}) {
	const [selectedFolder, setSelectedFolder] = useState("")
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [moving, setMoving] = useState(false)

	// Collect all folder paths for the picker
	function allFolders(entries: FsEntry[], acc: FsEntry[] = []): FsEntry[] {
		for (const e of entries) {
			if (e.type === "dir") {
				acc.push(e)
				if (e.children) allFolders(e.children, acc)
			}
		}
		return acc
	}
	const folders = allFolders(tree)

	async function handleMove() {
		if (moving) return
		setMoving(true)
		try {
			await onMove(selectedFolder)
			onClose()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		} finally {
			setMoving(false)
		}
	}

	function toggle(path: string) {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}

	return (
		<Modal open onClose={onClose} title={`Move "${model.name}"`}>
			<div className="mt-4">
				<p className="text-xs text-muted mb-2">Select destination folder:</p>
				<div className="border border-border rounded p-2 max-h-48 overflow-y-auto">
					{/* Root option */}
					<button
						type="button"
						className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-sm text-left transition-colors ${
							selectedFolder === "" ? "bg-accent/15 text-accent" : "text-fg hover:bg-surface-2"
						}`}
						onClick={() => setSelectedFolder("")}
					>
						<Folder size={14} />
						<span>(project root)</span>
					</button>
					{folders.map((f) => (
						<button
							key={f.relativePath}
							type="button"
							className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-sm text-left transition-colors ${
								selectedFolder === f.relativePath
									? "bg-accent/15 text-accent"
									: "text-fg hover:bg-surface-2"
							}`}
							onClick={() => setSelectedFolder(f.relativePath)}
						>
							<Folder size={14} />
							<span>{f.relativePath}</span>
						</button>
					))}
				</div>
			</div>
			<div className="flex justify-end gap-2 mt-4">
				<Button variant="outline" onClick={onClose}>
					Cancel
				</Button>
				<Button onClick={() => void handleMove()} disabled={moving}>
					{moving ? "Moving…" : "Move"}
				</Button>
			</div>
		</Modal>
	)
}

// ── Models page ───────────────────────────────────────────────────────────────

export function Models() {
	const { models, saveModel, deleteModel, moveModel } = useModelsStore()
	const [, navigate] = useLocation()
	const { setBreadcrumbs, openAI } = useUiStore()
	const { activeProjectId, projects } = useProjectsStore()

	// Project-switch animation: fade out → swap content key → fade in
	const [contentKey, setContentKey] = useState(activeProjectId ?? "local")
	const [fading, setFading] = useState(false)
	const prevProjectId = useRef(activeProjectId)

	useEffect(() => {
		if (activeProjectId === prevProjectId.current) return
		prevProjectId.current = activeProjectId
		setFading(true)
		const t = setTimeout(() => {
			setContentKey(activeProjectId ?? "local")
			setFading(false)
		}, 180)
		return () => clearTimeout(t)
	}, [activeProjectId])
	const [search, setSearch] = useState("")
	const [typeFilter, setTypeFilter] = useState<ModelType | "all">("all")
	const [viewMode, setViewMode] = useState<ViewMode>("grid")
	const [creating, setCreating] = useState(false)
	const [newName, setNewName] = useState("")
	const [newType, setNewType] = useState<ModelType>("bpmn")
	const [confirmDelete, setConfirmDelete] = useState<ModelFile | null>(null)
	const [moveTarget, setMoveTarget] = useState<ModelFile | null>(null)
	const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Folder state (used in both FS and IndexedDB mode)
	const [fsTree, setFsTree] = useState<FsEntry[]>([])
	const [selectedFolder, setSelectedFolder] = useState("")
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
	const [newFolderName, setNewFolderName] = useState("")
	const [creatingFolder, setCreatingFolder] = useState(false)
	const [virtualFolders, setVirtualFolders] = useState<string[]>([])

	const fsMode = isFsMode()
	const activeProject = projects.find((p) => p.id === activeProjectId)

	useEffect(() => {
		setBreadcrumbs([{ label: "Models" }])
	}, [setBreadcrumbs])

	// Load persisted virtual folders from DB once on mount / mode switch
	useEffect(() => {
		if (fsMode) {
			const fs = getFsAdapter()
			if (!fs) return
			void fs
				.listTree()
				.then(setFsTree)
				.catch(() => setFsTree([]))
		} else {
			void storage.getPreference<string[]>("virtual-folders", []).then(setVirtualFolders)
		}
	}, [fsMode])

	// Rebuild folder tree synchronously whenever virtualFolders or models change (no async DB reads)
	useEffect(() => {
		if (!fsMode) {
			const fromModels = models.map((m) => m.folder).filter((f): f is string => !!f)
			const merged = [...new Set([...virtualFolders, ...fromModels])]
			setFsTree(buildVirtualTree(merged))
		}
	}, [fsMode, virtualFolders, models])

	// Filter models by the selected folder in both FS and IndexedDB modes
	const folderModels = models.filter((m) => {
		if (fsMode) {
			if (!m.path) return selectedFolder === ""
			const parts = m.path.split("/")
			const fileFolder = parts.slice(0, -1).join("/")
			return fileFolder === selectedFolder
		}
		return (m.folder ?? "") === selectedFolder
	})

	const filtered = folderModels.filter((m) => {
		if (typeFilter !== "all" && m.type !== typeFilter) return false
		if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
		return true
	})

	async function handleCreate() {
		if (!newName.trim()) return
		const content = makeEmptyContent(newType, newName.trim())
		let modelData: Parameters<typeof saveModel>[0]

		if (fsMode) {
			const ext = newType
			const fileName = `${newName.trim()}.${ext}`
			const relPath = selectedFolder ? `${selectedFolder}/${fileName}` : fileName
			modelData = {
				id: crypto.randomUUID(),
				name: newName.trim(),
				type: newType,
				content,
				path: relPath,
				createdAt: Date.now(),
			}
		} else {
			modelData = {
				id: crypto.randomUUID(),
				name: newName.trim(),
				type: newType,
				content,
				folder: selectedFolder || undefined,
				createdAt: Date.now(),
			}
		}

		const model = await saveModel(modelData)
		setCreating(false)
		setNewName("")
		navigate(`/models/${model.id}`)
	}

	async function handleCreateFromTemplate(tpl: ProcessTemplate) {
		let modelData: Parameters<typeof saveModel>[0]
		const fileName = `${tpl.name}.bpmn`

		if (fsMode) {
			const relPath = selectedFolder ? `${selectedFolder}/${fileName}` : fileName
			modelData = {
				id: crypto.randomUUID(),
				name: tpl.name,
				type: "bpmn" as ModelType,
				content: tpl.bpmn,
				path: relPath,
				createdAt: Date.now(),
			}
		} else {
			modelData = {
				id: crypto.randomUUID(),
				name: tpl.name,
				type: "bpmn" as ModelType,
				content: tpl.bpmn,
				folder: selectedFolder || undefined,
				createdAt: Date.now(),
			}
		}

		const model = await saveModel(modelData)
		setTemplateGalleryOpen(false)
		navigate(`/models/${model.id}`)
	}

	async function handleCreateFolder() {
		if (!newFolderName.trim()) return
		const relPath = selectedFolder
			? `${selectedFolder}/${newFolderName.trim()}`
			: newFolderName.trim()

		if (fsMode) {
			const fs = getFsAdapter()
			if (!fs) return
			await fs.createFolder(relPath)
			const tree = await fs.listTree()
			setFsTree(tree)
		} else {
			const updated = [...new Set([...virtualFolders, relPath])]
			setVirtualFolders(updated)
			await storage.setPreference("virtual-folders", updated)
			setFsTree(buildVirtualTree(updated))
		}

		setCreatingFolder(false)
		setNewFolderName("")
		setExpandedFolders((prev) => {
			const next = new Set(prev)
			if (selectedFolder) next.add(selectedFolder)
			return next
		})
		toast.success(`Folder "${newFolderName.trim()}" created`)
	}

	async function handleImport(files: FileList | null) {
		if (!files) return
		for (const file of Array.from(files)) {
			const ext = file.name.split(".").pop()?.toLowerCase()
			const type: ModelType =
				ext === "bpmn" ? "bpmn" : ext === "dmn" ? "dmn" : ext === "md" ? "md" : "form"
			const content = await file.text()
			const name = file.name.replace(/\.[^.]+$/, "")
			const modelData: Parameters<typeof saveModel>[0] = fsMode
				? {
						id: crypto.randomUUID(),
						name,
						type,
						content,
						path: selectedFolder ? `${selectedFolder}/${file.name}` : file.name,
						createdAt: Date.now(),
					}
				: {
						id: crypto.randomUUID(),
						name,
						type,
						content,
						folder: selectedFolder || undefined,
						createdAt: Date.now(),
					}
			await saveModel(modelData)
			toast.success(`Imported ${name}`)
		}
		if (fileInputRef.current) fileInputRef.current.value = ""
	}

	async function handleDelete(model: ModelFile) {
		await deleteModel(model.id)
		setConfirmDelete(null)
		toast.success(`Deleted ${model.name}`)
	}

	async function handleMove(model: ModelFile, toFolder: string) {
		if (!model.path) return
		const parts = model.path.split("/")
		const fileName = parts[parts.length - 1] ?? model.path
		const toRelPath = toFolder ? `${toFolder}/${fileName}` : fileName
		await moveModel(model.path, toRelPath)
		setMoveTarget(null)
		toast.success(`Moved ${model.name}`)
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault()
		void handleImport(e.dataTransfer?.files ?? null)
	}

	function toggleFolder(path: string) {
		setExpandedFolders((prev) => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}

	const typeFilterOptions: Array<ModelType | "all"> = fsMode
		? ["all", "bpmn", "dmn", "form", "md"]
		: ["all", "bpmn", "dmn", "form"]

	// Build a nested FsEntry tree from flat folder paths (for IndexedDB virtual folders)
	function buildVirtualTree(folders: string[]): FsEntry[] {
		const root: FsEntry[] = []
		for (const folderPath of [...folders].sort()) {
			const parts = folderPath.split("/")
			let current = root
			let currentPath = ""
			for (const part of parts) {
				currentPath = currentPath ? `${currentPath}/${part}` : part
				let node = current.find((e) => e.relativePath === currentPath)
				if (!node) {
					node = { name: part, relativePath: currentPath, type: "dir", children: [] }
					current.push(node)
				}
				current = node.children ?? []
			}
		}
		return root
	}

	return (
		<div
			className="flex h-full overflow-hidden"
			onDragOver={(e) => e.preventDefault()}
			onDrop={handleDrop}
		>
			{/* Animated wrapper — keyed to contentKey so entry animation replays on project switch */}
			<div
				key={contentKey}
				className={`flex flex-1 min-w-0 h-full ${
					fading
						? "opacity-0 translate-y-1 transition-[opacity,transform] duration-[180ms] ease-out"
						: "animate-in fade-in slide-in-from-bottom-1 duration-200"
				}`}
			>
				{/* Folder tree sidebar — always visible */}
				<aside className="w-52 shrink-0 border-r border-border bg-surface overflow-y-auto p-2">
					<div className="flex items-center justify-between mb-2 px-1">
						<span className="text-xs font-medium text-muted uppercase tracking-wider">
							{fsMode ? (activeProject?.name ?? "Project") : "Local"}
						</span>
						<button
							type="button"
							onClick={() => setCreatingFolder(true)}
							className="text-muted hover:text-fg transition-colors"
							aria-label="New folder"
							title="New folder"
						>
							<FolderPlus size={14} />
						</button>
					</div>
					{/* Root selection */}
					<button
						type="button"
						className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-sm text-left transition-colors mb-0.5 ${
							selectedFolder === "" ? "bg-accent/15 text-accent" : "text-fg hover:bg-surface-2"
						}`}
						onClick={() => setSelectedFolder("")}
					>
						<FolderOpen size={14} className="shrink-0" />
						<span className="truncate">/ (root)</span>
					</button>
					<FolderTree
						entries={fsTree}
						selected={selectedFolder}
						expanded={expandedFolders}
						onSelect={setSelectedFolder}
						onToggle={toggleFolder}
					/>
				</aside>

				{/* Main content */}
				<div className="flex-1 overflow-y-auto p-6">
					<div className="max-w-6xl mx-auto">
						{/* Header */}
						<div className="flex items-center justify-end mb-6">
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
									<Upload size={14} />
									Import
								</Button>
								<Button variant="outline" size="sm" onClick={() => setCreatingFolder(true)}>
									<FolderPlus size={14} />
									New Folder
								</Button>
								<Button variant="outline" size="sm" onClick={() => setTemplateGalleryOpen(true)}>
									<BookOpen size={14} />
									Templates
								</Button>
								<Button size="sm" onClick={() => setCreating(true)}>
									<Plus size={14} />
									New Model
								</Button>
								<input
									ref={fileInputRef}
									type="file"
									accept=".bpmn,.dmn,.form,.json,.md"
									multiple
									className="hidden"
									onChange={(e) => void handleImport((e.target as HTMLInputElement).files)}
									aria-label="Import model files"
								/>
							</div>
						</div>

						{/* Filters */}
						<div className="flex items-center gap-3 mb-4">
							<Input
								placeholder="Search models..."
								value={search}
								onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
								className="max-w-64"
								aria-label="Search models"
							/>
							<div className="flex rounded border border-border bg-surface-2 text-xs overflow-hidden">
								{typeFilterOptions.map((t) => (
									<button
										key={t}
										type="button"
										onClick={() => setTypeFilter(t)}
										className={`px-3 py-1.5 capitalize transition-colors ${
											typeFilter === t ? "bg-surface text-fg" : "text-muted hover:text-fg"
										}`}
										aria-pressed={typeFilter === t}
									>
										{t === "all" ? "All" : TYPE_LABELS[t as ModelType]}
									</button>
								))}
							</div>
							<div className="ml-auto flex gap-1">
								<button
									type="button"
									onClick={() => setViewMode("grid")}
									className={`p-1.5 rounded ${viewMode === "grid" ? "text-fg" : "text-muted hover:text-fg"}`}
									aria-label="Grid view"
									aria-pressed={viewMode === "grid"}
								>
									<Grid size={16} />
								</button>
								<button
									type="button"
									onClick={() => setViewMode("list")}
									className={`p-1.5 rounded ${viewMode === "list" ? "text-fg" : "text-muted hover:text-fg"}`}
									aria-label="List view"
									aria-pressed={viewMode === "list"}
								>
									<List size={16} />
								</button>
							</div>
						</div>

						{/* Content */}
						{filtered.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
								<FileText size={40} className="text-muted" />
								<div>
									<p className="text-base font-medium text-fg">No models yet</p>
									<p className="text-sm text-muted mt-1">
										{fsMode
											? "Create a model in this folder or import an existing file."
											: "Create your first model or import an existing file."}
									</p>
								</div>
								<Button onClick={() => setCreating(true)}>
									<Plus size={14} />
									Create model
								</Button>
								<Button variant="outline" onClick={() => setTemplateGalleryOpen(true)}>
									<BookOpen size={14} />
									Browse templates
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										openAI(
											"Create a BPMN automation workflow for me. Describe what it should do step by step, and I'll design the diagram with the right worker task types (CLI, LLM, file system, HTTP scraper, or email).",
										)
									}
								>
									<Sparkles size={14} />
									Describe what to automate
								</Button>
							</div>
						) : viewMode === "grid" ? (
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
								{filtered.map((model) => (
									<ProcessCard
										key={model.id}
										model={model}
										onDelete={() => setConfirmDelete(model)}
										onMove={() => setMoveTarget(model)}
									/>
								))}
							</div>
						) : (
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border text-left text-xs text-muted">
										<th className="pb-2 font-medium">Name</th>
										<th className="pb-2 font-medium">Type</th>
										<th className="pb-2 font-medium">{fsMode ? "Path" : "Process ID"}</th>
										<th className="pb-2 font-medium">Modified</th>
										<th className="pb-2 font-medium sr-only">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filtered.map((model) => (
										<tr
											key={model.id}
											className="border-b border-border/50 hover:bg-surface-2 cursor-pointer"
											onClick={() => navigate(`/models/${model.id}`)}
											onKeyDown={(e) => e.key === "Enter" && navigate(`/models/${model.id}`)}
										>
											<td className="py-2.5 pr-4 font-medium text-fg">{model.name}</td>
											<td className="py-2.5 pr-4">
												<StatusPill state={TYPE_LABELS[model.type as ModelType]} />
											</td>
											<td className="py-2.5 pr-4 text-muted font-mono text-xs">
												{fsMode ? (model.path ?? "—") : (model.processDefinitionId ?? "—")}
											</td>
											<td className="py-2.5 pr-4 text-muted">
												{new Date(model.updatedAt).toLocaleDateString()}
											</td>
											<td className="py-2.5">
												<div className="flex gap-1">
													{isFsMode() && (
														<Button
															variant="ghost"
															size="icon"
															onClick={(e) => {
																e.stopPropagation()
																setMoveTarget(model)
															}}
															aria-label={`Move ${model.name}`}
														>
															<Move size={14} />
														</Button>
													)}
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation()
															setConfirmDelete(model)
														}}
														aria-label={`Delete ${model.name}`}
													>
														<Trash2 size={14} />
													</Button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>
			{/* end animated wrapper */}

			{/* Create model dialog */}
			<Modal open={creating} onClose={() => setCreating(false)} title="New Model">
				<div className="space-y-4 mt-4">
					<div>
						<label className="text-sm text-muted mb-1 block" htmlFor="model-name">
							Name
						</label>
						<Input
							id="model-name"
							value={newName}
							onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
							placeholder="My Process"
							onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
						/>
					</div>
					{selectedFolder && (
						<p className="text-xs text-muted">
							Folder: <span className="font-mono text-fg">{selectedFolder}/</span>
						</p>
					)}
					<div>
						<p className="text-sm text-muted mb-2">Type</p>
						<div className={`grid gap-2 ${fsMode ? "grid-cols-4" : "grid-cols-3"}`}>
							{(fsMode
								? (["bpmn", "dmn", "form", "md"] as const)
								: (["bpmn", "dmn", "form"] as const)
							).map((t) => (
								<button
									key={t}
									type="button"
									onClick={() => setNewType(t)}
									className={`rounded border p-3 text-center text-sm transition-colors ${
										newType === t
											? "border-accent bg-accent/10 text-accent"
											: "border-border text-fg hover:bg-surface-2"
									}`}
									aria-pressed={newType === t}
								>
									{TYPE_LABELS[t]}
								</button>
							))}
						</div>
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => setCreating(false)}>
							Cancel
						</Button>
						<Button onClick={() => void handleCreate()} disabled={!newName.trim()}>
							Create
						</Button>
					</div>
				</div>
			</Modal>

			{/* Create folder dialog */}
			<Modal open={creatingFolder} onClose={() => setCreatingFolder(false)} title="New Folder">
				<div className="space-y-4 mt-4">
					<div>
						<label className="text-sm text-muted mb-1 block" htmlFor="folder-name">
							Folder name
						</label>
						<Input
							id="folder-name"
							value={newFolderName}
							onInput={(e) => setNewFolderName((e.target as HTMLInputElement).value)}
							placeholder="processes"
							onKeyDown={(e) => e.key === "Enter" && void handleCreateFolder()}
						/>
					</div>
					{selectedFolder && (
						<p className="text-xs text-muted">
							Location: <span className="font-mono text-fg">{selectedFolder}/</span>
						</p>
					)}
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => setCreatingFolder(false)}>
							Cancel
						</Button>
						<Button onClick={() => void handleCreateFolder()} disabled={!newFolderName.trim()}>
							Create
						</Button>
					</div>
				</div>
			</Modal>

			{/* Delete confirmation */}
			<Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Model">
				<p className="text-sm text-muted mt-2">
					Are you sure you want to delete <strong className="text-fg">{confirmDelete?.name}</strong>
					? This cannot be undone.
				</p>
				<div className="flex justify-end gap-2 mt-4">
					<Button variant="outline" onClick={() => setConfirmDelete(null)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={() => confirmDelete && void handleDelete(confirmDelete)}
					>
						Delete
					</Button>
				</div>
			</Modal>

			{/* Move dialog */}
			{moveTarget && (
				<MoveDialog
					model={moveTarget}
					tree={fsTree}
					onClose={() => setMoveTarget(null)}
					onMove={(toFolder) => handleMove(moveTarget, toFolder)}
				/>
			)}

			{/* Template gallery dialog */}
			<Modal
				open={templateGalleryOpen}
				onClose={() => setTemplateGalleryOpen(false)}
				title="Process Templates"
				size="lg"
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-2">
					{PROCESS_TEMPLATES.map((tpl) => (
						<button
							key={tpl.id}
							type="button"
							onClick={() => void handleCreateFromTemplate(tpl)}
							className="text-left rounded-lg border border-border bg-surface p-4 hover:border-accent hover:bg-accent/5 transition-colors"
						>
							<div className="text-sm font-medium text-fg">{tpl.name}</div>
							<div className="text-xs text-muted mt-1">{tpl.description}</div>
							<div className="mt-2 inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted capitalize">
								{tpl.category}
							</div>
						</button>
					))}
				</div>
			</Modal>
		</div>
	)
}

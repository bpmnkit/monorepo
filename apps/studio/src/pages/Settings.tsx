import { Input, Modal } from "@cascivo/react"
import { CheckCircle2, Folder, Plus, RefreshCw, Trash2, XCircle } from "lucide-react"
import { useEffect, useState } from "preact/hooks"
import { useProfiles } from "../api/queries.js"
import { ProfileTag } from "../components/ProfileTag.js"
import { ThemePicker } from "../components/ThemePicker.js"
import { Button } from "../components/ui/button.js"
import { useClusterStore } from "../stores/cluster.js"
import { useModelsStore } from "../stores/models.js"
import { useProjectsStore } from "../stores/projects.js"
import { useSecretsStore } from "../stores/secrets.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

/** Extract all unique `{{secrets.NAME}}` references from a string. */
function extractSecretNames(text: string): string[] {
	const found = new Set<string>()
	for (const m of text.matchAll(/\{\{secrets\.([^}]+)\}\}/g)) {
		if (m[1]) found.add(m[1])
	}
	return [...found]
}

/**
 * The active-selection control, which reads out a state and so is mono: an
 * accent mark when the row is the active one, a square control when it is not.
 */
function ActiveToggle({
	active,
	onActivate,
	inactiveLabel = "Switch",
}: { active: boolean; onActivate: () => void; inactiveLabel?: string }) {
	if (active) {
		return <span className="ds-mark ds-mark--accent">Active</span>
	}
	return (
		<button type="button" onClick={onActivate} className="ds-btn text-xs" aria-pressed={false}>
			{inactiveLabel}
		</button>
	)
}

export function Settings() {
	const { proxyUrl, activeProfile, setActiveProfile, setProxyUrl, loadProfiles } = useClusterStore()
	const [proxyInput, setProxyInput] = useState(proxyUrl)
	const { data: profiles, refetch } = useProfiles()
	const { setBreadcrumbs } = useUiStore()
	const { projects, activeProjectId, load, addProject, removeProject, setActiveProject } =
		useProjectsStore()
	const { models } = useModelsStore()
	const { checkMany } = useSecretsStore()

	const [addingProject, setAddingProject] = useState(false)
	const [newProjectName, setNewProjectName] = useState("")
	const [newProjectPath, setNewProjectPath] = useState("")
	const [validating, setValidating] = useState(false)

	// ── Secrets panel state ──────────────────────────────────────────────────
	const [secretsStatus, setSecretsStatus] = useState<Record<string, boolean> | null>(null)
	const [checkingSecrets, setCheckingSecrets] = useState(false)

	async function handleCheckSecrets() {
		const allNames = new Set<string>()
		for (const m of models) {
			if (m.type === "bpmn") {
				for (const name of extractSecretNames(m.content)) {
					allNames.add(name)
				}
			}
		}
		if (allNames.size === 0) {
			toast.info("No {{secrets.*}} references found in any BPMN model")
			return
		}
		setCheckingSecrets(true)
		try {
			const result = await checkMany([...allNames])
			setSecretsStatus(result)
		} catch {
			toast.error("Could not reach the proxy server")
		} finally {
			setCheckingSecrets(false)
		}
	}

	useEffect(() => {
		setBreadcrumbs([{ label: "Settings" }])
	}, [setBreadcrumbs])

	useEffect(() => {
		void load()
	}, [load])

	function handleSaveProxy() {
		setProxyUrl(proxyInput)
		toast.success("Proxy URL saved")
		void loadProfiles()
	}

	async function handleRefreshProfiles() {
		await loadProfiles()
		await refetch()
		toast.info("Profiles refreshed")
	}

	async function handleAddProject() {
		if (!newProjectName.trim() || !newProjectPath.trim()) return
		setValidating(true)
		try {
			// Validate: try to list the tree for this path
			const res = await fetch(
				`${proxyUrl}/fs/tree?root=${encodeURIComponent(newProjectPath.trim())}`,
			)
			if (!res.ok) {
				if (res.status === 404) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null
					toast.error(
						body?.error ?? "Folder not found. Check the path exists on the proxy machine.",
					)
				} else if (res.status === 403 || res.status === 400) {
					// The proxy refuses folders such as ~ or ~/.ssh, and says why.
					const body = (await res.json().catch(() => null)) as { error?: string } | null
					toast.error(body?.error ?? `The proxy refused this folder (${res.status}).`)
				} else {
					toast.error(`Proxy returned an error (${res.status}). Check the proxy server logs.`)
				}
				return
			}
			await addProject(newProjectName.trim(), newProjectPath.trim())
			toast.success(`Project "${newProjectName.trim()}" added`)
			setAddingProject(false)
			setNewProjectName("")
			setNewProjectPath("")
		} catch {
			toast.error("Could not reach the proxy server. Make sure it is running.")
		} finally {
			setValidating(false)
		}
	}

	async function handleRemoveProject(id: string, name: string) {
		await removeProject(id)
		toast.success(`Removed "${name}"`)
	}

	function handleSwitchProject(id: string | null) {
		setActiveProject(id, proxyUrl)
		if (id === null) {
			toast.info("Switched to local (IndexedDB) storage")
		} else {
			const project = projects.find((p) => p.id === id)
			toast.success(`Switched to project "${project?.name}"`)
		}
	}

	return (
		<div className="ds-page max-w-3xl">
			{/* Proxy URL */}
			<section className="mb-6">
				<div className="ds-head">
					<span className="ds-eyebrow">01</span>
					<h2 className="ds-title text-base">Proxy Server</h2>
				</div>
				<p className="ds-lede mb-3">
					All Camunda API calls and file system access are routed through the proxy. Make sure it's
					running.
				</p>
				<div className="flex gap-2">
					<Input
						value={proxyInput}
						onInput={(e) => setProxyInput((e.target as HTMLInputElement).value)}
						placeholder="http://localhost:3033"
						aria-label="Proxy URL"
						className="flex-1"
					/>
					<Button onClick={handleSaveProxy}>Save</Button>
				</div>
				<code className="ds-code mt-2">pnpm proxy</code>
			</section>

			{/* Projects */}
			<section className="mb-6">
				<div className="ds-head">
					<span className="ds-eyebrow">02</span>
					<h2 className="ds-title text-base">Projects</h2>
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={() => setAddingProject(true)}
					>
						<Plus size={14} />
						Add Project
					</Button>
				</div>
				<p className="ds-lede mb-3">File system folders for storing models as files on disk</p>

				<div className="ds-box ds-rows">
					{/* Local (IndexedDB) — always present */}
					<div className="flex items-center gap-3 px-4 py-3">
						<div className="min-w-0 flex-1">
							<div className="text-fg text-sm">Local (IndexedDB)</div>
							<div className="ds-lede text-xs">Browser storage — no file system required</div>
						</div>
						<ActiveToggle
							active={activeProjectId === null}
							onActivate={() => handleSwitchProject(null)}
						/>
					</div>

					{projects.length === 0 && (
						<div className="ds-lede px-4 py-3">
							No projects configured. Add a project to store models as files on disk.
						</div>
					)}

					{projects.map((project) => (
						<div key={project.id} className="flex items-center gap-3 px-4 py-3">
							<Folder size={16} className="shrink-0 text-muted" />
							<div className="min-w-0 flex-1">
								<div className="text-fg text-sm">{project.name}</div>
								<div className="ds-datum truncate text-muted text-xs">{project.path}</div>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<ActiveToggle
									active={project.id === activeProjectId}
									onActivate={() => handleSwitchProject(project.id)}
								/>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => void handleRemoveProject(project.id, project.name)}
									aria-label={`Remove project ${project.name}`}
								>
									<Trash2 size={14} />
								</Button>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Profiles */}
			<section className="mb-6">
				<div className="ds-head">
					<span className="ds-eyebrow">03</span>
					<h2 className="ds-title text-base">Profiles</h2>
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={() => void handleRefreshProfiles()}
					>
						Refresh
					</Button>
				</div>
				<p className="ds-lede mb-3">Camunda cluster connections</p>

				{!profiles || profiles.length === 0 ? (
					<p className="ds-lede">
						No profiles found. Configure profiles in your proxy config file.
					</p>
				) : (
					<div className="ds-box">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-border border-b bg-bg text-left">
									<th className="px-4 py-2">Name</th>
									<th className="px-4 py-2">Tags</th>
									<th className="px-4 py-2">Type</th>
									<th className="px-4 py-2">Active</th>
								</tr>
							</thead>
							<tbody>
								{profiles.map((p) => (
									<tr key={p.name} className="border-border/60 border-b last:border-0">
										<td className="px-4 py-2.5">
											<div className="text-fg">{p.name}</div>
											{p.description && <div className="ds-lede text-xs">{p.description}</div>}
										</td>
										<td className="px-4 py-2.5">
											{p.tags && p.tags.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{p.tags.map((t) => (
														<ProfileTag key={t} tag={t} />
													))}
												</div>
											) : (
												<span className="ds-datum text-muted text-xs">—</span>
											)}
										</td>
										<td className="ds-datum px-4 py-2.5 text-muted text-xs">{p.apiType ?? "—"}</td>
										<td className="px-4 py-2.5">
											<ActiveToggle
												active={p.name === activeProfile}
												onActivate={() => setActiveProfile(p.name)}
												inactiveLabel="Set active"
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Connector Secrets */}
			<section className="mb-6">
				<div className="ds-head">
					<span className="ds-eyebrow">04</span>
					<h2 className="ds-title text-base">Connector Secrets</h2>
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={() => void handleCheckSecrets()}
						disabled={checkingSecrets}
					>
						<RefreshCw size={14} className={checkingSecrets ? "animate-spin" : ""} />
						Scan Models
					</Button>
				</div>
				<p className="ds-lede mb-3">
					Use <code className="ds-datum text-fg">{"{{secrets.NAME}}"}</code> in REST connector
					fields. The proxy resolves them from environment variables.
				</p>

				<div className="ds-box ds-rows mb-3">
					{secretsStatus === null ? (
						<div className="ds-lede px-4 py-3">
							Click "Scan Models" to check which secrets are configured.
						</div>
					) : Object.keys(secretsStatus).length === 0 ? (
						<div className="ds-lede px-4 py-3">
							No <code className="ds-datum text-fg">{"{{secrets.*}}"}</code> references found in
							your BPMN models.
						</div>
					) : (
						Object.entries(secretsStatus).map(([name, exists]) => (
							<div key={name} className="flex items-center gap-3 px-4 py-2.5">
								{exists ? (
									<CheckCircle2 size={14} className="shrink-0 text-success" />
								) : (
									<XCircle size={14} className="shrink-0 text-danger" />
								)}
								<code className="ds-datum flex-1 text-fg text-sm">{name}</code>
								<span className={`ds-mark ${exists ? "ds-mark--success" : "ds-mark--danger"}`}>
									{exists ? "configured" : "missing"}
								</span>
							</div>
						))
					)}
				</div>

				<p className="ds-lede text-xs">
					Set secrets as environment variables on the proxy machine before starting it:
				</p>
				<code className="ds-code mt-1">MY_API_KEY=value pnpm proxy</code>
			</section>

			{/* Theme */}
			<section>
				<div className="ds-head">
					<span className="ds-eyebrow">05</span>
					<h2 className="ds-title text-base">Theme</h2>
				</div>
				<ThemePicker />
			</section>

			{/* Add project dialog */}
			<Modal open={addingProject} onClose={() => setAddingProject(false)} title="Add Project">
				<div className="space-y-4 mt-4">
					<Input
						id="project-name"
						label="Display name"
						value={newProjectName}
						onInput={(e) => setNewProjectName((e.target as HTMLInputElement).value)}
						placeholder="My BPMN Project"
					/>
					<Input
						id="project-path"
						label="Absolute folder path"
						value={newProjectPath}
						onInput={(e) => setNewProjectPath((e.target as HTMLInputElement).value)}
						placeholder="/home/user/projects/my-processes"
						hint="Must be accessible on the machine running the proxy."
					/>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setAddingProject(false)
								setNewProjectName("")
								setNewProjectPath("")
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={() => void handleAddProject()}
							disabled={!newProjectName.trim() || !newProjectPath.trim() || validating}
						>
							{validating ? "Validating…" : "Add Project"}
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	)
}

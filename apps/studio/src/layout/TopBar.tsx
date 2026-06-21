import { ShellHeader } from "@cascivo/react"
import { FlaskConical, FolderOpen, MessageSquare } from "lucide-react"
import { Link } from "wouter"
import { BpmnkitLogo } from "../components/Logo.js"
import { ModeToggle } from "../components/ModeToggle.js"
import { useClusterStore } from "../stores/cluster.js"
import { useProjectsStore } from "../stores/projects.js"
import { useUiStore } from "../stores/ui.js"

// AppShell clones the header element and injects these so the burger toggles the
// nav drawer (notably the only way to reopen the nav on mobile).
interface TopBarProps {
	onMenuClick?: () => void
	menuExpanded?: boolean
}

export function TopBar({ onMenuClick, menuExpanded }: TopBarProps) {
	const { aiOpen, toggleAI, breadcrumbs } = useUiStore()
	const { activeProjectId, projects } = useProjectsStore()
	const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
	const { activeProfile, simulationMode, setSimulationMode } = useClusterStore()

	const brand = (
		<div className="flex min-w-0 items-center gap-3">
			{/* Logo — links home */}
			<Link
				href="/"
				className="flex shrink-0 items-center gap-2 transition-opacity duration-150 hover:opacity-80 active:opacity-60"
				aria-label="Studio home"
			>
				<BpmnkitLogo height={30} />
				<span className="font-semibold text-fg text-sm">Studio</span>
			</Link>

			{/* Breadcrumb */}
			{breadcrumbs.length > 0 && (
				<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
					<span className="text-border" aria-hidden="true">
						/
					</span>
					{breadcrumbs.map((crumb, i) => {
						const isLast = i === breadcrumbs.length - 1
						return (
							<span key={crumb.label} className="flex min-w-0 items-center gap-1.5">
								{crumb.href && !isLast ? (
									<Link
										href={crumb.href}
										className="truncate text-muted transition-colors duration-100 hover:text-fg"
									>
										{crumb.label}
									</Link>
								) : (
									<span className={`truncate ${isLast ? "font-medium text-fg" : "text-muted"}`}>
										{crumb.label}
									</span>
								)}
								{!isLast && (
									<span className="shrink-0 text-border" aria-hidden="true">
										/
									</span>
								)}
							</span>
						)
					})}
				</nav>
			)}

			{activeProject && (
				<Link
					href="/settings"
					className="ml-1 hidden items-center gap-1.5 rounded px-2 py-1 text-muted text-xs transition-colors hover:bg-surface-2 hover:text-fg sm:flex"
					title={`Project: ${activeProject.path}`}
				>
					<FolderOpen size={13} />
					<span className="max-w-48 truncate">{activeProject.name}</span>
				</Link>
			)}
		</div>
	)

	const end = (
		<div className="flex items-center gap-2">
			{activeProfile === "reebe-wasm" && (
				<button
					type="button"
					onClick={() => setSimulationMode(!simulationMode)}
					className={`flex h-8 items-center gap-1.5 rounded border px-2 text-xs transition-colors active:opacity-70 ${
						simulationMode
							? "border-warn bg-warn/10 text-warn"
							: "border-border text-muted hover:text-fg"
					}`}
					aria-label="Toggle simulation mode"
					aria-pressed={simulationMode}
					title="Simulation Mode: auto-complete service tasks instead of creating incidents"
				>
					<FlaskConical size={14} />
					<span>Simulate</span>
				</button>
			)}
			<ModeToggle />
			<button
				type="button"
				onClick={toggleAI}
				className={`flex h-8 w-8 items-center justify-center rounded border transition-colors active:opacity-70 ${
					aiOpen
						? "border-accent bg-accent/10 text-accent"
						: "border-border text-muted hover:text-fg"
				}`}
				aria-label="Toggle AI assistant"
				aria-pressed={aiOpen}
			>
				<MessageSquare size={16} />
			</button>
		</div>
	)

	return (
		<ShellHeader brand={brand} end={end} onMenuClick={onMenuClick} menuExpanded={menuExpanded} />
	)
}

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
			{/* Logo — links home. The app name rides beside the wordmark as a
			    mono micro label, the way every app label in the system does. */}
			<Link
				href="/"
				className="flex shrink-0 items-baseline gap-2 transition-opacity duration-150 hover:opacity-80 active:opacity-60"
				aria-label="Studio home"
			>
				<BpmnkitLogo />
				<span className="ds-label ds-label--micro">Studio</span>
			</Link>

			{/* Breadcrumb — a path, so mono and in natural case. */}
			{breadcrumbs.length > 0 && (
				<nav aria-label="Breadcrumb" className="ds-datum flex min-w-0 items-center gap-1.5 text-xs">
					<span className="text-muted/50" aria-hidden="true">
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
									<span className={`truncate ${isLast ? "text-fg" : "text-muted"}`}>
										{crumb.label}
									</span>
								)}
								{!isLast && (
									<span className="shrink-0 text-muted/50" aria-hidden="true">
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
					className="ds-datum ml-1 hidden shrink-0 items-center gap-1.5 border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent sm:flex"
					title={`Project: ${activeProject.path}`}
				>
					<FolderOpen size={12} />
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
					className={`ds-btn h-7 text-xs ${simulationMode ? "ds-btn--on" : ""}`}
					aria-label="Toggle simulation mode"
					aria-pressed={simulationMode}
					title="Simulation Mode: auto-complete service tasks instead of creating incidents"
				>
					<FlaskConical size={13} />
					<span>Simulate</span>
				</button>
			)}
			<ModeToggle />
			<button
				type="button"
				onClick={toggleAI}
				className={`ds-btn ds-btn--icon h-7 w-7 ${aiOpen ? "ds-btn--on" : ""}`}
				aria-label="Toggle AI assistant"
				aria-pressed={aiOpen}
			>
				<MessageSquare size={15} />
			</button>
		</div>
	)

	return (
		<ShellHeader brand={brand} end={end} onMenuClick={onMenuClick} menuExpanded={menuExpanded} />
	)
}

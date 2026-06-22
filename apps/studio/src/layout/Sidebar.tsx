import { SideNav, type SideNavItem } from "@cascivo/react"
import {
	AlertTriangle,
	CheckSquare,
	FolderOpen,
	GitBranch,
	History,
	Layers,
	LayoutDashboard,
	Play,
	RotateCw,
	Search,
	Settings,
	Sparkles,
} from "lucide-react"
import { useState } from "preact/hooks"
import { Link, useLocation } from "wouter"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js"
import { getOnboardingState } from "../lib/onboarding.js"
import { useClusterStore } from "../stores/cluster.js"
import { useModeStore } from "../stores/mode.js"
import { useProjectsStore } from "../stores/projects.js"
import { useUiStore } from "../stores/ui.js"

interface NavItem {
	icon: typeof LayoutDashboard
	label: string
	path: string
	shortcut: string
}

const ALL_ITEMS: NavItem[] = [
	{ icon: LayoutDashboard, label: "Dashboard", path: "/", shortcut: "g d" },
	{ icon: FolderOpen, label: "Models", path: "/models", shortcut: "g m" },
	{ icon: Layers, label: "Definitions", path: "/definitions", shortcut: "g e" },
	{ icon: Play, label: "Instances", path: "/instances", shortcut: "g i" },
	{ icon: AlertTriangle, label: "Incidents", path: "/incidents", shortcut: "g n" },
	{ icon: CheckSquare, label: "Tasks", path: "/tasks", shortcut: "g t" },
	{ icon: GitBranch, label: "Decisions", path: "/decisions", shortcut: "g c" },
	{ icon: History, label: "Run History", path: "/run-history", shortcut: "g h" },
	{ icon: Settings, label: "Settings", path: "/settings", shortcut: "g s" },
]

const DEVELOPER_ORDER = [
	"/",
	"/models",
	"/definitions",
	"/instances",
	"/incidents",
	"/tasks",
	"/decisions",
	"/run-history",
	"/settings",
]
const OPERATOR_ORDER = [
	"/",
	"/instances",
	"/incidents",
	"/tasks",
	"/definitions",
	"/decisions",
	"/run-history",
	"/models",
	"/settings",
]

function getOrderedItems(mode: "developer" | "operator"): NavItem[] {
	const order = mode === "developer" ? DEVELOPER_ORDER : OPERATOR_ORDER
	return order.flatMap((path) => ALL_ITEMS.filter((i) => i.path === path))
}

export function Sidebar() {
	const [location] = useLocation()
	const { mode } = useModeStore()
	const { profiles, activeProfile, status, setActiveProfile, loadProfiles, proxyUrl } =
		useClusterStore()
	const { projects, activeProjectId, setActiveProject } = useProjectsStore()
	const [reconnecting, setReconnecting] = useState(false)

	async function handleReconnect() {
		setReconnecting(true)
		await loadProfiles()
		setReconnecting(false)
	}
	const { sidebarExpanded, setSidebarExpanded, openCommandPalette, openWelcomeModal } = useUiStore()
	const items = getOrderedItems(mode)

	function isActive(path: string) {
		if (path === "/") return location === "/"
		return location.startsWith(path)
	}

	const statusColor =
		status === "connected" ? "bg-success" : status === "loading" ? "bg-warn" : "bg-danger"

	// Nav links → cascivo SideNav items. Navigation + view transitions are handled
	// by the Shell's global <a> click interceptor; onClick only closes on mobile.
	const navItems: SideNavItem[] = items.map((item) => {
		const Icon = item.icon
		return {
			label: item.label,
			href: item.path,
			icon: <Icon size={18} />,
			active: isActive(item.path),
			onClick: () => {
				if (window.innerWidth < 768) setSidebarExpanded(false)
			},
		}
	})

	// Footer controls are styled to match cascivo's SideNav items so every entry
	// lines up: same horizontal insets (list `px-2` + link `px-2`), same `gap-2`,
	// and every icon in a fixed `h-4 w-4` box (= cascivo's `_icon`, `space-4`).
	// The label is removed (not just width-collapsed) on the rail so its flex gap
	// doesn't push the icon off-centre.
	const iconBox = "inline-flex h-4 w-4 shrink-0 items-center justify-center"
	const labelCls = sidebarExpanded
		? "min-w-0 flex-1 truncate text-left font-medium text-sm"
		: "hidden"
	const itemBase =
		"flex w-full items-center gap-2 rounded-md px-2 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent"
	const triggerCls = `${itemBase} text-nav-fg hover:bg-white/5 hover:text-nav-fg-active active:bg-white/10`
	const reconnectCls = `${itemBase} text-warn hover:bg-white/5 hover:text-warn/80 active:bg-white/10 disabled:opacity-50`

	const footer = (
		<div className="flex flex-col gap-1 px-2">
			{/* Cluster / profile picker */}
			<DropdownMenu>
				<DropdownMenuTrigger className={triggerCls} aria-label="Select cluster profile">
					<span className={iconBox}>
						<span
							className={`h-2 w-2 rounded-full ${statusColor} ${status === "loading" ? "animate-pulse" : ""}`}
							aria-hidden="true"
						/>
					</span>
					<span className={labelCls}>
						{activeProfile ?? (status === "offline" ? "No cluster" : "Select profile")}
					</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="min-w-48">
					{profiles.length === 0 ? (
						<>
							<DropdownMenuLabel>No profiles found</DropdownMenuLabel>
							<DropdownMenuSeparator />
						</>
					) : (
						<>
							<DropdownMenuLabel>Profiles</DropdownMenuLabel>
							{profiles.map((p) => (
								<DropdownMenuItem
									key={p.name}
									onSelect={() => setActiveProfile(p.name)}
									className="gap-2"
								>
									{p.name === activeProfile && (
										<span className="text-accent" aria-label="Active">
											●
										</span>
									)}
									<span className={p.name === activeProfile ? "font-medium" : ""}>{p.name}</span>
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuItem asChild>
						<Link href="/settings" className="cursor-pointer text-muted">
							Add profile →
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Project picker */}
			<DropdownMenu>
				<DropdownMenuTrigger className={triggerCls} aria-label="Select project">
					<span className={iconBox}>
						<FolderOpen size={18} />
					</span>
					<span className={labelCls}>
						{activeProjectId
							? (projects.find((p) => p.id === activeProjectId)?.name ?? "Unknown project")
							: "Local (IndexedDB)"}
					</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="min-w-48">
					<DropdownMenuLabel>Projects</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => setActiveProject(null, proxyUrl)} className="gap-2">
						{activeProjectId === null && <span className="text-accent">●</span>}
						<span className={activeProjectId === null ? "font-medium" : ""}>Local (IndexedDB)</span>
					</DropdownMenuItem>
					{projects.map((p) => (
						<DropdownMenuItem
							key={p.id}
							onSelect={() => setActiveProject(p.id, proxyUrl)}
							className="gap-2"
						>
							{p.id === activeProjectId && <span className="text-accent">●</span>}
							<span className={p.id === activeProjectId ? "font-medium" : ""}>{p.name}</span>
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link href="/settings" className="cursor-pointer text-muted">
							Manage projects →
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Reconnect button — visible when proxy is offline */}
			{status === "offline" && (
				<button
					type="button"
					onClick={() => void handleReconnect()}
					disabled={reconnecting}
					className={reconnectCls}
					aria-label="Retry proxy connection"
				>
					<span className={iconBox}>
						<RotateCw size={18} className={reconnecting ? "animate-spin" : ""} />
					</span>
					<span className={labelCls}>{reconnecting ? "Connecting…" : "Retry connection"}</span>
				</button>
			)}

			{/* Search trigger */}
			<button
				type="button"
				onClick={openCommandPalette}
				className={triggerCls}
				aria-label="Open search"
			>
				<span className={iconBox}>
					<Search size={18} />
				</span>
				<span className={labelCls}>Search...</span>
			</button>

			{/* Get started */}
			{!getOnboardingState().hidden && (
				<button
					type="button"
					onClick={openWelcomeModal}
					className={triggerCls}
					aria-label="Get started"
					title="Get started"
				>
					<span className={iconBox}>
						<Sparkles size={18} className="text-accent" />
					</span>
					<span className={labelCls}>Get started</span>
				</button>
			)}
		</div>
	)

	return (
		<SideNav
			ariaLabel="Main navigation"
			items={navItems}
			collapsed={!sidebarExpanded}
			onCollapsedChange={(collapsed) => setSidebarExpanded(!collapsed)}
			footer={footer}
		/>
	)
}

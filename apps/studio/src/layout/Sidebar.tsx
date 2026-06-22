import { SideNav, type SideNavGroup, type SideNavItem, type SideNavSubItem } from "@cascivo/react"
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
import { useLocation } from "wouter"
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

	// ── Main navigation. Navigation + view transitions flow through the Shell's
	// global <a> click interceptor; onClick only closes the rail on mobile.
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

	// ── App-context controls: cluster + project pickers (native sub-item menus),
	// reconnect, and search.
	const clusterSubItems: SideNavSubItem[] = [
		{ type: "label", label: profiles.length === 0 ? "No profiles found" : "Profiles" },
		...profiles.map(
			(p): SideNavSubItem => ({
				label: p.name,
				selected: p.name === activeProfile,
				onSelect: () => setActiveProfile(p.name),
			}),
		),
		{ type: "separator" },
		{ label: "Add profile →", href: "/settings" },
	]

	const projectSubItems: SideNavSubItem[] = [
		{ type: "label", label: "Projects" },
		{
			label: "Local (IndexedDB)",
			selected: activeProjectId === null,
			onSelect: () => setActiveProject(null, proxyUrl),
		},
		...projects.map(
			(p): SideNavSubItem => ({
				label: p.name,
				selected: p.id === activeProjectId,
				onSelect: () => setActiveProject(p.id, proxyUrl),
			}),
		),
		{ type: "separator" },
		{ label: "Manage projects →", href: "/settings" },
	]

	const contextItems: SideNavItem[] = [
		{
			label: activeProfile ?? (status === "offline" ? "No cluster" : "Select profile"),
			icon: (
				<span
					className={`h-2 w-2 rounded-full ${statusColor} ${status === "loading" ? "animate-pulse" : ""}`}
				/>
			),
			items: clusterSubItems,
		},
		{
			label: activeProjectId
				? (projects.find((p) => p.id === activeProjectId)?.name ?? "Unknown project")
				: "Local (IndexedDB)",
			icon: <FolderOpen size={18} />,
			items: projectSubItems,
		},
	]

	if (status === "offline") {
		contextItems.push({
			label: reconnecting ? "Connecting…" : "Retry connection",
			icon: <RotateCw size={18} className={reconnecting ? "animate-spin" : ""} />,
			onClick: () => void handleReconnect(),
			tone: "warning",
			disabled: reconnecting,
		})
	}

	contextItems.push({
		label: "Search...",
		icon: <Search size={18} />,
		onClick: () => openCommandPalette(),
		trailing: <kbd className="text-muted text-xs">⌘K</kbd>,
	})

	// ── Help.
	const helpItems: SideNavItem[] = []
	if (!getOnboardingState().hidden) {
		helpItems.push({
			label: "Get started",
			icon: <Sparkles size={18} className="text-accent" />,
			onClick: () => openWelcomeModal(),
		})
	}

	const groups: SideNavGroup[] = [
		{ items: contextItems },
		{ items: navItems },
		...(helpItems.length > 0 ? [{ items: helpItems }] : []),
	]

	return (
		<SideNav
			ariaLabel="Main navigation"
			groups={groups}
			collapsed={!sidebarExpanded}
			onCollapsedChange={(collapsed) => setSidebarExpanded(!collapsed)}
		/>
	)
}

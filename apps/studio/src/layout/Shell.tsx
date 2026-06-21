import { AppShell } from "@cascivo/react"
import type { ComponentChildren, JSX } from "preact"
import { useEffect } from "preact/hooks"
import { useLocation } from "wouter"
import { CommandPalette } from "../components/CommandPalette.js"
import { navigateWithTransition } from "../lib/transition.js"
import { useUiStore } from "../stores/ui.js"
import { AIDrawer } from "./AIDrawer.js"
import { Sidebar } from "./Sidebar.js"
import { TopBar } from "./TopBar.js"

interface ShellProps {
	children: ComponentChildren
}

const ROUTE_MAP: Record<string, string> = {
	d: "/",
	m: "/models",
	e: "/definitions",
	i: "/instances",
	n: "/incidents",
	t: "/tasks",
	c: "/decisions",
	s: "/settings",
}

export function Shell({ children }: ShellProps) {
	const [, navigate] = useLocation()
	const { toggleCommandPalette, toggleAI, toggleSidebar, zenMode } = useUiStore()

	// Global keyboard shortcuts + link-click interceptor for view transitions
	useEffect(() => {
		let gPressed = false
		let gTimer: ReturnType<typeof setTimeout> | null = null

		function handleKeyDown(e: KeyboardEvent) {
			const target = e.target as HTMLElement
			const isInput =
				target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable

			// ⌘K — command palette
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault()
				toggleCommandPalette()
				return
			}

			// ⌘J — AI drawer
			if ((e.metaKey || e.ctrlKey) && e.key === "j") {
				e.preventDefault()
				toggleAI()
				return
			}

			if (isInput) return

			// [ — toggle sidebar
			if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
				toggleSidebar()
				return
			}

			// g + letter navigation
			if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
				gPressed = true
				if (gTimer) clearTimeout(gTimer)
				gTimer = setTimeout(() => {
					gPressed = false
				}, 1000)
				return
			}

			if (gPressed && ROUTE_MAP[e.key]) {
				e.preventDefault()
				gPressed = false
				if (gTimer) clearTimeout(gTimer)
				const path = ROUTE_MAP[e.key]
				if (path) navigateWithTransition(path, navigate)
			}
		}

		// Intercept all internal <a> clicks in the capture phase so that
		// preventDefault() prevents wouter's Link from double-navigating.
		function handleLinkClick(e: MouseEvent) {
			if (e.defaultPrevented) return
			if (e.button !== 0) return
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

			const a = (e.target as Element).closest("a")
			if (!a) return

			const href = a.getAttribute("href")
			if (!href || href.startsWith("javascript:") || href.startsWith("#")) return

			let url: URL
			try {
				url = new URL(href, window.location.href)
			} catch {
				return
			}

			if (url.origin !== window.location.origin) return
			if (a.target && a.target !== "_self") return

			e.preventDefault()
			const path = url.pathname + url.search + url.hash
			navigateWithTransition(path, navigate)
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("click", handleLinkClick, true)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("click", handleLinkClick, true)
		}
	}, [navigate, toggleCommandPalette, toggleAI, toggleSidebar])

	// Zen mode: no chrome — full-screen content only.
	if (zenMode) {
		return (
			<div className="flex h-full flex-col overflow-hidden">
				<main className="flex-1 overflow-y-auto bg-bg">{children}</main>
				<CommandPalette />
			</div>
		)
	}

	// `SideNav` self-sizes (16rem ↔ 4rem rail), so let it drive the AppShell nav
	// column width instead of AppShell's fixed default.
	const shellStyle = {
		"--cascivo-shell-aside-inline-size": "fit-content",
	} as unknown as JSX.CSSProperties

	return (
		<div className="h-full" style={shellStyle}>
			<AppShell header={<TopBar />} nav={<Sidebar />}>
				<div className="flex h-full overflow-hidden">
					<main className="flex-1 overflow-y-auto bg-bg">{children}</main>
					<AIDrawer />
				</div>
			</AppShell>
			<CommandPalette />
		</div>
	)
}

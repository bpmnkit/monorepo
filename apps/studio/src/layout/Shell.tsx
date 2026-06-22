import { AppShell } from "@cascivo/react"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useState } from "preact/hooks"
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

// cascivo AppShell renders the nav as an in-flow column at >= 64rem and as an
// off-canvas drawer below it. We track that breakpoint so the header burger can
// do the right thing per layout (see Shell).
function useIsDesktop() {
	const query = "(min-width: 64rem)"
	const [isDesktop, setIsDesktop] = useState(
		() => typeof window === "undefined" || window.matchMedia(query).matches,
	)
	useEffect(() => {
		const mq = window.matchMedia(query)
		const onChange = () => setIsDesktop(mq.matches)
		mq.addEventListener("change", onChange)
		return () => mq.removeEventListener("change", onChange)
	}, [])
	return isDesktop
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
	const { toggleCommandPalette, toggleAI, toggleSidebar, zenMode, sidebarExpanded } = useUiStore()
	const isDesktop = useIsDesktop()
	const [mobileNavOpen, setMobileNavOpen] = useState(false)

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

	// Give the AppShell nav column an explicit width that matches `SideNav`'s own
	// rail/expanded width and tracks the collapsed state. (A `fit-content` column
	// collapses to 0 if the nav is ever taken out of flow, causing layout flicker.)
	const shellStyle = {
		"--cascivo-shell-aside-inline-size": sidebarExpanded
			? "var(--cascivo-sidenav-inline-size, 16rem)"
			: "var(--cascivo-sidenav-rail-inline-size, 4rem)",
	} as unknown as JSX.CSSProperties

	return (
		<div className="h-full" style={shellStyle}>
			<AppShell
				header={<TopBar />}
				nav={<Sidebar />}
				open={isDesktop ? true : mobileNavOpen}
				onOpenChange={(open) => {
					// Desktop: the nav stays in flow, so the burger collapses it to the
					// icon rail (toggling `sidebarExpanded`) instead of hiding it.
					// Mobile: it opens/closes the off-canvas drawer.
					if (isDesktop) toggleSidebar()
					else setMobileNavOpen(open)
				}}
			>
				<div className="flex h-full overflow-hidden">
					<main className="flex-1 overflow-y-auto bg-bg">{children}</main>
					<AIDrawer />
				</div>
			</AppShell>
			<CommandPalette />
		</div>
	)
}

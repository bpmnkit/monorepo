type RouteHandler = (params: Record<string, string>) => void

interface Route {
	pattern: RegExp
	keys: string[]
	handler: RouteHandler
}

export function createRouter(): {
	on(path: string, handler: RouteHandler): void
	navigate(path: string): void
	start(): () => void
	currentPath(): string
	/** Re-run the handler for the current path, e.g. after the profile changed. */
	refresh(): void
} {
	const routes: Route[] = []
	let _current = "/"

	function patternFor(path: string): { pattern: RegExp; keys: string[] } {
		const keys: string[] = []
		const src = path.replace(/:([^/]+)/g, (_, key: string) => {
			keys.push(key)
			return "([^/]+)"
		})
		return { pattern: new RegExp(`^${src}$`), keys }
	}

	function dispatch(path: string): void {
		_current = path
		for (const route of routes) {
			const m = route.pattern.exec(path)
			if (m) {
				const params: Record<string, string> = {}
				for (let i = 0; i < route.keys.length; i++) {
					const key = route.keys[i]
					if (key) params[key] = m[i + 1] ?? ""
				}
				route.handler(params)
				return
			}
		}
	}

	function on(path: string, handler: RouteHandler): void {
		const { pattern, keys } = patternFor(path)
		routes.push({ pattern, keys, handler })
	}

	function navigate(path: string): void {
		window.location.hash = path
	}

	function onHashChange(): void {
		const hash = window.location.hash.slice(1) || "/"
		dispatch(hash)
	}

	function start(): () => void {
		window.addEventListener("hashchange", onHashChange)
		onHashChange()
		return () => window.removeEventListener("hashchange", onHashChange)
	}

	function currentPath(): string {
		return _current
	}

	function refresh(): void {
		dispatch(_current)
	}

	return { on, navigate, start, currentPath, refresh }
}

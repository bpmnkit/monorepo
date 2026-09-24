/**
 * The `casen dev` server: a local web UI over a project directory.
 *
 * Node built-ins only. It serves one HTML page and one pre-built script, a
 * small JSON API over the project's model files, and a Server-Sent Events
 * stream that carries file changes and check results to every open tab.
 *
 * ## Who may talk to it
 *
 * It listens on loopback, which keeps other machines out but not other web
 * pages: anything open in the same browser can send requests to 127.0.0.1.
 * Two checks close that:
 *
 * - **Host header.** A request must name this server by a loopback host. A
 *   DNS-rebinding page reaches the port under its own domain name, and is
 *   refused here before any file is read.
 * - **Session token.** Every `/api` call carries a random token generated at
 *   startup and handed out only inside the page. A cross-origin page can send
 *   a request but cannot read the page to learn the token, and cannot set the
 *   header without a CORS preflight this server never answers.
 *
 * File paths are then confined to the project by `resolveProjectPath`.
 */

import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { basename, dirname, sep } from "node:path"
import { type CheckResult, type ScenarioEngine, checkFile } from "./checks.js"
import {
	type EditableKind,
	PathError,
	type ProjectFile,
	SKIPPED_DIRS,
	TESTS_SUFFIX,
	discoverFiles,
	etagOf,
	kindOf,
	resolveProjectPath,
} from "./project.js"
import { type DevEvent, TOKEN_HEADER } from "./protocol.js"
import { watchTree } from "./watch.js"
import { WriteError, writeVerified } from "./write.js"

export interface DevServerOptions {
	/** The project directory, resolved through `realpath`. */
	root: string
	/** `0` picks a free port. Always bound to 127.0.0.1. */
	port: number
	engine: ScenarioEngine
	/** The pre-built browser bundle served as `/app.js`. */
	uiScript: string
	/** Called after every check run — the terminal reporter hooks in here. */
	onCheck?: (result: CheckResult) => void
	/** Called when a file changes on disk (not through a save). */
	onExternalChange?: (path: string) => void
	/** Debounce for file-system events, in ms. Default 80. */
	debounceMs?: number
}

export interface DevServer {
	readonly url: string
	readonly port: number
	/** Required on every `/api` request, as the `x-casen-dev-token` header. */
	readonly token: string
	/** Resolves once the first round of checks over every file has finished. */
	readonly initialChecks: Promise<void>
	files(): ProjectFile[]
	checks(): CheckResult[]
	close(): Promise<void>
}

/** The largest document a save may carry. Models are kilobytes; this is generous. */
const MAX_BODY_BYTES = 20 * 1024 * 1024

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

function page(title: string, token: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="casen-dev-token" content="${escapeHtml(token)}" />
<link rel="icon" href="data:," />
<title>${escapeHtml(title)} — casen dev</title>
</head>
<body>
<div id="app"></div>
<script type="module" src="/app.js"></script>
</body>
</html>`
}

function send(res: ServerResponse, status: number, body: unknown): void {
	const json = JSON.stringify(body)
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
	})
	res.end(json)
}

async function readBody(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = []
	let size = 0
	for await (const chunk of req) {
		const buf = chunk as Buffer
		size += buf.length
		if (size > MAX_BODY_BYTES) throw new WriteError("Request body too large.", 400)
		chunks.push(buf)
	}
	return Buffer.concat(chunks).toString("utf8")
}

/**
 * Starts the server and the watcher, and kicks off a check of every model.
 *
 * @returns once the port is bound; checks carry on in the background.
 */
export async function startDevServer(options: DevServerOptions): Promise<DevServer> {
	const { root, engine } = options
	const debounceMs = options.debounceMs ?? 80
	const token = randomBytes(24).toString("hex")

	let files: ProjectFile[] = []
	const results = new Map<string, CheckResult>()
	/** What each file said when this process last read or wrote it, to tell real changes from echoes. */
	const known = new Map<string, string | null>()
	const clients = new Set<ServerResponse>()
	let port = 0

	function broadcast(event: DevEvent): void {
		const frame = `data: ${JSON.stringify(event)}\n\n`
		for (const client of clients) client.write(frame)
	}

	// ── Checks ────────────────────────────────────────────────────────────────
	// One run at a time, and a file queued twice is checked once: a burst of
	// saves should not stack up a burst of scenario runs.
	const pending = new Set<string>()
	let chain: Promise<void> = Promise.resolve()

	function queueCheck(path: string): Promise<void> {
		if (pending.has(path)) return chain
		pending.add(path)
		chain = chain.then(async () => {
			pending.delete(path)
			const file = files.find((f) => f.path === path)
			if (file === undefined) {
				results.delete(path)
				return
			}
			const result = await checkFile(`${root}${sep}${path}`, path, file.kind, engine)
			results.set(path, result)
			broadcast({ type: "check", result })
			options.onCheck?.(result)
		})
		return chain
	}

	/** Which models to re-check when `path` changes. */
	function affectedBy(path: string, kind: EditableKind): string[] {
		if (kind === "tests") return [path.slice(0, -TESTS_SUFFIX.length)]
		if (kind !== "dmn") return [path]
		// A decision is looked up in the `.dmn` files beside the process, so its
		// neighbours' scenarios may now pass or fail differently.
		const dir = dirname(path)
		return [
			path,
			...files
				.filter((f) => f.kind === "bpmn" && f.hasTests && dirname(f.path) === dir)
				.map((f) => f.path),
		]
	}

	async function refreshFiles(): Promise<void> {
		const next = await discoverFiles(root)
		if (JSON.stringify(next) !== JSON.stringify(files)) {
			const gone = files.filter((f) => !next.some((n) => n.path === f.path))
			files = next
			for (const f of gone) results.delete(f.path)
			broadcast({ type: "files", files })
		}
	}

	// ── Watcher ───────────────────────────────────────────────────────────────
	const timers = new Map<string, NodeJS.Timeout>()

	async function onDiskChange(path: string): Promise<void> {
		const kind = kindOf(path)
		if (kind === null) return
		const text = await readFile(`${root}${sep}${path}`, "utf8").catch(() => null)
		const etag = text === null ? null : etagOf(text)
		if (known.has(path) && known.get(path) === etag) return
		known.set(path, etag)
		await refreshFiles()
		broadcast({ type: "change", path, etag })
		options.onExternalChange?.(path)
		for (const target of affectedBy(path, kind)) void queueCheck(target)
	}

	// ── HTTP ──────────────────────────────────────────────────────────────────
	function allowedHost(req: IncomingMessage): boolean {
		const hostHeader = req.headers.host ?? ""
		return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(hostHeader)
	}

	async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
		const presented =
			url.pathname === "/api/events" ? url.searchParams.get("token") : req.headers[TOKEN_HEADER]
		if (presented !== token) {
			send(res, 403, { error: "Missing or wrong session token." })
			return
		}

		if (url.pathname === "/api/events" && req.method === "GET") {
			res.writeHead(200, {
				"content-type": "text/event-stream",
				"cache-control": "no-store",
				connection: "keep-alive",
			})
			res.write(`data: ${JSON.stringify({ type: "files", files })}\n\n`)
			for (const result of results.values()) {
				res.write(`data: ${JSON.stringify({ type: "check", result })}\n\n`)
			}
			clients.add(res)
			req.on("close", () => clients.delete(res))
			return
		}

		if (url.pathname === "/api/files" && req.method === "GET") {
			send(res, 200, {
				project: basename(root),
				engine,
				files,
				checks: [...results.values()],
			})
			return
		}

		if (url.pathname === "/api/file") {
			const target = await resolveProjectPath(root, url.searchParams.get("path") ?? "")
			if (req.method === "GET") {
				const text = await readFile(target.absolute, "utf8").catch(() => null)
				if (text === null) {
					send(res, 404, { error: `No such file: ${target.relative}` })
					return
				}
				known.set(target.relative, etagOf(text))
				send(res, 200, {
					path: target.relative,
					kind: target.kind,
					text,
					etag: etagOf(text),
				})
				return
			}
			if (req.method === "PUT") {
				let body: { text?: unknown; baseEtag?: unknown }
				try {
					body = JSON.parse(await readBody(req)) as typeof body
				} catch (error) {
					if (error instanceof WriteError) throw error
					throw new WriteError("Request body must be JSON.", 400)
				}
				if (typeof body.text !== "string") throw new WriteError("`text` must be a string.", 400)
				if (body.baseEtag !== null && typeof body.baseEtag !== "string") {
					throw new WriteError("`baseEtag` must be a string, or null to create a file.", 400)
				}
				const written = await writeVerified(target.absolute, target.kind, body.text, body.baseEtag)
				// Recorded before anyone hears of it, so the watcher's echo of this
				// write is recognised and dropped.
				known.set(target.relative, written.etag)
				await refreshFiles()
				broadcast({ type: "change", path: target.relative, etag: written.etag })
				for (const path of affectedBy(target.relative, target.kind)) void queueCheck(path)
				send(res, 200, { path: target.relative, etag: written.etag, outcome: written.outcome })
				return
			}
		}

		send(res, 404, { error: `No route: ${req.method} ${url.pathname}` })
	}

	async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		if (!allowedHost(req)) {
			res.writeHead(403, { "content-type": "text/plain" })
			res.end("casen dev only answers requests addressed to a loopback host.")
			return
		}
		res.setHeader("x-content-type-options", "nosniff")
		res.setHeader("referrer-policy", "no-referrer")
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`)

		try {
			if (url.pathname.startsWith("/api/")) {
				await handleApi(req, res, url)
				return
			}
			if (req.method !== "GET") {
				res.writeHead(405).end()
				return
			}
			if (url.pathname === "/" || url.pathname === "/index.html") {
				res.writeHead(200, {
					"content-type": "text/html; charset=utf-8",
					"cache-control": "no-store",
					"content-security-policy":
						"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
				})
				res.end(page(basename(root), token))
				return
			}
			if (url.pathname === "/app.js") {
				const script = await readFile(options.uiScript).catch(() => null)
				if (script === null) {
					res.writeHead(500, { "content-type": "text/plain" })
					res.end(`The casen dev UI bundle is missing (${options.uiScript}). Rebuild @bpmnkit/cli.`)
					return
				}
				res.writeHead(200, {
					"content-type": "text/javascript; charset=utf-8",
					"cache-control": "no-cache",
				})
				res.end(script)
				return
			}
			res.writeHead(404, { "content-type": "text/plain" }).end("Not found")
		} catch (error) {
			if (res.headersSent) {
				res.end()
				return
			}
			if (error instanceof PathError) {
				send(res, 400, { error: error.message })
			} else if (error instanceof WriteError) {
				send(res, error.status, {
					error: error.message,
					...(error.currentEtag !== undefined ? { etag: error.currentEtag } : {}),
				})
			} else {
				send(res, 500, { error: error instanceof Error ? error.message : String(error) })
			}
		}
	}

	const server: Server = createServer((req, res) => {
		void handle(req, res)
	})
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject)
		server.listen(options.port, "127.0.0.1", () => {
			server.off("error", reject)
			resolve()
		})
	})
	port = (server.address() as AddressInfo).port

	// Only now that the port is ours: a failed bind (port taken) must leave no
	// watcher or check run behind for the caller's retry to trip over.
	files = await discoverFiles(root)
	const initialChecks = Promise.all(files.map((f) => queueCheck(f.path))).then(() => undefined)

	const watcher = await watchTree(
		root,
		(name) => SKIPPED_DIRS.has(name),
		(path) => {
			if (kindOf(path) === null) return
			clearTimeout(timers.get(path))
			timers.set(
				path,
				setTimeout(() => {
					timers.delete(path)
					void onDiskChange(path)
				}, debounceMs),
			)
		},
	)

	const keepAlive = setInterval(() => {
		for (const client of clients) client.write(": keep-alive\n\n")
	}, 25_000)
	keepAlive.unref()

	return {
		url: `http://127.0.0.1:${port}/`,
		port,
		token,
		initialChecks,
		files: () => files,
		checks: () => [...results.values()],
		async close() {
			clearInterval(keepAlive)
			for (const timer of timers.values()) clearTimeout(timer)
			watcher.close()
			for (const client of clients) client.end()
			clients.clear()
			const closed = new Promise<void>((resolve) => server.close(() => resolve()))
			server.closeAllConnections()
			await closed
			await chain
		},
	}
}

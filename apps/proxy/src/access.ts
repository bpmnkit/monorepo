/**
 * Who may talk to the proxy.
 *
 * The proxy holds Camunda credentials, reads and writes project files, and
 * starts AI CLIs. Any web page open in the developer's browser can send
 * requests to a port on 127.0.0.1, and any machine on the network can if the
 * proxy listens on a public interface. Three checks keep those callers out:
 *
 * - **Bind address.** Loopback by default. Listening anywhere else is an
 *   explicit opt-in (`--host` / `BPMNKIT_PROXY_HOST`) that prints a warning.
 * - **Host header.** A request must name the proxy by a loopback host, or by a
 *   host the user allowed. A DNS-rebinding page reaches the port under its own
 *   domain name and is refused here.
 * - **Origin.** A browser request must come from a first-party origin, a
 *   loopback origin, or an origin the user allowed. Anything else gets a 403
 *   and no CORS headers — refusing only the CORS headers would still let a
 *   cross-site "simple" POST write a file or start a job, since the browser
 *   sends it before it looks at the response. A browser request without an
 *   `Origin` header (an `<img>`, a link) is recognised by `Sec-Fetch-Site`
 *   and refused the same way.
 *
 * Requests without `Origin` and without `Sec-Fetch-Site` come from programs,
 * not pages: the CLI, the MCP server, curl. They are let through; a local
 * process can already read the files this proxy guards.
 */

import type { IncomingMessage, ServerResponse } from "node:http"
import { delimiter } from "node:path"

/**
 * Origins of the first-party apps that call the proxy from a browser: the
 * bpmnkit.com editor and Operate page, hosted Studio (custom domain and its
 * Cloudflare Pages domain), and the desktop app's webview (Tauri serves
 * `tauri://localhost` on macOS and Linux, `http(s)://tauri.localhost` on
 * Windows).
 */
export const FIRST_PARTY_ORIGINS: readonly string[] = [
	"https://bpmnkit.com",
	"https://studio.bpmnkit.com",
	"https://bpmnkit-studio.pages.dev",
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
]

/** Host names that always mean this machine. Bracketed, as `URL.hostname` spells IPv6. */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

export const DEFAULT_HOST = "127.0.0.1"

export interface ProxyServerOptions {
	/** Interface to listen on. Default: loopback (127.0.0.1 and ::1). */
	host?: string
	/** Extra browser origins allowed to call the proxy, e.g. `https://intranet.example`. */
	allowedOrigins?: string[]
	/** Extra `Host` header names the proxy answers to, e.g. a LAN name used with `host`. */
	allowedHosts?: string[]
	/** Directories the `/fs/*` and `/element-templates` routes may always use. */
	roots?: string[]
}

export interface AccessPolicy {
	host: string
	origins: ReadonlySet<string>
	hosts: ReadonlySet<string>
}

function list(value: string | undefined, separator: string): string[] {
	return (value ?? "")
		.split(separator)
		.map((s) => s.trim())
		.filter((s) => s !== "")
}

/**
 * Options from the environment, for the `bpmn-ai-server` binary and for
 * anything that starts the proxy without flags:
 * `BPMNKIT_PROXY_HOST`, `BPMNKIT_PROXY_ALLOWED_ORIGINS` and
 * `BPMNKIT_PROXY_ALLOWED_HOSTS` (comma-separated), `BPMNKIT_PROXY_ROOTS`
 * (separated like `PATH`).
 */
export function optionsFromEnv(env: NodeJS.ProcessEnv): ProxyServerOptions {
	const options: ProxyServerOptions = {
		allowedOrigins: list(env.BPMNKIT_PROXY_ALLOWED_ORIGINS, ","),
		allowedHosts: list(env.BPMNKIT_PROXY_ALLOWED_HOSTS, ","),
		roots: list(env.BPMNKIT_PROXY_ROOTS, delimiter),
	}
	const host = env.BPMNKIT_PROXY_HOST?.trim()
	if (host) options.host = host
	return options
}

/** Explicit options win for `host`; the lists are the union of both. */
export function mergeOptions(
	fromEnv: ProxyServerOptions,
	explicit: ProxyServerOptions,
): ProxyServerOptions {
	return {
		host: explicit.host ?? fromEnv.host ?? DEFAULT_HOST,
		allowedOrigins: [...(fromEnv.allowedOrigins ?? []), ...(explicit.allowedOrigins ?? [])],
		allowedHosts: [...(fromEnv.allowedHosts ?? []), ...(explicit.allowedHosts ?? [])],
		roots: [...(fromEnv.roots ?? []), ...(explicit.roots ?? [])],
	}
}

/** `Origin` values are compared as the browser serialises them: lower case, no trailing slash. */
function normaliseOrigin(origin: string): string {
	return origin.trim().replace(/\/+$/, "").toLowerCase()
}

/** A host name as `URL.hostname` spells it, without port or trailing dot; `null` if unparseable. */
function hostnameOf(hostHeader: string): string | null {
	try {
		return new URL(`http://${hostHeader}`).hostname.replace(/\.$/, "").toLowerCase()
	} catch {
		return null
	}
}

export function isLoopbackHost(host: string): boolean {
	const name = hostnameOf(host.includes(":") && !host.startsWith("[") ? `[${host}]` : host)
	return name !== null && LOOPBACK_HOSTNAMES.has(name)
}

/** The addresses to listen on: both loopback families by default, else exactly what was asked. */
export function listenHosts(host: string): string[] {
	return isLoopbackHost(host) ? ["127.0.0.1", "::1"] : [host]
}

/** The warning to print when the proxy listens beyond loopback; `null` when it does not. */
export function exposureWarning(host: string, port: number): string | null {
	if (isLoopbackHost(host)) return null
	return [
		`WARNING: the proxy is listening on ${host}:${port}, not only on loopback.`,
		"Any machine that can reach this address can use your Camunda profiles, read and",
		"write files in opened workspaces, and run AI tools through it. Only do this on a",
		"network you trust. Requests must still name an allowed host: pass --allow-host",
		"(or BPMNKIT_PROXY_ALLOWED_HOSTS) with the name clients use to reach this machine.",
	].join("\n")
}

export function createAccessPolicy(options: ProxyServerOptions): AccessPolicy {
	const host = options.host ?? DEFAULT_HOST
	const hosts = new Set(LOOPBACK_HOSTNAMES)
	for (const h of options.allowedHosts ?? []) {
		const name = hostnameOf(h)
		if (name) hosts.add(name)
	}
	// A specific interface address is a name clients will use; a wildcard is not.
	if (!isLoopbackHost(host) && host !== "0.0.0.0" && host !== "::") {
		const name = hostnameOf(host.includes(":") && !host.startsWith("[") ? `[${host}]` : host)
		if (name) hosts.add(name)
	}
	const origins = new Set(FIRST_PARTY_ORIGINS.map(normaliseOrigin))
	for (const o of options.allowedOrigins ?? []) {
		const origin = normaliseOrigin(o)
		// A wildcard here would undo the whole check; refuse it rather than honour it.
		if (origin !== "" && origin !== "*" && origin !== "null") origins.add(origin)
	}
	return { host, origins, hosts }
}

export function isAllowedOrigin(policy: AccessPolicy, origin: string): boolean {
	const normalised = normaliseOrigin(origin)
	if (policy.origins.has(normalised)) return true
	try {
		const url = new URL(normalised)
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			LOOPBACK_HOSTNAMES.has(url.hostname)
		)
	} catch {
		return false
	}
}

export type AccessDecision =
	| { allowed: true; corsOrigin: string | null }
	| { allowed: false; reason: string }

export function decideAccess(
	policy: AccessPolicy,
	headers: IncomingMessage["headers"],
): AccessDecision {
	const hostHeader = headers.host
	const hostname = hostHeader ? hostnameOf(hostHeader) : null
	if (hostname === null || !policy.hosts.has(hostname)) {
		return {
			allowed: false,
			reason: `The proxy only answers requests addressed to localhost or an allowed host, not "${hostHeader ?? ""}". Allow another with --allow-host or BPMNKIT_PROXY_ALLOWED_HOSTS.`,
		}
	}
	const origin = headers.origin
	if (origin !== undefined) {
		if (isAllowedOrigin(policy, origin)) return { allowed: true, corsOrigin: origin }
		return {
			allowed: false,
			reason: `Origin "${origin}" may not use the proxy. Allow it with --allow-origin or BPMNKIT_PROXY_ALLOWED_ORIGINS.`,
		}
	}
	const site = headers["sec-fetch-site"]
	if (site !== undefined && site !== "same-origin" && site !== "none") {
		return { allowed: false, reason: "Cross-site browser requests without an Origin are refused." }
	}
	return { allowed: true, corsOrigin: null }
}

const ALLOW_METHODS = "GET, POST, DELETE, OPTIONS"
const ALLOW_HEADERS = "Content-Type, X-Profile"

/**
 * Applies the policy to one request. Returns `true` when the request has been
 * answered — refused, or a preflight — and the caller must not route it.
 */
export function guardRequest(
	policy: AccessPolicy,
	req: IncomingMessage,
	res: ServerResponse,
): boolean {
	res.setHeader("Vary", "Origin")
	const decision = decideAccess(policy, req.headers)
	if (!decision.allowed) {
		console.warn(`[access] refused ${req.method} ${req.url} — ${decision.reason}`)
		res.writeHead(403, { "Content-Type": "application/json" })
		res.end(JSON.stringify({ error: decision.reason }))
		return true
	}
	if (decision.corsOrigin !== null) {
		res.setHeader("Access-Control-Allow-Origin", decision.corsOrigin)
		res.setHeader("Access-Control-Allow-Methods", ALLOW_METHODS)
		res.setHeader("Access-Control-Allow-Headers", ALLOW_HEADERS)
	}
	if (req.method === "OPTIONS") {
		if (decision.corsOrigin !== null) {
			res.setHeader("Access-Control-Max-Age", "600")
			// Chrome's Private Network Access asks before a public page reaches loopback.
			if (req.headers["access-control-request-private-network"] === "true") {
				res.setHeader("Access-Control-Allow-Private-Network", "true")
			}
		}
		res.writeHead(204)
		res.end()
		return true
	}
	return false
}

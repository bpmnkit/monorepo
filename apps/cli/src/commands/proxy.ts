import { spawn } from "node:child_process"
import { delimiter } from "node:path"
import { fileURLToPath } from "node:url"
import { type ProxyServerOptions, startServer } from "@bpmnkit/proxy"
import type { Command, CommandGroup } from "../types.js"

const startCmd: Command = {
	name: "start",
	description: "Start the BPMN Kit proxy server (AI bridge + Camunda API proxy)",
	flags: [
		{
			name: "port",
			description: "Port to listen on",
			type: "number",
			default: 3033,
		},
		{
			name: "host",
			description:
				"Interface to listen on (default: loopback only). Anything else exposes the proxy to the network",
			type: "string",
		},
		{
			name: "allow-origin",
			description:
				"Extra browser origins allowed to call the proxy, comma-separated (bpmnkit.com, Studio, the desktop app and localhost are always allowed)",
			type: "string",
		},
		{
			name: "allow-host",
			description:
				"Extra Host header names the proxy answers to, comma-separated (needed with --host 0.0.0.0)",
			type: "string",
		},
		{
			name: "root",
			description: `Workspace folders the file routes may always use, separated by "${delimiter}"`,
			type: "string",
		},
	],
	examples: [
		{ description: "Start on default port (3033)", command: "casen proxy start" },
		{ description: "Start on a custom port", command: "casen proxy start --port 4000" },
		{
			description: "Allow an extra web app to call the proxy",
			command: "casen proxy start --allow-origin https://modeler.example.com",
		},
		{
			description: "Allow a workspace folder the proxy would not open on its own",
			command: "casen proxy start --root ~/.local/share/processes",
		},
		{
			description: "Listen on every interface (trusted networks only)",
			command: "casen proxy start --host 0.0.0.0 --allow-host devbox.lan",
		},
	],
	async run(ctx) {
		const port = (ctx.flags.port as number | undefined) ?? 3033
		const options = proxyOptionsFromFlags(ctx.flags)

		ctx.output.info(`Starting BPMN Kit proxy server on port ${port}...`)

		startServer(port, options)

		await new Promise<void>((resolve) => {
			process.once("SIGINT", resolve)
			process.once("SIGTERM", resolve)
		})
	},
}

function listFlag(value: unknown, separator: string): string[] {
	if (typeof value !== "string") return []
	return value
		.split(separator)
		.map((s) => s.trim())
		.filter((s) => s !== "")
}

/** `--host`, `--allow-origin`, `--allow-host` and `--root`, as `startServer` options. */
export function proxyOptionsFromFlags(
	flags: Record<string, string | boolean | number | undefined>,
): ProxyServerOptions {
	const options: ProxyServerOptions = {
		allowedOrigins: listFlag(flags["allow-origin"], ","),
		allowedHosts: listFlag(flags["allow-host"], ","),
		roots: listFlag(flags.root, delimiter),
	}
	if (typeof flags.host === "string" && flags.host.trim() !== "") options.host = flags.host.trim()
	return options
}

const mcpCmd: Command = {
	name: "mcp",
	description: "Start the BPMNKit AIKit MCP server (stdio transport for Claude Code)",
	examples: [
		{
			description: "Start MCP server (used by Claude Code plugin)",
			command: "casen proxy mcp",
		},
	],
	async run(_ctx) {
		const aitKitMcpUrl = import.meta.resolve("@bpmnkit/proxy/aikit-mcp")
		const aitKitMcpPath = fileURLToPath(aitKitMcpUrl)

		await new Promise<void>((resolve, reject) => {
			const child = spawn(process.execPath, [aitKitMcpPath], {
				stdio: "inherit",
				env: process.env,
			})

			child.on("error", reject)
			child.on("close", (code) => {
				if (code === 0 || code === null) resolve()
				else reject(new Error(`aikit-mcp exited with code ${code}`))
			})
		})
	},
}

export const proxyGroup: CommandGroup = {
	name: "proxy",
	description: "Start the local AI bridge and Camunda API proxy server",
	commands: [startCmd, mcpCmd],
}

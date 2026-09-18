import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { startServer } from "@bpmnkit/proxy"
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
	],
	examples: [
		{ description: "Start on default port (3033)", command: "casen proxy start" },
		{ description: "Start on a custom port", command: "casen proxy start --port 4000" },
	],
	async run(ctx) {
		const port = (ctx.flags.port as number | undefined) ?? 3033

		ctx.output.info(`Starting BPMN Kit proxy server on port ${port}...`)

		startServer(port)

		await new Promise<void>((resolve) => {
			process.once("SIGINT", resolve)
			process.once("SIGTERM", resolve)
		})
	},
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

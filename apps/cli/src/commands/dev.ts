import { realpath, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { CheckResult, ScenarioEngine } from "../dev/checks.js"
import { formatCheckDetails, formatCheckLine, formatTally, paint } from "../dev/report.js"
import { type DevServer, startDevServer } from "../dev/server.js"
import type { Command, CommandGroup } from "../types.js"
import { openBrowser } from "./view.js"

const DEFAULT_PORT = 4747
/** How many ports after the default to try before letting the OS pick one. */
const PORT_ATTEMPTS = 20

/** Where the build puts the browser bundle, relative to this file in `dist/commands/`. */
const UI_SCRIPT = fileURLToPath(new URL("../dev-ui/app.js", import.meta.url))

async function listen(
	options: Omit<Parameters<typeof startDevServer>[0], "port">,
	explicitPort: number | undefined,
): Promise<DevServer> {
	if (explicitPort !== undefined) return startDevServer({ ...options, port: explicitPort })
	for (let offset = 0; offset < PORT_ATTEMPTS; offset++) {
		try {
			return await startDevServer({ ...options, port: DEFAULT_PORT + offset })
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error
		}
	}
	return startDevServer({ ...options, port: 0 })
}

const devCmd: Command = {
	name: "dev",
	description:
		"Local development loop — edit, simulate, lint and test every process in a folder in the browser",
	args: [{ name: "dir", description: "Project directory (default: current directory)" }],
	flags: [
		{
			name: "port",
			description: `Port to listen on (default: ${DEFAULT_PORT}, or the next free one)`,
			type: "number",
		},
		{
			name: "open",
			description: "Open the browser on start. --no-open to skip.",
			type: "boolean",
			default: true,
		},
		{
			name: "engine",
			description:
				"Engine for the scenario tests run on every save: ts (@bpmnkit/engine) or wasm (Reebe, Zeebe semantics)",
			type: "string",
			enum: ["ts", "wasm"],
			default: "ts",
		},
	],
	examples: [
		{ description: "Develop the processes in the current folder", command: "casen dev" },
		{ description: "A different folder, fixed port", command: "casen dev ./processes --port 5000" },
		{
			description: "Run scenarios with Zeebe semantics (reebe-wasm)",
			command: "casen dev --engine wasm",
		},
	],
	async run(ctx) {
		const requestedDir = ctx.positional[0] ?? "."
		const dirStat = await stat(requestedDir).catch(() => null)
		if (dirStat === null || !dirStat.isDirectory()) {
			throw new Error(`Not a directory: ${requestedDir}`)
		}
		const root = await realpath(resolve(requestedDir))

		const engineFlag = ctx.flags.engine ?? "ts"
		if (engineFlag !== "ts" && engineFlag !== "wasm") {
			throw new Error(`Unknown --engine "${String(engineFlag)}". Use ts or wasm.`)
		}
		const engine: ScenarioEngine = engineFlag
		const portFlag = ctx.flags.port
		if (portFlag !== undefined && (typeof portFlag !== "number" || !Number.isInteger(portFlag))) {
			throw new Error(`--port must be a whole number, got "${String(portFlag)}".`)
		}

		const colors = process.stdout.isTTY === true && !process.env.NO_COLOR
		const p = paint(colors)
		const out = (line: string) => process.stdout.write(`${line}\n`)
		let initialDone = false

		const server = await listen(
			{
				root,
				engine,
				uiScript: UI_SCRIPT,
				onCheck(result: CheckResult) {
					out(formatCheckLine(result, p))
					for (const line of formatCheckDetails(result)) out(p.dim(`    ${line}`))
					if (initialDone) out(`  ${formatTally(server.checks(), p)}`)
				},
				onExternalChange(path) {
					out(p.dim(`↻ ${path} changed on disk`))
				},
			},
			portFlag,
		)

		const files = server.files()
		const count = (kind: string) => files.filter((f) => f.kind === kind).length
		out("")
		out(`  casen dev  ${p.dim(root)}`)
		out(`  UI        ${server.url}`)
		out(
			`  files     ${files.length} (${count("bpmn")} bpmn, ${count("dmn")} dmn, ${count("form")} form)`,
		)
		out(`  scenarios ${engine === "wasm" ? "reebe-wasm (Zeebe semantics)" : "@bpmnkit/engine"}`)
		out(
			p.dim(
				"  Deploy or AI from the editor needs the proxy: run `casen proxy start` in another terminal.",
			),
		)
		out("")
		if (files.length === 0) {
			out(p.yellow("  No .bpmn, .dmn or .form files yet — create one and it will appear."))
		}

		if (ctx.flags.open !== false) openBrowser(server.url)

		await server.initialChecks
		initialDone = true
		if (files.length > 0) out(`  ${formatTally(server.checks(), p)}`)
		out(p.dim("  Watching for changes. Ctrl+C to stop."))

		await new Promise<void>((done) => {
			process.once("SIGINT", done)
			process.once("SIGTERM", done)
		})
		await server.close()
	},
}

export const devGroup: CommandGroup = {
	name: "dev",
	description:
		"Local development loop: browser editor with simulation, live reload, lint and tests on save",
	commands: [devCmd],
}

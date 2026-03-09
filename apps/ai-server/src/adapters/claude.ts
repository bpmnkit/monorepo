import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

export const supportsMcp = true

interface Message {
	role: string
	content: string
}

interface StreamEvent {
	type: string
	message?: {
		content?: Array<{ type: string; text?: string }>
	}
}

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("claude", ["--version"], { stdio: "ignore" })
		proc.on("error", () => resolve(false))
		proc.on("close", (code) => resolve(code === 0))
	})
}

export async function stream(
	messages: Message[],
	systemPrompt: string,
	mcpConfigFile: string | null,
	onToken: (text: string) => void,
): Promise<void> {
	// Build conversation as a single prompt string
	const parts = [systemPrompt, ""]
	for (const msg of messages) {
		parts.push(`${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`)
	}
	parts.push("Assistant:")
	const fullPrompt = parts.join("\n")

	const MCP_TOOLS = [
		"mcp__bpmn__get_diagram",
		"mcp__bpmn__compose_diagram",
		"mcp__bpmn__add_elements",
		"mcp__bpmn__remove_elements",
		"mcp__bpmn__update_element",
		"mcp__bpmn__set_condition",
		"mcp__bpmn__add_http_call",
		"mcp__bpmn__replace_diagram",
	]

	const args = [
		"-p",
		fullPrompt,
		"--output-format",
		"stream-json",
		"--verbose",
		"--dangerously-skip-permissions",
		"--permission-mode",
		"bypassPermissions",
	]

	// Write a project-level .claude/settings.json that pre-approves all bpmn tools,
	// then spawn claude with cwd pointing there so it reads the settings.
	let spawnCwd: string | undefined
	if (mcpConfigFile) {
		const tmpDir = dirname(mcpConfigFile)
		spawnCwd = tmpDir
		const claudeDir = join(tmpDir, ".claude")
		mkdirSync(claudeDir, { recursive: true })
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({ permissions: { allow: MCP_TOOLS } }),
		)
		args.push("--mcp-config", mcpConfigFile)
		args.push("--allowedTools", MCP_TOOLS.join(","))
		args.push("--strict-mcp-config")
	}

	// Strip CLAUDECODE so the nested-session guard in the CLI doesn't block us.
	const spawnEnv: Record<string, string | undefined> = { ...process.env }
	spawnEnv.CLAUDECODE = undefined

	console.log(`[claude] spawning with MCP: ${mcpConfigFile !== null}`)

	await new Promise<void>((resolve, reject) => {
		const proc = spawn("claude", args, {
			cwd: spawnCwd,
			env: spawnEnv,
			stdio: ["ignore", "pipe", "pipe"],
		})

		let buf = ""
		let stderrBuf = ""

		proc.stdout?.on("data", (chunk: Buffer) => {
			buf += chunk.toString()
			const lines = buf.split("\n")
			buf = lines.pop() ?? ""
			for (const line of lines) {
				if (!line.trim()) continue
				try {
					const event = JSON.parse(line) as StreamEvent
					if (event.type === "assistant" && event.message?.content) {
						for (const block of event.message.content) {
							if (block.type === "text" && block.text) {
								onToken(block.text)
							}
						}
					}
				} catch {
					/* non-JSON line, skip */
				}
			}
		})

		proc.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString()
			stderrBuf += text
			process.stderr.write(`[claude stderr] ${text}`)
		})

		proc.on("error", (err) => {
			console.error(`[claude] spawn error: ${String(err)}`)
			reject(err)
		})
		proc.on("close", (code) => {
			console.log(`[claude] exited with code ${code}`)
			if (code === 0) {
				resolve()
			} else {
				const detail = stderrBuf.trim() ? `: ${stderrBuf.trim()}` : ""
				reject(new Error(`claude exited with code ${code}${detail}`))
			}
		})
	})
}

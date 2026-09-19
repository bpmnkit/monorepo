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
	/** Raw API event, present only with `--include-partial-messages`. */
	event?: {
		type: string
		index?: number
		content_block?: { type: string; name?: string }
		delta?: { type: string; partial_json?: string }
	}
}

/** Tool calls whose arguments carry the diagram the model is writing. */
const DIAGRAM_TOOL_PREFIX = "mcp__bpmn__"

/**
 * Reads one line of `--output-format stream-json` output.
 *
 * Split out from the spawn so it can be exercised against a recorded stream:
 * the ordering it depends on — a tool block opening before its argument
 * fragments arrive, and closing before the index is reused — is the CLI's, not
 * something this file can assert on its own.
 *
 * @param line - One line of stdout. Blank and non-JSON lines are ignored.
 * @param toolBlocks - Content-block index → tool name, carried across lines.
 * @param onToken - Called with assistant text.
 * @param onToolInput - Called with each fragment of a diagram tool's arguments.
 */
export function readStreamJsonLine(
	line: string,
	toolBlocks: Map<number, string>,
	onToken: (text: string) => void,
	onToolInput?: (text: string) => void,
): void {
	if (!line.trim()) return
	let event: StreamEvent
	try {
		event = JSON.parse(line) as StreamEvent
	} catch {
		return // non-JSON line
	}

	if (event.type === "assistant" && event.message?.content) {
		for (const block of event.message.content) {
			if (block.type === "text" && block.text) onToken(block.text)
		}
	}

	// A tool call arrives as one finished `assistant` message, so the diagram a
	// single call builds is invisible until that call returns. The partial events
	// carry its arguments as they are written, and the block index is what ties a
	// fragment to the tool it belongs to — the model's other tools stream through
	// the same channel.
	if (!onToolInput || event.type !== "stream_event" || !event.event) return
	const inner = event.event
	const index = inner.index
	if (index === undefined) return

	if (inner.type === "content_block_start" && inner.content_block?.type === "tool_use") {
		if (inner.content_block.name) toolBlocks.set(index, inner.content_block.name)
	} else if (inner.type === "content_block_stop") {
		toolBlocks.delete(index)
	} else if (
		inner.type === "content_block_delta" &&
		inner.delta?.type === "input_json_delta" &&
		inner.delta.partial_json &&
		toolBlocks.get(index)?.startsWith(DIAGRAM_TOOL_PREFIX)
	) {
		onToolInput(inner.delta.partial_json)
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
	/**
	 * Called with each piece of a diagram tool's arguments as the model writes
	 * them. Requesting these costs an extra stream of events, so they are only
	 * asked for when someone is listening.
	 */
	onToolInput?: (text: string) => void,
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

	if (onToolInput) args.push("--include-partial-messages")

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
		/** Content-block index → tool name, for the blocks currently open. */
		const toolBlocks = new Map<number, string>()

		proc.stdout?.on("data", (chunk: Buffer) => {
			buf += chunk.toString()
			const lines = buf.split("\n")
			buf = lines.pop() ?? ""
			for (const line of lines) readStreamJsonLine(line, toolBlocks, onToken, onToolInput)
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

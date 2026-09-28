import { spawn } from "node:child_process"
import {
	BPMN_MCP_SERVER,
	BPMN_MCP_TOOL_NAMES,
	type Message,
	inEmptyDir,
	renderConversation,
	withUntrustedInputRule,
} from "./shared.js"

export const supportsMcp = true

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

/** Tool names the CLI knows the proxy's diagram tools by. */
export const ALLOWED_TOOLS = BPMN_MCP_TOOL_NAMES.map((name) => `mcp__${BPMN_MCP_SERVER}__${name}`)

/**
 * The argv for one run.
 *
 * - `--tools ""` removes every built-in tool: no Bash, no file tools, no web.
 * - `--strict-mcp-config` loads only the MCP server in `mcpConfigFile`, if any —
 *   none of the developer's own.
 * - `--setting-sources ""` loads none of the developer's settings files, so
 *   their permission rules, hooks and plugins stay out.
 * - `--permission-mode dontAsk` refuses any tool call `--allowedTools` does not
 *   name, where bypass mode would have run it.
 * - `--system-prompt` replaces the coding-agent prompt; the conversation goes on
 *   stdin.
 */
export function buildArgs(options: {
	systemPrompt: string
	mcpConfigFile: string | null
	partialMessages: boolean
}): string[] {
	const args = [
		"-p",
		"--output-format",
		"stream-json",
		"--verbose",
		"--system-prompt",
		withUntrustedInputRule(options.systemPrompt),
		"--tools",
		"",
		"--strict-mcp-config",
		"--setting-sources",
		"",
		"--permission-mode",
		"dontAsk",
		"--disable-slash-commands",
		"--no-session-persistence",
	]
	if (options.mcpConfigFile) {
		args.push("--mcp-config", options.mcpConfigFile, "--allowedTools", ALLOWED_TOOLS.join(","))
	}
	if (options.partialMessages) args.push("--include-partial-messages")
	return args
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
	const args = buildArgs({
		systemPrompt,
		mcpConfigFile,
		partialMessages: onToolInput !== undefined,
	})

	// Strip CLAUDECODE so the nested-session guard in the CLI doesn't block us.
	const spawnEnv: Record<string, string | undefined> = { ...process.env }
	spawnEnv.CLAUDECODE = undefined

	console.log(`[claude] spawning with MCP: ${mcpConfigFile !== null}`)

	await inEmptyDir(
		(cwd) =>
			new Promise<void>((resolve, reject) => {
				const proc = spawn("claude", args, {
					cwd,
					env: spawnEnv,
					stdio: ["pipe", "pipe", "pipe"],
				})
				// A CLI that exits before reading its input says so through its exit code.
				proc.stdin?.on("error", () => {})
				proc.stdin?.end(renderConversation(messages))

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
			}),
	)
}

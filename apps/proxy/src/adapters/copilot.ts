/**
 * Adapter for the new GitHub Copilot CLI (`copilot` / `@github/copilot`, GA Feb 2026).
 * Note: the old `gh copilot` extension was deprecated Oct 2025 and is no longer supported.
 */
import { spawn } from "node:child_process"
import {
	BPMN_MCP_SERVER,
	BPMN_MCP_TOOL_NAMES,
	type Message,
	inEmptyDir,
	renderLastUserTurn,
	withUntrustedInputRule,
} from "./shared.js"

export const supportsMcp = true

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("copilot", ["--version"], { stdio: "ignore" })
		proc.on("error", () => resolve(false))
		proc.on("close", (code) => resolve(code === 0))
	})
}

/**
 * The argv for one run. Without `--allow-all-tools` (or `--yolo`, which also
 * lifts the path and URL checks) a prompt-mode run refuses every tool call that
 * needs approval; the `--deny-tool` rules win over any allow rule the developer
 * has saved, and cover the shell, file writes and URL access. The only tools
 * approved are the proxy's own diagram tools, one by one.
 */
export function buildArgs(options: { prompt: string; mcpConfigFile: string | null }): string[] {
	const args = [
		"-p",
		options.prompt,
		"--deny-tool=shell",
		"--deny-tool=write",
		"--deny-tool=url",
		"--disable-builtin-mcps",
		"--no-custom-instructions",
		"--no-ask-user",
		"--disallow-temp-dir",
	]
	if (options.mcpConfigFile) {
		args.push("--additional-mcp-config", `@${options.mcpConfigFile}`)
		for (const name of BPMN_MCP_TOOL_NAMES) args.push(`--allow-tool=${BPMN_MCP_SERVER}(${name})`)
	}
	return args
}

export async function stream(
	messages: Message[],
	systemPrompt: string,
	mcpConfigFile: string | null,
	onToken: (text: string) => void,
): Promise<void> {
	const prompt = `${withUntrustedInputRule(systemPrompt)}\n\n${renderLastUserTurn(messages)}`
	const args = buildArgs({ prompt, mcpConfigFile })

	console.log(`[copilot] spawning with MCP: ${mcpConfigFile !== null}`)

	await inEmptyDir(
		(cwd) =>
			new Promise<void>((resolve, reject) => {
				const proc = spawn("copilot", args, {
					cwd,
					stdio: ["ignore", "pipe", "pipe"],
				})

				proc.stdout?.on("data", (chunk: Buffer) => {
					onToken(chunk.toString())
				})

				proc.stderr?.on("data", (chunk: Buffer) => {
					process.stderr.write(`[copilot stderr] ${chunk.toString()}`)
				})

				proc.on("error", (err) => {
					console.error(`[copilot] spawn error: ${String(err)}`)
					reject(err)
				})
				proc.on("close", (code) => {
					console.log(`[copilot] exited with code ${code}`)
					if (code === 0) resolve()
					else reject(new Error(`copilot exited with code ${code}`))
				})
			}),
	)
}

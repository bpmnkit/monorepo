/**
 * Adapter for Google Gemini CLI.
 * MCP is not supported per-invocation (requires global settings.json),
 * so this adapter falls back to the system-prompt approach.
 */
import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { type Message, inEmptyDir, renderLastUserTurn, withUntrustedInputRule } from "./shared.js"

export const supportsMcp = false

/**
 * A policy that denies every tool, built-in or MCP. A tool a policy denies
 * outright is not offered to the model at all.
 */
export const DENY_ALL_POLICY = '[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 999\n'

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("gemini", ["--version"], { stdio: "ignore" })
		proc.on("error", () => resolve(false))
		proc.on("close", (code) => resolve(code === 0))
	})
}

/**
 * The argv for one run. The deny-all policy is loaded at the admin tier, which
 * outranks the developer's own policies, and again at the user tier, which
 * still applies on a machine whose system policy directory makes the CLI skip
 * policies given with `--admin-policy`. `--extensions none` keeps installed
 * extensions, and the tools they bring, out. `--skip-trust` trusts the empty
 * run folder, without which a headless run refuses to start.
 */
export function buildArgs(options: { prompt: string; policyFile: string }): string[] {
	return [
		"--prompt",
		options.prompt,
		"--approval-mode",
		"default",
		"--admin-policy",
		options.policyFile,
		"--policy",
		options.policyFile,
		"--extensions",
		"none",
		"--skip-trust",
	]
}

export async function stream(
	messages: Message[],
	systemPrompt: string,
	_mcpConfigFile: string | null,
	onToken: (text: string) => void,
): Promise<void> {
	const prompt = `${withUntrustedInputRule(systemPrompt)}\n\n${renderLastUserTurn(messages)}`

	console.log("[gemini] spawning (no MCP support — using system prompt fallback)")

	await inEmptyDir((cwd) => {
		const policyFile = join(cwd, "deny-all-tools.toml")
		writeFileSync(policyFile, DENY_ALL_POLICY)
		const args = buildArgs({ prompt, policyFile })
		return new Promise<void>((resolve, reject) => {
			const proc = spawn("gemini", args, {
				cwd,
				stdio: ["ignore", "pipe", "pipe"],
			})

			proc.stdout?.on("data", (chunk: Buffer) => {
				onToken(chunk.toString())
			})

			proc.stderr?.on("data", (chunk: Buffer) => {
				process.stderr.write(`[gemini stderr] ${chunk.toString()}`)
			})

			proc.on("error", (err) => {
				console.error(`[gemini] spawn error: ${String(err)}`)
				reject(err)
			})
			proc.on("close", (code) => {
				console.log(`[gemini] exited with code ${code}`)
				if (code === 0) resolve()
				else reject(new Error(`gemini exited with code ${code}`))
			})
		})
	})
}

/**
 * Adapter for Google Gemini CLI.
 * MCP is not supported per-invocation (requires global settings.json),
 * so this adapter falls back to the system-prompt approach.
 */
import { spawn } from "node:child_process"

export const supportsMcp = false

interface Message {
	role: string
	content: string
}

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("gemini", ["--version"], { stdio: "ignore" })
		proc.on("error", () => resolve(false))
		proc.on("close", (code) => resolve(code === 0))
	})
}

export async function stream(
	messages: Message[],
	systemPrompt: string,
	_mcpConfigFile: string | null,
	onToken: (text: string) => void,
): Promise<void> {
	const lastUser = [...messages].reverse().find((m) => m.role === "user")
	const prompt = `${systemPrompt}\n\nUser: ${lastUser?.content ?? "help"}`

	const args = ["--prompt", prompt, "--yolo"]

	console.log("[gemini] spawning (no MCP support — using system prompt fallback)")

	await new Promise<void>((resolve, reject) => {
		const proc = spawn("gemini", args, {
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
}

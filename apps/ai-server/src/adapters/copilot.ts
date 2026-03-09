/**
 * Adapter for the new GitHub Copilot CLI (`copilot` / `@github/copilot`, GA Feb 2026).
 * Note: the old `gh copilot` extension was deprecated Oct 2025 and is no longer supported.
 */
import { spawn } from "node:child_process"

export const supportsMcp = true

interface Message {
	role: string
	content: string
}

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("copilot", ["--version"], { stdio: "ignore" })
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
	const lastUser = [...messages].reverse().find((m) => m.role === "user")
	const prompt = `${systemPrompt}\n\nUser: ${lastUser?.content ?? "help"}`

	const args = ["-p", prompt, "--yolo"]

	if (mcpConfigFile) {
		args.push("--additional-mcp-config", mcpConfigFile)
		args.push("--allow-all-tools")
	}

	console.log(`[copilot] spawning with MCP: ${mcpConfigFile !== null}`)

	await new Promise<void>((resolve, reject) => {
		const proc = spawn("copilot", args, {
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
	})
}

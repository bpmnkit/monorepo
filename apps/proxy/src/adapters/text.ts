import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildArgs as claudeArgs, readStreamJsonLine } from "./claude.js"
import { buildArgs as copilotArgs } from "./copilot.js"
import { DENY_ALL_POLICY, buildArgs as geminiArgs } from "./gemini.js"
import { inEmptyDir, renderConversation, withUntrustedInputRule } from "./shared.js"

export type AiCli = "claude" | "copilot" | "gemini"

/**
 * One text answer from an AI CLI, with no tools and nothing logged — for
 * callers such as `casen ask` that are not the proxy server. The argv is the
 * adapters' own, so a command-line caller gets the same lockdown the proxy's
 * routes do.
 *
 * @param bin - Which CLI to run; the caller has checked it is installed.
 * @param systemPrompt - Instructions; the fencing rule is appended to them.
 * @param userText - The request, sent fenced as data.
 */
export function askText(bin: AiCli, systemPrompt: string, userText: string): Promise<string> {
	const turn = renderConversation([{ role: "user", content: userText }])
	const prompt = `${withUntrustedInputRule(systemPrompt)}\n\n${turn}`
	return inEmptyDir((cwd) => {
		let args: string[]
		let stdin: string | null = null
		if (bin === "claude") {
			args = claudeArgs({ systemPrompt, mcpConfigFile: null, partialMessages: false })
			stdin = turn
		} else if (bin === "copilot") {
			args = copilotArgs({ prompt, mcpConfigFile: null })
		} else {
			const policyFile = join(cwd, "deny-all-tools.toml")
			writeFileSync(policyFile, DENY_ALL_POLICY)
			args = geminiArgs({ prompt, policyFile })
		}

		const env: Record<string, string | undefined> = { ...process.env, CLAUDECODE: undefined }
		return new Promise<string>((resolve, reject) => {
			const proc = spawn(bin, args, {
				cwd,
				env,
				stdio: [stdin === null ? "ignore" : "pipe", "pipe", "pipe"],
			})
			if (stdin !== null) {
				proc.stdin?.on("error", () => {})
				proc.stdin?.end(stdin)
			}
			// Drain stderr so a full pipe cannot stall the child.
			proc.stderr?.resume()

			let out = ""
			let buf = ""
			const toolBlocks = new Map<number, string>()
			proc.stdout?.on("data", (chunk: Buffer) => {
				if (bin !== "claude") {
					out += chunk.toString()
					return
				}
				buf += chunk.toString()
				const lines = buf.split("\n")
				buf = lines.pop() ?? ""
				for (const line of lines) {
					readStreamJsonLine(line, toolBlocks, (text) => {
						out += text
					})
				}
			})

			proc.on("error", reject)
			proc.on("close", (code) => {
				if (code === 0) resolve(out)
				else reject(new Error(`${bin} exited with code ${code}`))
			})
		})
	})
}

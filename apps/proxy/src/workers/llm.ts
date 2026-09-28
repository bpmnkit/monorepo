import * as claude from "../adapters/claude.js"
import * as copilot from "../adapters/copilot.js"
import * as gemini from "../adapters/gemini.js"
import type { WorkerJob } from "../worker.js"
import { interpolate } from "../worker.js"

export const JOB_TYPE = "io.bpmnkit:llm:1"

interface Adapter {
	available(): Promise<boolean>
	stream(
		messages: Array<{ role: string; content: string }>,
		systemPrompt: string,
		mcpConfigFile: string | null,
		onToken: (text: string) => void,
	): Promise<void>
}

/**
 * LLM worker — calls the first available LLM adapter with a prompt.
 *
 * Variables:
 *   prompt         (required) — prompt text; supports {{varName}} interpolation
 *
 * Task headers:
 *   system         (optional) — system prompt
 *   model          (optional) — "claude" | "copilot" | "gemini"; auto-detects if omitted
 *   resultVariable (optional) — variable to store response; default "response"
 */
export async function handle(job: WorkerJob): Promise<Record<string, unknown>> {
	const rawPrompt = (job.variables.prompt as string | undefined) ?? job.customHeaders.prompt
	if (!rawPrompt) throw new Error('llm worker requires a "prompt" variable or task header')

	const prompt = interpolate(rawPrompt, job.variables)
	// The adapters send the prompt fenced as data and tell the model to act only
	// within the task the system prompt sets, so there always is one.
	const system = job.customHeaders.system
		? interpolate(job.customHeaders.system, job.variables)
		: "Answer the prompt in the user message."
	const preferredModel = job.customHeaders.model?.toLowerCase()
	const resultVariable = job.customHeaders.resultVariable ?? "response"

	const adapter = await pickAdapter(preferredModel)
	if (!adapter) throw new Error("No LLM adapter available (claude, copilot, or gemini)")

	console.log(`[worker:llm] using ${adapter.name}, prompt length=${prompt.length}`)

	let response = ""
	await adapter.instance.stream([{ role: "user", content: prompt }], system, null, (token) => {
		response += token
	})

	return { [resultVariable]: response.trim() }
}

async function pickAdapter(
	preferred?: string,
): Promise<{ name: string; instance: Adapter } | null> {
	const candidates: Array<{ name: string; instance: Adapter }> = [
		{ name: "claude", instance: claude },
		{ name: "copilot", instance: copilot },
		{ name: "gemini", instance: gemini },
	]

	if (preferred) {
		const found = candidates.find((c) => c.name === preferred)
		if (found && (await found.instance.available())) return found
		console.warn(`[worker:llm] preferred adapter "${preferred}" not available, falling back`)
	}

	for (const c of candidates) {
		if (await c.instance.available()) return c
	}
	return null
}

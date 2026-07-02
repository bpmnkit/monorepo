import { spawn } from "node:child_process"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import type { Recording, TokenUsage } from "../shared/recording-types.js"
import { executeCompactDsl } from "./compact-executor.js"
import { extractCompactBlock, extractTsBlock, extractXmlBlock } from "./extractor.js"
import { saveRecording } from "./recordings-store.js"
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario } from "./scenarios.js"
import { executeSdkCode } from "./sdk-executor.js"
import { extractDeltaText, extractResultUsage } from "./stream-parsers.js"
import {
	WITHOUT_SDK_SYSTEM_PROMPT,
	buildCompactSystemPrompt,
	buildSdkSystemPrompt,
} from "./system-prompt.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../..")
const RECORDINGS_DIR = join(REPO_ROOT, "apps/demo/recordings")
const PORT = 3001

const SDK_SYSTEM_PROMPT = buildSdkSystemPrompt(REPO_ROOT)
const COMPACT_SYSTEM_PROMPT = buildCompactSystemPrompt(REPO_ROOT)

// Tools the harness exposes that the spawned `claude` subprocess must not be able to use —
// this is a demo generating text/code from a prompt, not an agent that should touch the filesystem
// or network. --allowedTools does not reliably block execution in non-interactive `-p` mode,
// so we deny everything explicitly instead.
const DISALLOWED_TOOLS = [
	"Task",
	"Bash",
	"CronCreate",
	"CronDelete",
	"CronList",
	"DesignSync",
	"Edit",
	"EnterWorktree",
	"ExitWorktree",
	"Glob",
	"Grep",
	"Monitor",
	"NotebookEdit",
	"PushNotification",
	"Read",
	"RemoteTrigger",
	"ReportFindings",
	"ScheduleWakeup",
	"SendMessage",
	"ShareOnboardingGuide",
	"Skill",
	"TaskCreate",
	"TaskGet",
	"TaskList",
	"TaskOutput",
	"TaskStop",
	"TaskUpdate",
	"ToolSearch",
	"WebFetch",
	"WebSearch",
	"Workflow",
	"Write",
].join(" ")

const app = new Hono()
app.use("*", cors())

app.get("/health", (c) => c.json({ status: "ok" }))

app.get("/scenarios", (c) => c.json(SCENARIOS))

app.get("/prompts", (c) =>
	c.json({
		withSdk: SDK_SYSTEM_PROMPT,
		withSdkCompact: COMPACT_SYSTEM_PROMPT,
		withoutSdk: WITHOUT_SDK_SYSTEM_PROMPT,
	}),
)

app.post("/recordings", async (c) => {
	const body = (await c.req.json()) as Recording
	const result = saveRecording(RECORDINGS_DIR, body)
	if (result.status === "invalid") {
		return c.json({ error: "Recording name must contain at least one alphanumeric character" }, 400)
	}
	if (result.status === "conflict") {
		return c.json({ error: `A recording named "${result.slug}" already exists` }, 409)
	}
	return c.json({ slug: result.slug })
})

async function streamLlm(
	scenarioPrompt: string,
	systemPrompt: string,
	onChunk: (text: string) => Promise<void>,
): Promise<{ text: string; usage: TokenUsage | null }> {
	const child = spawn(
		"claude",
		[
			"-p",
			scenarioPrompt,
			"--model",
			"claude-opus-4-8",
			"--system-prompt",
			systemPrompt,
			"--safe-mode",
			"--output-format",
			"stream-json",
			"--include-partial-messages",
			"--verbose",
			"--disallowedTools",
			DISALLOWED_TOOLS,
		],
		{ cwd: REPO_ROOT },
	)

	let stderr = ""
	child.stderr.on("data", (data: Buffer) => {
		stderr += data.toString()
	})

	const spawnError = new Promise<never>((_, reject) => {
		child.on("error", (err) => {
			reject(new Error(`claude CLI not found or failed to start: ${err.message}`))
		})
	})

	let accumulated = ""
	let usage: TokenUsage | null = null
	const readLines = async () => {
		const rl = createInterface({ input: child.stdout })
		for await (const line of rl) {
			if (!line.trim()) continue
			let parsed: unknown
			try {
				parsed = JSON.parse(line)
			} catch {
				continue
			}
			const text = extractDeltaText(parsed)
			if (text !== null) {
				accumulated += text
				await onChunk(text)
			}
			const resultUsage = extractResultUsage(parsed)
			if (resultUsage !== null) {
				usage = resultUsage
			}
		}
	}

	await Promise.race([spawnError, readLines()])

	const exitCode = await new Promise<number | null>((resolve) => {
		child.on("close", (code) => resolve(code))
	})

	if (exitCode !== 0) {
		throw new Error(`claude CLI exited with code ${exitCode}${stderr ? `: ${stderr}` : ""}`)
	}

	return { text: accumulated, usage }
}

app.get("/stream/with-sdk", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			usage = result.usage
			await stream.writeSSE({ event: "done", data: "{}" })

			const tsCode = extractTsBlock(result.text)
			if (!tsCode) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: "No TypeScript code block found in LLM output",
						usage,
					}),
				})
				return
			}

			const xml = await executeSdkCode(tsCode, REPO_ROOT)
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml, usage }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message, usage }) })
		}
	})
})

app.get("/stream/with-sdk-compact", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, COMPACT_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			usage = result.usage
			await stream.writeSSE({ event: "done", data: "{}" })

			const dslText = extractCompactBlock(result.text)
			if (!dslText) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: "No compact notation block found in LLM output",
						usage,
					}),
				})
				return
			}

			const xml = executeCompactDsl(dslText)
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml, usage }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message, usage }) })
		}
	})
})

app.get("/stream/without-sdk", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, WITHOUT_SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			usage = result.usage
			await stream.writeSSE({ event: "done", data: "{}" })

			const xml = extractXmlBlock(result.text)
			if (!xml) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "No BPMN XML found in LLM output", usage }),
				})
				return
			}
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml, usage }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message, usage }) })
		}
	})
})

serve({ fetch: app.fetch, port: PORT }, () => {
	console.log(`Demo server running on http://localhost:${PORT}`)
})

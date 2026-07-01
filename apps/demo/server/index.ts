import { join } from "node:path"
import { fileURLToPath } from "node:url"
import Anthropic from "@anthropic-ai/sdk"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { extractTsBlock, extractXmlBlock } from "./extractor.js"
import { executeSdkCode } from "./sdk-executor.js"
import {
	SCENARIO_PROMPT,
	WITHOUT_SDK_SYSTEM_PROMPT,
	buildSdkSystemPrompt,
} from "./system-prompt.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../..")
const PORT = 3001

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
})
const SDK_SYSTEM_PROMPT = buildSdkSystemPrompt(REPO_ROOT)

const app = new Hono()
app.use("*", cors())

async function streamLlm(
	systemPrompt: string,
	onChunk: (text: string) => Promise<void>,
): Promise<string> {
	let accumulated = ""
	const stream = anthropic.messages.stream({
		model: "claude-opus-4-8",
		max_tokens: 8192,
		system: systemPrompt,
		messages: [{ role: "user", content: SCENARIO_PROMPT }],
	})
	for await (const event of stream) {
		if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
			const text = event.delta.text
			accumulated += text
			await onChunk(text)
		}
	}
	return accumulated
}

app.get("/stream/with-sdk", (c) =>
	streamSSE(c, async (stream) => {
		try {
			const accumulated = await streamLlm(SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			await stream.writeSSE({ event: "done", data: "{}" })

			const tsCode = extractTsBlock(accumulated)
			if (!tsCode) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "No TypeScript code block found in LLM output" }),
				})
				return
			}

			const xml = await executeSdkCode(tsCode, REPO_ROOT)
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) })
		}
	}),
)

app.get("/stream/without-sdk", (c) =>
	streamSSE(c, async (stream) => {
		try {
			const accumulated = await streamLlm(WITHOUT_SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			await stream.writeSSE({ event: "done", data: "{}" })

			const xml = extractXmlBlock(accumulated)
			if (!xml) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "No BPMN XML found in LLM output" }),
				})
				return
			}
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) })
		}
	}),
)

serve({ fetch: app.fetch, port: PORT }, () => {
	console.log(`Demo server running on http://localhost:${PORT}`)
})

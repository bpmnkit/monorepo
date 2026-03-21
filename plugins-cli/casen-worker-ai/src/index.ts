import { type CasenPlugin, createWorkerCommand } from "@bpmnkit/cli-sdk"
import { resolveConfig } from "./config.js"
import { classify } from "./operations/classify.js"
import { decide } from "./operations/decide.js"
import { extract } from "./operations/extract.js"
import { summarize } from "./operations/summarize.js"

const plugin: CasenPlugin = {
	id: "com.bpmnkit.casen-worker-ai",
	name: "AI Worker",
	version: "0.1.0",
	groups: [
		{
			name: "ai-worker",
			description: "AI-powered job workers — classify, summarize, extract, decide",
			commands: [
				createWorkerCommand({
					jobType: "com.bpmnkit.ai.classify",
					description: "Classify text into one of the given categories",
					defaultVariables: { category: "unknown", confidence: 0, rationale: "no handler" },
					async processJob(job) {
						return classify(job, resolveConfig())
					},
				}),
				createWorkerCommand({
					jobType: "com.bpmnkit.ai.summarize",
					description: "Summarize text to a given length and style",
					defaultVariables: { summary: "", wordCount: 0 },
					async processJob(job) {
						return summarize(job, resolveConfig())
					},
				}),
				createWorkerCommand({
					jobType: "com.bpmnkit.ai.extract",
					description: "Extract structured fields from unstructured text",
					defaultVariables: { extracted: {}, missingFields: [] },
					async processJob(job) {
						return extract(job, resolveConfig())
					},
				}),
				createWorkerCommand({
					jobType: "com.bpmnkit.ai.decide",
					description: "Make a boolean decision based on a question, context, and optional policy",
					defaultVariables: { decision: false, rationale: "", confidence: 0 },
					async processJob(job) {
						return decide(job, resolveConfig())
					},
				}),
			],
		},
	],
}

export default plugin

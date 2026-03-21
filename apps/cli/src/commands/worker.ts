import type { Command } from "../types.js"

/**
 * A simple job worker that polls for jobs of a given type and auto-completes
 * them with a configurable variables payload. Intended for local development
 * and learning — lets users try out the job-worker concept without writing code.
 *
 * Flow:
 *   1. POST /jobs/activation  — activate up to N jobs (long-polling)
 *   2. POST /jobs/{key}/completion — complete each job with sample variables
 *   3. Repeat until Ctrl+C
 */
export const workerCmd: Command = {
	name: "worker",
	description: "Run a simple job worker that auto-completes jobs of a given type",
	_worker: { jobType: "io.camunda.connector.HttpJson:1" },
	args: [
		{
			name: "type",
			description: "Job type to subscribe to (matches the task definition type in BPMN)",
			required: true,
			default: "io.camunda.connector.HttpJson:1",
		},
	],
	flags: [
		{
			name: "variables",
			short: "v",
			description: "Variables to return when completing each job (JSON object)",
			type: "string",
			placeholder: "JSON",
			default: '{"result":"sample-value"}',
			json: true,
		},
		{
			name: "timeout",
			short: "t",
			description: "Job activation lock timeout in milliseconds",
			type: "number",
			default: 30000,
		},
		{
			name: "max-jobs",
			short: "m",
			description: "Maximum number of jobs to activate per poll",
			type: "number",
			default: 32,
		},
	],
	examples: [
		{
			description: "Subscribe to jobs of type 'payment-service'",
			command: "casen worker payment-service",
		},
		{
			description: "Return custom variables on completion",
			command: 'casen worker payment-service --variables \'{"status":"ok","amount":100}\'',
		},
	],

	async run(ctx) {
		const jobType = ctx.positional[0]
		if (!jobType) throw new Error("Missing required argument: <type>")

		const timeout = (ctx.flags.timeout as number | undefined) ?? 30000
		const maxJobs = (ctx.flags["max-jobs"] as number | undefined) ?? 32

		let variables: Record<string, unknown> = { result: "sample-value" }
		const rawVars = ctx.flags.variables
		if (rawVars && typeof rawVars === "string") {
			try {
				const parsed: unknown = JSON.parse(rawVars)
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					variables = parsed as Record<string, unknown>
				} else {
					throw new Error("--variables must be a JSON object")
				}
			} catch (err) {
				throw new Error(
					`Invalid --variables JSON: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		const client = await ctx.getClient()

		ctx.output.info(`Starting worker for job type "${jobType}"`)
		ctx.output.info(`Completing jobs with: ${JSON.stringify(variables)}`)
		ctx.output.info("Press Ctrl+C to stop\n")

		let running = true
		let completed = 0

		process.once("SIGINT", () => {
			running = false
		})

		while (running) {
			let result: {
				jobs: Array<{
					jobKey: string
					processDefinitionId: string
					elementId: string
					processInstanceKey: string
					variables: Record<string, unknown>
				}>
			}
			try {
				result = (await client.job.activateJobs({
					type: jobType,
					worker: "casen-worker",
					timeout,
					maxJobsToActivate: maxJobs,
					requestTimeout: 20000, // 20 s long poll
				})) as typeof result
			} catch (err) {
				if (!running) break
				// On 503 / backpressure, wait briefly before retrying
				ctx.output.info(
					`Poll error: ${err instanceof Error ? err.message : String(err)} — retrying in 5 s`,
				)
				await delay(5000)
				continue
			}

			const jobs = result?.jobs ?? []

			for (const job of jobs) {
				if (!running) break

				ctx.output.info(
					`Activated job ${job.jobKey}  process=${job.processDefinitionId}  element=${job.elementId}  instance=${job.processInstanceKey}`,
				)

				if (Object.keys(job.variables ?? {}).length > 0) {
					ctx.output.info(`  Input variables: ${JSON.stringify(job.variables)}`)
				}

				try {
					await client.job.completeJob(job.jobKey, { variables })
					completed++
					ctx.output.ok(`Completed job ${job.jobKey} (total: ${completed})`)
				} catch (err) {
					ctx.output.info(
						`Failed to complete job ${job.jobKey}: ${err instanceof Error ? err.message : String(err)}`,
					)
				}
			}

			// When no jobs were returned, the long-poll already waited; loop immediately.
			// When jobs were found, yield the event loop briefly before the next poll.
			if (jobs.length > 0) {
				await delay(100)
			}
		}

		ctx.output.info(`\nWorker stopped. Completed ${completed} job(s).`)
	},
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

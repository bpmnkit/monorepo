/**
 * @bpmnkit/cli-sdk — Plugin authoring SDK for the casen CLI.
 *
 * Install as a devDependency in your plugin:
 * ```
 * pnpm add -D @bpmnkit/cli-sdk
 * ```
 *
 * Then export a default {@link CasenPlugin} object from your entry point:
 * ```typescript
 * import type { CasenPlugin } from "@bpmnkit/cli-sdk"
 *
 * const plugin: CasenPlugin = {
 *   id: "com.example.my-plugin",
 *   name: "My Plugin",
 *   version: "0.1.0",
 *   groups: [myCommandGroup],
 * }
 * export default plugin
 * ```
 *
 * @packageDocumentation
 */

// ── Output ────────────────────────────────────────────────────────────────────

export type OutputFormat = "table" | "json" | "yaml"

/** Column definition for table output. */
export interface ColumnDef {
	/** Dot-path into the row object, e.g. `"processInstanceKey"` */
	key: string
	/** Column header text */
	header: string
	/** Hard truncation to this many chars (0 = no limit) */
	maxWidth?: number
	/** Optional value transformer applied before display */
	transform?: (value: unknown) => string
}

/**
 * The single output seam passed to every command's `run()` function.
 * Use these methods instead of writing to stdout directly so output
 * respects the active `--output` format (table / json / yaml).
 */
export interface OutputWriter {
	readonly format: OutputFormat
	readonly isInteractive: boolean
	/** Render a list result. Automatically unwraps `{ items: [...] }` envelopes. */
	printList(data: unknown, columns: ColumnDef[]): void
	/** Render a single object as labelled key-value pairs. */
	printItem(data: unknown): void
	/** Render raw data in the active format. */
	print(data: unknown): void
	/** Print a success line — `✓ message` */
	ok(msg: string): void
	/** Print an informational line — `→ message` */
	info(msg: string): void
}

// ── Commands ──────────────────────────────────────────────────────────────────

export interface FlagSpec {
	name: string
	short?: string
	description: string
	type: "string" | "boolean" | "number"
	default?: string | boolean | number
	required?: boolean
	/** Display placeholder in help, e.g. `"JSON"` or `"KEY"` */
	placeholder?: string
	/** Restricts to specific values; TUI shows a cycling picker. */
	enum?: string[]
	/** Value is a JSON object; TUI opens a structured key-value editor. */
	json?: boolean
	/** Preset values for number fields; TUI cycles through them with ↑↓. */
	presets?: number[]
}

export interface ArgSpec {
	name: string
	description: string
	required?: boolean
	/** Pre-filled default value shown in the TUI input form. */
	default?: string
	/** Restricts to specific values; TUI shows a cycling picker. */
	enum?: string[]
	/** Value is a JSON object; TUI opens a key-value editor. */
	json?: boolean
}

export interface Example {
	description: string
	command: string
}

export type ParsedFlags = Record<string, string | boolean | number>

/**
 * Context passed to every command's `run()` function.
 *
 * - `positional` — arguments after the group and command tokens
 * - `flags` — parsed flag values keyed by flag name
 * - `output` — rendering interface (respects `--output` format)
 * - `getClient()` — lazily creates a Camunda REST API client from the active profile
 * - `getAdminClient()` — lazily creates a Camunda Admin API client
 */
export interface RunContext {
	positional: string[]
	flags: ParsedFlags
	output: OutputWriter
	/** Returns a Camunda C8 REST client. Cast to `CamundaClient` from `@bpmnkit/api` if needed. */
	getClient(): Promise<unknown>
	/** Returns a Camunda Admin API client. Cast to `AdminApiClient` from `@bpmnkit/api` if needed. */
	getAdminClient(): Promise<unknown>
}

// ── Worker commands ────────────────────────────────────────────────────────────

/** Shape of a job as received from the Camunda job activation API. */
export interface WorkerJob {
	jobKey: string
	processDefinitionId: string
	elementId: string
	processInstanceKey: string
	/** Variables attached to the job by the process instance. */
	variables: Record<string, unknown>
}

/**
 * The result returned by {@link WorkerConfig.processJob}.
 *
 * - `complete` — complete the job with the given variables (default path)
 * - `fail` — fail the job so Camunda retries it after `retryBackOff` ms;
 *   use for transient errors (rate limits, network timeouts)
 * - `error` — throw a BPMN error so an error boundary event can catch it;
 *   use for business-logic failures (invalid input, unrecoverable state)
 */
export type WorkerJobResult =
	| { outcome: "complete"; variables: Record<string, unknown> }
	| { outcome: "fail"; errorMessage: string; retries?: number; retryBackOff?: number }
	| {
			outcome: "error"
			errorCode: string
			errorMessage?: string
			variables?: Record<string, unknown>
	  }

/**
 * Configuration for a worker command created with {@link createWorkerCommand}.
 */
export interface WorkerConfig {
	/** Job type to subscribe to — must match the task definition type in BPMN. */
	jobType: string
	/** Short description shown in the TUI menu. Defaults to the job type. */
	description?: string
	/** Variables used to complete each job when no {@link processJob} is provided. */
	defaultVariables?: Record<string, unknown>
	/**
	 * Called for each activated job. Return a {@link WorkerJobResult} describing
	 * how to complete, fail, or error the job.
	 * When omitted, jobs are completed with {@link defaultVariables}.
	 * Called in both TUI live-worker mode and CLI foreground mode.
	 */
	processJob?: (job: WorkerJob) => Promise<WorkerJobResult>
}

/** A single executable command within a group. */
export interface Command {
	name: string
	aliases?: string[]
	description: string
	args?: ArgSpec[]
	flags?: FlagSpec[]
	examples?: Example[]
	/**
	 * If set, the TUI routes this command through the live worker view instead of
	 * the standard input → results flow. Set automatically by {@link createWorkerCommand}.
	 */
	_worker?: WorkerConfig
	run(ctx: RunContext): Promise<void>
}

/**
 * A group of related commands — maps to one top-level `casen <group>` token.
 * The `name` must be unique across all installed plugins and the core CLI.
 */
export interface CommandGroup {
	/** kebab-case name, e.g. `"my-integration"` */
	name: string
	aliases?: string[]
	description: string
	commands: Command[]
}

// ── Plugin contract ───────────────────────────────────────────────────────────

/**
 * The contract every casen plugin must fulfill.
 *
 * Export an object conforming to this interface as the **default export**
 * from your plugin's compiled entry point (`dist/index.js`).
 *
 * @example
 * ```typescript
 * import type { CasenPlugin } from "@bpmnkit/cli-sdk"
 *
 * const plugin: CasenPlugin = {
 *   id: "com.acme.casen-deploy",
 *   name: "Deploy",
 *   version: "1.0.0",
 *   groups: [deployGroup],
 * }
 * export default plugin
 * ```
 */
export interface CasenPlugin {
	/** Unique reverse-domain identifier, e.g. `"com.acme.casen-deploy"` */
	id: string
	/** Human-readable name shown in `casen plugin list` */
	name: string
	version: string
	/** One or more top-level command groups added to the CLI */
	groups: CommandGroup[]
}

// ── Worker factory ────────────────────────────────────────────────────────────

function workerDelay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a pre-configured job worker command.
 *
 * The produced command pre-fills the `type` argument with `config.jobType`
 * and exposes `--variables`, `--timeout`, and `--max-jobs` flags.
 *
 * - **TUI**: the live worker view is used automatically (the `_worker` marker
 *   tells the TUI to route through `launchWorkerView`).
 * - **CLI** (`casen <group> <type>`): the polling loop runs in the foreground
 *   until Ctrl+C, calling `config.processJob` for each activated job.
 *
 * @example
 * ```typescript
 * import { createWorkerCommand } from "@bpmnkit/cli-sdk"
 *
 * export default {
 *   id: "com.example.my-worker",
 *   name: "My Worker",
 *   version: "1.0.0",
 *   groups: [{
 *     name: "my-worker",
 *     description: "Process my-job jobs",
 *     commands: [createWorkerCommand({
 *       jobType: "my-job",
 *       defaultVariables: { result: "ok" },
 *       async processJob(job) {
 *         return { result: "processed", input: job.variables }
 *       },
 *     })],
 *   }],
 * }
 * ```
 */
export function createWorkerCommand(config: WorkerConfig): Command {
	const defaultVars: Record<string, unknown> = config.defaultVariables ?? {
		result: "sample-value",
	}

	return {
		name: "start",
		description: config.description ?? `Run a worker for "${config.jobType}" jobs`,
		_worker: config,
		args: [
			{
				name: "type",
				description: "Job type to subscribe to (matches the task definition type in BPMN)",
				required: true,
				default: config.jobType,
			},
		],
		flags: [
			{
				name: "variables",
				short: "v",
				description: "Variables to complete each job with when no processJob handler is set (JSON)",
				type: "string",
				placeholder: "JSON",
				default: JSON.stringify(defaultVars),
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

		async run(ctx: RunContext): Promise<void> {
			const jobType = ctx.positional[0] ?? config.jobType
			const timeout = (ctx.flags.timeout as number | undefined) ?? 30000
			const maxJobs = (ctx.flags["max-jobs"] as number | undefined) ?? 32

			let completionVars: Record<string, unknown> = defaultVars
			const rawVars = ctx.flags.variables
			if (rawVars && typeof rawVars === "string") {
				try {
					const parsed: unknown = JSON.parse(rawVars)
					if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
						completionVars = parsed as Record<string, unknown>
					}
				} catch {
					// ignore — use defaults
				}
			}

			// Duck-typed client access — actual shape is CamundaClient from @bpmnkit/api
			type JobClient = {
				job: {
					activateJobs(p: {
						type: string
						worker: string
						timeout: number
						maxJobsToActivate: number
						requestTimeout: number
					}): Promise<{ jobs: WorkerJob[] }>
					completeJob(key: string, p: { variables: Record<string, unknown> }): Promise<void>
					failJob(
						key: string,
						p: { retries?: number; retryBackOff?: number; errorMessage?: string },
					): Promise<void>
					throwJobError(
						key: string,
						p: {
							errorCode: string
							errorMessage?: string
							variables?: Record<string, unknown>
						},
					): Promise<void>
				}
			}
			const client = (await ctx.getClient()) as JobClient

			ctx.output.info(`Starting worker for job type "${jobType}"`)
			ctx.output.info(`Completing jobs with: ${JSON.stringify(completionVars)}`)
			ctx.output.info("Press Ctrl+C to stop\n")

			let running = true
			let completed = 0
			process.once("SIGINT", () => {
				running = false
			})

			while (running) {
				let jobs: WorkerJob[]
				try {
					const result = await client.job.activateJobs({
						type: jobType,
						worker: "casen-worker",
						timeout,
						maxJobsToActivate: maxJobs,
						requestTimeout: 20000,
					})
					jobs = result.jobs ?? []
				} catch (err) {
					if (!running) break
					ctx.output.info(
						`Poll error: ${err instanceof Error ? err.message : String(err)} — retrying in 5s`,
					)
					await workerDelay(5000)
					continue
				}

				for (const job of jobs) {
					if (!running) break
					ctx.output.info(
						`Activated ${job.jobKey}  process=${job.processDefinitionId}  element=${job.elementId}`,
					)
					let result: WorkerJobResult = { outcome: "complete", variables: completionVars }
					if (config.processJob) {
						try {
							result = await config.processJob(job)
						} catch (err) {
							ctx.output.info(
								`Handler error: ${err instanceof Error ? err.message : String(err)} — completing with defaults`,
							)
						}
					}
					try {
						if (result.outcome === "complete") {
							await client.job.completeJob(job.jobKey, { variables: result.variables })
							completed++
							ctx.output.ok(`Completed ${job.jobKey} (total: ${completed})`)
						} else if (result.outcome === "fail") {
							await client.job.failJob(job.jobKey, {
								errorMessage: result.errorMessage,
								retries: result.retries,
								retryBackOff: result.retryBackOff,
							})
							ctx.output.info(`Failed ${job.jobKey}: ${result.errorMessage}`)
						} else {
							await client.job.throwJobError(job.jobKey, {
								errorCode: result.errorCode,
								errorMessage: result.errorMessage,
								variables: result.variables,
							})
							ctx.output.info(
								`Error ${job.jobKey} [${result.errorCode}]: ${result.errorMessage ?? ""}`,
							)
						}
					} catch (err) {
						ctx.output.info(
							`Failed to settle ${job.jobKey}: ${err instanceof Error ? err.message : String(err)}`,
						)
					}
				}
				if (jobs.length > 0) await workerDelay(100)
			}

			ctx.output.info(`\nWorker stopped. Completed ${completed} job(s).`)
		},
	}
}

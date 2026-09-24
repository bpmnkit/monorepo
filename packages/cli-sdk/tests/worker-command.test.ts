import { afterEach, describe, expect, it, vi } from "vitest"
import {
	type OutputWriter,
	type RunContext,
	type WorkerJob,
	type WorkerJobResult,
	createWorkerCommand,
} from "../src/index.js"

const job = (jobKey: string, variables: Record<string, unknown> = {}): WorkerJob => ({
	jobKey,
	processDefinitionId: "order-process",
	elementId: "Ship",
	processInstanceKey: "100",
	variables,
})

type Batch = WorkerJob[] | Error

/**
 * A fake Camunda client whose activateJobs serves `batches` in turn, then
 * stops the worker the way Ctrl+C does and returns no jobs.
 */
function harness(batches: Batch[], flags: RunContext["flags"] = {}, positional: string[] = []) {
	let sigint: (() => void) | undefined
	vi.spyOn(process, "once").mockImplementation(((event: string, fn: () => void) => {
		if (event === "SIGINT") sigint = fn
		return process
	}) as typeof process.once)

	const activations: unknown[] = []
	const client = {
		job: {
			activateJobs: vi.fn(async (p: unknown) => {
				activations.push(p)
				const next = batches.shift()
				if (!next) {
					sigint?.()
					return { jobs: [] }
				}
				if (next instanceof Error) throw next
				return { jobs: next }
			}),
			completeJob: vi.fn(async (_key: string, _p: unknown) => {}),
			failJob: vi.fn(async (_key: string, _p: unknown) => {}),
			throwJobError: vi.fn(async (_key: string, _p: unknown) => {}),
		},
	}

	const lines: string[] = []
	const output: OutputWriter = {
		format: "table",
		isInteractive: false,
		printList: vi.fn(),
		printItem: vi.fn(),
		print: vi.fn(),
		ok: (msg) => lines.push(`ok ${msg}`),
		info: (msg) => lines.push(`info ${msg}`),
	}
	const ctx: RunContext = {
		positional,
		flags,
		output,
		getClient: async () => client,
		getAdminClient: async () => {
			throw new Error("a worker never needs the admin client")
		},
	}
	return { ctx, client, activations, lines }
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.useRealTimers()
})

describe("createWorkerCommand — the command it produces", () => {
	it("is a `start` command marked for the TUI's live worker view", () => {
		const config = { jobType: "ship-order" }
		const cmd = createWorkerCommand(config)
		expect(cmd.name).toBe("start")
		expect(cmd.description).toBe('Run a worker for "ship-order" jobs')
		expect(cmd._worker).toBe(config)
		expect(createWorkerCommand({ jobType: "x", description: "Ships" }).description).toBe("Ships")
	})

	it("pre-fills the type argument with the job type", () => {
		expect(createWorkerCommand({ jobType: "ship-order" }).args).toEqual([
			{
				name: "type",
				description: "Job type to subscribe to (matches the task definition type in BPMN)",
				required: true,
				default: "ship-order",
			},
		])
	})

	it("exposes --variables, --timeout and --max-jobs with their defaults", () => {
		const flags = createWorkerCommand({ jobType: "t" }).flags ?? []
		expect(flags.map((f) => [f.name, f.short, f.type, f.default])).toEqual([
			["variables", "v", "string", '{"result":"sample-value"}'],
			["timeout", "t", "number", 30000],
			["max-jobs", "m", "number", 32],
		])
		expect(flags[0]?.json).toBe(true)
	})

	it("defaults --variables to defaultVariables", () => {
		const flags = createWorkerCommand({ jobType: "t", defaultVariables: { shipped: true } }).flags
		expect(flags?.[0]?.default).toBe('{"shipped":true}')
	})
})

describe("createWorkerCommand — the worker loop", () => {
	it("activates jobs with the flags and completes them with the default variables", async () => {
		const h = harness([[job("1"), job("2")]], { timeout: 5000, "max-jobs": 2 }, ["other-type"])
		await createWorkerCommand({ jobType: "ship-order", defaultVariables: { ok: 1 } }).run(h.ctx)
		expect(h.activations[0]).toEqual({
			type: "other-type",
			worker: "casen-worker",
			timeout: 5000,
			maxJobsToActivate: 2,
			requestTimeout: 20000,
		})
		expect(h.client.job.completeJob.mock.calls).toEqual([
			["1", { variables: { ok: 1 } }],
			["2", { variables: { ok: 1 } }],
		])
		expect(h.lines).toContain("ok Completed 2 (total: 2)")
		expect(h.lines.at(-1)).toBe("info \nWorker stopped. Completed 2 job(s).")
	})

	it("falls back to the configured job type and the flag defaults", async () => {
		const h = harness([])
		await createWorkerCommand({ jobType: "ship-order" }).run(h.ctx)
		expect(h.activations[0]).toMatchObject({
			type: "ship-order",
			timeout: 30000,
			maxJobsToActivate: 32,
		})
	})

	it("completes with the --variables JSON object", async () => {
		const h = harness([[job("1")]], { variables: '{"from":"flag"}' })
		await createWorkerCommand({ jobType: "t" }).run(h.ctx)
		expect(h.client.job.completeJob).toHaveBeenCalledWith("1", { variables: { from: "flag" } })
	})

	it("ignores --variables that are not a JSON object", async () => {
		for (const variables of ["not json", "[1,2]", "null", '"text"']) {
			const h = harness([[job("1")]], { variables })
			await createWorkerCommand({ jobType: "t", defaultVariables: { d: 1 } }).run(h.ctx)
			expect(h.client.job.completeJob, variables).toHaveBeenCalledWith("1", {
				variables: { d: 1 },
			})
			vi.restoreAllMocks()
		}
	})

	it("routes each processJob outcome to the matching job call", async () => {
		const results: Record<string, WorkerJobResult> = {
			a: { outcome: "complete", variables: { tracking: "T1" } },
			b: { outcome: "fail", errorMessage: "carrier down", retries: 2, retryBackOff: 1000 },
			c: { outcome: "error", errorCode: "NO_STOCK", errorMessage: "none", variables: { n: 0 } },
		}
		const seen: WorkerJob[] = []
		const h = harness([[job("a", { id: 1 }), job("b"), job("c")]])
		await createWorkerCommand({
			jobType: "t",
			async processJob(j) {
				seen.push(j)
				return results[j.jobKey] as WorkerJobResult
			},
		}).run(h.ctx)
		expect(seen[0]?.variables).toEqual({ id: 1 })
		expect(h.client.job.completeJob.mock.calls).toEqual([["a", { variables: { tracking: "T1" } }]])
		expect(h.client.job.failJob.mock.calls).toEqual([
			["b", { errorMessage: "carrier down", retries: 2, retryBackOff: 1000 }],
		])
		expect(h.client.job.throwJobError.mock.calls).toEqual([
			["c", { errorCode: "NO_STOCK", errorMessage: "none", variables: { n: 0 } }],
		])
		expect(h.lines).toContain("info Failed b: carrier down")
		expect(h.lines).toContain("info Error c [NO_STOCK]: none")
		expect(h.lines.at(-1)).toBe("info \nWorker stopped. Completed 1 job(s).")
	})

	// Current behaviour, shared with the TUI's live worker view: a throwing
	// handler does not fail the job, it completes it with the default variables.
	it("completes with the defaults when processJob throws", async () => {
		const h = harness([[job("1")]])
		await createWorkerCommand({
			jobType: "t",
			defaultVariables: { d: 1 },
			async processJob() {
				throw new Error("boom")
			},
		}).run(h.ctx)
		expect(h.lines).toContain("info Handler error: boom — completing with defaults")
		expect(h.client.job.completeJob).toHaveBeenCalledWith("1", { variables: { d: 1 } })
	})

	it("reports a job that cannot be settled and carries on", async () => {
		const h = harness([[job("1"), job("2")]])
		h.client.job.completeJob.mockRejectedValueOnce(new Error("404 job not found"))
		await createWorkerCommand({ jobType: "t" }).run(h.ctx)
		expect(h.lines).toContain("info Failed to settle 1: 404 job not found")
		expect(h.lines).toContain("ok Completed 2 (total: 1)")
	})

	it("retries a failed poll after 5 seconds", async () => {
		vi.useFakeTimers()
		const h = harness([new Error("ECONNREFUSED"), [job("1")]])
		const done = createWorkerCommand({ jobType: "t" }).run(h.ctx)
		await vi.advanceTimersByTimeAsync(4_999)
		expect(h.client.job.activateJobs).toHaveBeenCalledTimes(1)
		expect(h.lines).toContain("info Poll error: ECONNREFUSED — retrying in 5s")
		await vi.advanceTimersByTimeAsync(1_000)
		await done
		expect(h.client.job.completeJob).toHaveBeenCalledWith("1", expect.anything())
	})

	it("stops polling on SIGINT", async () => {
		const h = harness([])
		await createWorkerCommand({ jobType: "t" }).run(h.ctx)
		expect(h.client.job.activateJobs).toHaveBeenCalledTimes(1)
		expect(h.lines.at(-1)).toBe("info \nWorker stopped. Completed 0 job(s).")
	})
})

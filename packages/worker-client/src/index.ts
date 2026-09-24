/**
 * @bpmnkit/worker-client — Thin Zeebe REST client for standalone workers.
 *
 * Reads from environment (all optional):
 *   ZEEBE_ADDRESS        — REST base URL (default: http://localhost:26500)
 *   ZEEBE_CLIENT_ID      — OAuth2 client ID (Camunda SaaS)
 *   ZEEBE_CLIENT_SECRET  — OAuth2 client secret (Camunda SaaS)
 *   ZEEBE_TOKEN_URL      — OAuth2 token URL (default: https://login.cloud.camunda.io/oauth/token)
 *   ZEEBE_TOKEN_AUDIENCE — OAuth2 audience (default: zeebe.camunda.io)
 */

export interface WorkerClientOptions {
	/** Zeebe/reebe REST base URL. Defaults to ZEEBE_ADDRESS env var or http://localhost:26500 */
	address?: string
	/** OAuth2 client ID for Camunda SaaS. Defaults to ZEEBE_CLIENT_ID env var. */
	clientId?: string
	/** OAuth2 client secret for Camunda SaaS. Defaults to ZEEBE_CLIENT_SECRET env var. */
	clientSecret?: string
	/** OAuth2 token URL. Defaults to ZEEBE_TOKEN_URL or Camunda SaaS endpoint. */
	tokenUrl?: string
	/** OAuth2 audience. Defaults to ZEEBE_TOKEN_AUDIENCE or "zeebe.camunda.io". */
	audience?: string
	/** Worker name sent during job activation. Defaults to "bpmnkit-worker". */
	workerName?: string
}

/**
 * What a worker for one job type can rely on — the shape `casen gen types`
 * emits for each entry of its `JobTypes` map.
 */
export interface JobContract {
	variables: object
	output: object
	headers: object
	errors: string
}

/** The contract of a job type when no `JobTypes` map is given. */
export interface UntypedJobContract {
	variables: Record<string, unknown>
	output: Record<string, unknown>
	headers: Record<string, string>
	errors: string
}

/** A map from job type to its contract, e.g. the `JobTypes` that `casen gen types` generates. */
export type JobContractMap<J> = { [K in keyof J]: JobContract }

type UntypedJobs = Record<string, UntypedJobContract>

export interface ActivatedJob<C extends JobContract = UntypedJobContract> {
	/** Unique job key. */
	key: string
	/** Job type as defined in the BPMN task definition. */
	jobType: string
	processInstanceKey: string
	bpmnProcessId: string
	elementId: string
	/** Remaining retries. Decrement when calling fail(). */
	retries: number
	/** Process variables passed to this job. */
	variables: C["variables"]
	/** Task headers (`zeebe:taskHeaders`) of the element the job was created for. */
	customHeaders: C["headers"]
	/** Complete the job, optionally returning output variables. */
	complete(variables?: C["output"]): Promise<void>
	/**
	 * Fail the job with an error message. `retries` is how many retries the job has
	 * left afterwards; it defaults to `job.retries - 1` (never below 0), so the engine
	 * retries until the task's retries run out and then raises an incident. Pass `0`
	 * to raise the incident at once.
	 */
	fail(message: string, retries?: number): Promise<void>
	/** Throw a BPMN error, which can be caught by an error boundary event. */
	throwError(
		errorCode: C["errors"],
		message: string,
		variables?: Record<string, unknown>,
	): Promise<void>
}

export interface PollOptions {
	/** Maximum jobs to activate per poll request. Default: 5 */
	maxJobs?: number
	/** Job activation lock timeout in milliseconds. Default: 300_000 (5 minutes) */
	timeout?: number
	/**
	 * How long the engine may hold an activation request open waiting for a job
	 * (long polling), in milliseconds. Default: 20_000. `0` uses the engine's default.
	 */
	requestTimeout?: number
	/**
	 * Called with each transient error (network failure, 408, 429, 5xx, or a token
	 * endpoint that is unreachable or failing) before the poll is retried. Default:
	 * a warning on stderr. Other errors — bad credentials, 4xx responses — are not
	 * retried: they end the `poll()` loop by throwing.
	 */
	onError?: (error: Error) => void
}

/** A failure that retrying cannot fix, such as rejected credentials. */
class NonRetryableError extends Error {}

/** Whether an HTTP status is worth retrying: timeouts, back-pressure and server errors. */
function isTransientStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500
}

/** Minimum pause between two activation requests that returned no jobs. */
const IDLE_POLL_MS = 5_000

/**
 * Pass a generated `JobTypes` map as `J` to type each job's variables, output,
 * headers and error codes by its job type:
 *
 * @example
 * import type { JobTypes } from "./generated/bpmn-types.js"
 * const client = createWorkerClient<JobTypes>()
 * for await (const job of client.poll("ship-order")) {
 *   job.variables.orderId // typed; a misspelt key is a compile error
 * }
 */
export interface WorkerClient<J extends JobContractMap<J> = UntypedJobs> {
	/**
	 * Async generator that continuously polls for jobs of the given type.
	 * Yields one ActivatedJob at a time. Activation long-polls (`requestTimeout`);
	 * an empty answer is followed by a pause, so two polls start at least 5 seconds
	 * apart when idle. Transient errors are reported to `onError` and retried; an
	 * error retrying cannot fix (rejected credentials, a 4xx answer) is thrown.
	 *
	 * @example
	 * for await (const job of client.poll("com.example:my-task:1")) {
	 *   const result = await doWork(job.variables)
	 *   await job.complete(result)
	 * }
	 */
	poll<T extends keyof J & string>(
		jobType: T,
		options?: PollOptions,
	): AsyncGenerator<ActivatedJob<J[T]>>
}

export function createWorkerClient<J extends JobContractMap<J> = UntypedJobs>(
	options?: WorkerClientOptions,
): WorkerClient<J> {
	const address = (
		options?.address ??
		process.env.ZEEBE_ADDRESS ??
		"http://localhost:26500"
	).replace(/\/$/, "")
	const clientId = options?.clientId ?? process.env.ZEEBE_CLIENT_ID
	const clientSecret = options?.clientSecret ?? process.env.ZEEBE_CLIENT_SECRET
	const tokenUrl =
		options?.tokenUrl ?? process.env.ZEEBE_TOKEN_URL ?? "https://login.cloud.camunda.io/oauth/token"
	const audience = options?.audience ?? process.env.ZEEBE_TOKEN_AUDIENCE ?? "zeebe.camunda.io"
	const workerName = options?.workerName ?? "bpmnkit-worker"

	let tokenCache: { token: string; expiresAt: number } | undefined

	async function getAuthHeader(): Promise<string | undefined> {
		if (!clientId || !clientSecret) return undefined
		if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
			return `Bearer ${tokenCache.token}`
		}
		const res = await fetch(tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_id: clientId,
				client_secret: clientSecret,
				audience,
			}).toString(),
		})
		if (!res.ok) {
			const message = `OAuth2 token request failed: ${res.status}`
			throw isTransientStatus(res.status) ? new Error(message) : new NonRetryableError(message)
		}
		const data = (await res.json()) as { access_token: string; expires_in: number }
		tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1_000 }
		return `Bearer ${tokenCache.token}`
	}

	async function zeebePost(path: string, body: unknown): Promise<Response> {
		const auth = await getAuthHeader()
		const headers: Record<string, string> = { "Content-Type": "application/json" }
		if (auth) headers.authorization = auth
		return fetch(`${address}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		})
	}

	/** Settles a job; a refused call rejects rather than passing for success. */
	async function settle(key: string, action: string, body: unknown): Promise<void> {
		const res = await zeebePost(`/v2/jobs/${key}/${action}`, body)
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(
				`Job ${key} ${action} failed: ${res.status} ${res.statusText}${text ? ` ${text}` : ""}`,
			)
		}
	}

	async function* poll<T extends keyof J & string>(
		jobType: T,
		pollOptions?: PollOptions,
	): AsyncGenerator<ActivatedJob<J[T]>> {
		const maxJobs = pollOptions?.maxJobs ?? 5
		const timeout = pollOptions?.timeout ?? 300_000
		const requestTimeout = pollOptions?.requestTimeout ?? 20_000
		const onError =
			pollOptions?.onError ??
			((error: Error) => {
				console.warn(`[worker-client] ${error.message}; retrying`)
			})

		for (;;) {
			const startedAt = Date.now()
			let rawJobs: Array<Record<string, unknown>> = []
			try {
				const res = await zeebePost("/v2/jobs/activation", {
					type: jobType,
					maxJobsToActivate: maxJobs,
					timeout,
					worker: workerName,
					requestTimeout,
				})
				if (res.ok) {
					const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> }
					rawJobs = data.jobs ?? []
				} else {
					const text = await res.text().catch(() => "")
					const message = `Job activation for "${jobType}" failed: ${res.status} ${res.statusText}${text ? ` ${text}` : ""}`
					if (!isTransientStatus(res.status)) throw new NonRetryableError(message)
					onError(new Error(message))
				}
			} catch (err) {
				if (err instanceof NonRetryableError) throw err
				onError(err instanceof Error ? err : new Error(String(err)))
			}

			for (const raw of rawJobs) {
				const key = String(raw.key ?? raw.jobKey ?? "")
				const job: ActivatedJob = {
					key,
					jobType: String(raw.type ?? jobType),
					processInstanceKey: String(raw.processInstanceKey ?? ""),
					bpmnProcessId: String(raw.bpmnProcessId ?? raw.processDefinitionId ?? ""),
					elementId: String(raw.elementId ?? ""),
					retries: Number(raw.retries ?? 0),
					variables: (raw.variables as Record<string, unknown>) ?? {},
					customHeaders: (raw.customHeaders as Record<string, string>) ?? {},
					async complete(variables = {}) {
						await settle(key, "completion", { variables })
					},
					async fail(message, retries = Math.max(Number(raw.retries ?? 0) - 1, 0)) {
						await settle(key, "failure", { errorMessage: message, retries })
					},
					async throwError(errorCode, message, variables = {}) {
						await settle(key, "error", { errorCode, errorMessage: message, variables })
					},
				}
				// The contract is a compile-time promise the BPMN makes; the wire data is untyped.
				yield job as unknown as ActivatedJob<J[T]>
			}

			if (rawJobs.length === 0) {
				// A long poll that already waited its time needs no extra pause.
				const pause = IDLE_POLL_MS - (Date.now() - startedAt)
				if (pause > 0) await new Promise((r) => setTimeout(r, pause))
			}
		}
	}

	return { poll }
}

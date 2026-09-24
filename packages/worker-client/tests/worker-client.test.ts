import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type ActivatedJob, createWorkerClient } from "../src/index.js"

interface Call {
	url: string
	headers: Record<string, string>
	body: string
}

type Reply = Response | Error
type Handler = (call: Call) => Reply

/** Stubs fetch with a router; each call is recorded. */
function stubFetch(handler: Handler): Call[] {
	const calls: Call[] = []
	vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
		const call = {
			url,
			headers: init.headers as Record<string, string>,
			body: String(init.body),
		}
		calls.push(call)
		const reply = handler(call)
		if (reply instanceof Error) throw reply
		return reply
	})
	return calls
}

const jobsReply = (jobs: unknown[]) => Response.json({ jobs })
const ok = () => new Response(null, { status: 204 })

/** Activation returns `jobs` once, then nothing; every other call succeeds. */
function zeebeWith(jobs: unknown[], settle: Handler = ok): Call[] {
	let served = false
	return stubFetch((call) => {
		if (call.url.endsWith("/v2/jobs/activation")) {
			if (served) return jobsReply([])
			served = true
			return jobsReply(jobs)
		}
		return settle(call)
	})
}

async function take<T>(jobs: AsyncGenerator<T>, n: number): Promise<T[]> {
	const out: T[] = []
	if (n === 0) return out
	for await (const job of jobs) {
		out.push(job)
		if (out.length === n) break
	}
	return out
}

const rawJob = (over: Record<string, unknown> = {}) => ({
	jobKey: "2251799813685249",
	type: "send-email",
	processInstanceKey: "2251799813685001",
	processDefinitionId: "order-process",
	elementId: "SendEmail",
	retries: 3,
	variables: { to: "a@b.c" },
	customHeaders: { template: "welcome" },
	...over,
})

const ENV = [
	"ZEEBE_ADDRESS",
	"ZEEBE_CLIENT_ID",
	"ZEEBE_CLIENT_SECRET",
	"ZEEBE_TOKEN_URL",
	"ZEEBE_TOKEN_AUDIENCE",
] as const
let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
	savedEnv = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
	for (const k of ENV) delete process.env[k]
})

afterEach(() => {
	for (const k of ENV) {
		const v = savedEnv[k]
		if (v === undefined) delete process.env[k]
		else process.env[k] = v
	}
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe("job activation", () => {
	it("posts an activation request with the defaults", async () => {
		const calls = zeebeWith([rawJob()])
		await take(createWorkerClient().poll("send-email"), 1)
		expect(calls[0]?.url).toBe("http://localhost:26500/v2/jobs/activation")
		expect(calls[0]?.headers).toEqual({ "Content-Type": "application/json" })
		expect(JSON.parse(calls[0]?.body ?? "")).toEqual({
			type: "send-email",
			maxJobsToActivate: 5,
			timeout: 300_000,
			worker: "bpmnkit-worker",
		})
	})

	it("takes address, worker name and poll options from the caller", async () => {
		const calls = zeebeWith([rawJob()])
		const client = createWorkerClient({ address: "http://zeebe:8080/", workerName: "mailer" })
		await take(client.poll("send-email", { maxJobs: 1, timeout: 10_000 }), 1)
		expect(calls[0]?.url).toBe("http://zeebe:8080/v2/jobs/activation")
		expect(JSON.parse(calls[0]?.body ?? "")).toMatchObject({
			maxJobsToActivate: 1,
			timeout: 10_000,
			worker: "mailer",
		})
	})

	it("reads the address from ZEEBE_ADDRESS", async () => {
		process.env.ZEEBE_ADDRESS = "http://from-env:26500"
		const calls = zeebeWith([rawJob()])
		await take(createWorkerClient().poll("send-email"), 1)
		expect(calls[0]?.url).toBe("http://from-env:26500/v2/jobs/activation")
	})

	it("maps an activated job", async () => {
		zeebeWith([rawJob()])
		const [job] = await take(createWorkerClient().poll("send-email"), 1)
		expect(job).toMatchObject({
			key: "2251799813685249",
			jobType: "send-email",
			processInstanceKey: "2251799813685001",
			bpmnProcessId: "order-process",
			elementId: "SendEmail",
			retries: 3,
			variables: { to: "a@b.c" },
			customHeaders: { template: "welcome" },
		})
	})

	it("accepts the older key / bpmnProcessId field names and fills missing fields", async () => {
		zeebeWith([{ key: 7, bpmnProcessId: "p" }])
		const [job] = await take(createWorkerClient().poll("t"), 1)
		expect(job).toMatchObject({
			key: "7",
			jobType: "t",
			bpmnProcessId: "p",
			processInstanceKey: "",
			elementId: "",
			retries: 0,
			variables: {},
			customHeaders: {},
		})
	})

	it("yields every job of a batch in order, then polls again", async () => {
		let polls = 0
		stubFetch(() => {
			polls++
			return jobsReply([rawJob({ jobKey: `${polls}-a` }), rawJob({ jobKey: `${polls}-b` })])
		})
		const jobs = await take(createWorkerClient().poll("send-email"), 3)
		expect(jobs.map((j) => j.key)).toEqual(["1-a", "1-b", "2-a"])
	})
})

describe("idle and failing polls", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	/** Runs the generator to its first job, advancing fake time as it waits. */
	async function firstJobAfter(gen: AsyncGenerator<ActivatedJob>, ms: number) {
		const next = gen.next()
		await vi.advanceTimersByTimeAsync(ms)
		return next
	}

	it("waits 5 seconds after a poll that returned no jobs", async () => {
		let polls = 0
		const calls = stubFetch(() => (++polls === 1 ? jobsReply([]) : jobsReply([rawJob()])))
		const gen = createWorkerClient().poll("send-email")
		const next = gen.next()
		await vi.advanceTimersByTimeAsync(4_999)
		expect(calls).toHaveLength(1)
		await vi.advanceTimersByTimeAsync(1)
		expect((await next).value?.key).toBe("2251799813685249")
		expect(calls).toHaveLength(2)
	})

	it("retries after a network error", async () => {
		let polls = 0
		stubFetch(() => (++polls === 1 ? new TypeError("fetch failed") : jobsReply([rawJob()])))
		const result = await firstJobAfter(createWorkerClient().poll("send-email"), 5_000)
		expect(result.value?.key).toBe("2251799813685249")
	})

	it("retries after an error response", async () => {
		let polls = 0
		stubFetch(() => (++polls === 1 ? new Response("busy", { status: 503 }) : jobsReply([rawJob()])))
		const result = await firstJobAfter(createWorkerClient().poll("send-email"), 5_000)
		expect(result.value?.key).toBe("2251799813685249")
	})
})

describe("settling a job", () => {
	async function activate(settle: Handler = ok) {
		const calls = zeebeWith([rawJob()], settle)
		const [job] = await take(createWorkerClient({ address: "http://z" }).poll("send-email"), 1)
		if (!job) throw new Error("no job")
		const settled = () => calls.slice(1).map((c) => ({ url: c.url, body: JSON.parse(c.body) }))
		return { job, settled }
	}

	it("completes with output variables, or none", async () => {
		const { job, settled } = await activate()
		await job.complete({ sent: true })
		await job.complete()
		expect(settled()).toEqual([
			{ url: "http://z/v2/jobs/2251799813685249/completion", body: { variables: { sent: true } } },
			{ url: "http://z/v2/jobs/2251799813685249/completion", body: { variables: {} } },
		])
	})

	it("fails with an explicit retry count", async () => {
		const { job, settled } = await activate()
		await job.fail("SMTP down", 5)
		expect(settled()).toEqual([
			{
				url: "http://z/v2/jobs/2251799813685249/failure",
				body: { errorMessage: "SMTP down", retries: 5 },
			},
		])
	})

	// As documented on the package page; the default raises an incident at once.
	it("fails with 0 retries by default", async () => {
		const { job, settled } = await activate()
		await job.fail("SMTP down")
		expect(settled()[0]?.body).toEqual({ errorMessage: "SMTP down", retries: 0 })
	})

	it("throws a BPMN error with a message and optional variables", async () => {
		const { job, settled } = await activate()
		await job.throwError("INVALID_ADDRESS", "no such mailbox", { bounced: true })
		await job.throwError("INVALID_ADDRESS", "again")
		expect(settled()).toEqual([
			{
				url: "http://z/v2/jobs/2251799813685249/error",
				body: {
					errorCode: "INVALID_ADDRESS",
					errorMessage: "no such mailbox",
					variables: { bounced: true },
				},
			},
			{
				url: "http://z/v2/jobs/2251799813685249/error",
				body: { errorCode: "INVALID_ADDRESS", errorMessage: "again", variables: {} },
			},
		])
	})

	// Regression: complete, fail and throwError ignored the response status, so a
	// rejected call (job already timed out, 401, 404) resolved as if it had worked.
	it("rejects when the engine refuses the call", async () => {
		const { job } = await activate(
			() => new Response('{"title":"NOT_FOUND"}', { status: 404, statusText: "Not Found" }),
		)
		await expect(job.complete({})).rejects.toThrow(
			'Job 2251799813685249 completion failed: 404 Not Found {"title":"NOT_FOUND"}',
		)
		await expect(job.fail("x")).rejects.toThrow("Job 2251799813685249 failure failed: 404")
		await expect(job.throwError("E", "x")).rejects.toThrow("Job 2251799813685249 error failed: 404")
	})
})

describe("OAuth2", () => {
	function withToken(expiresIn = 3600) {
		let tokens = 0
		return stubFetch((call) => {
			if (call.url === "https://login.cloud.camunda.io/oauth/token") {
				tokens++
				return Response.json({ access_token: `tok-${tokens}`, expires_in: expiresIn })
			}
			if (call.url.endsWith("/activation")) return jobsReply([rawJob()])
			return ok()
		})
	}

	it("sends no authorization without credentials", async () => {
		const calls = withToken()
		await take(createWorkerClient().poll("send-email"), 1)
		expect(calls.map((c) => c.url)).toEqual(["http://localhost:26500/v2/jobs/activation"])
		expect(calls[0]?.headers.authorization).toBeUndefined()
	})

	it("fetches a client-credentials token with the SaaS defaults", async () => {
		const calls = withToken()
		const client = createWorkerClient({ clientId: "id", clientSecret: "secret" })
		await take(client.poll("send-email"), 1)
		const [token, activation] = calls
		expect(token?.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" })
		expect(Object.fromEntries(new URLSearchParams(token?.body))).toEqual({
			grant_type: "client_credentials",
			client_id: "id",
			client_secret: "secret",
			audience: "zeebe.camunda.io",
		})
		expect(activation?.headers.authorization).toBe("Bearer tok-1")
	})

	it("reads credentials, token URL and audience from the environment", async () => {
		process.env.ZEEBE_CLIENT_ID = "env-id"
		process.env.ZEEBE_CLIENT_SECRET = "env-secret"
		process.env.ZEEBE_TOKEN_URL = "https://idp/token"
		process.env.ZEEBE_TOKEN_AUDIENCE = "my-audience"
		const calls = stubFetch((call) =>
			call.url === "https://idp/token"
				? Response.json({ access_token: "t", expires_in: 3600 })
				: jobsReply([rawJob()]),
		)
		await take(createWorkerClient().poll("send-email"), 1)
		expect(calls[0]?.url).toBe("https://idp/token")
		expect(new URLSearchParams(calls[0]?.body).get("client_id")).toBe("env-id")
		expect(new URLSearchParams(calls[0]?.body).get("audience")).toBe("my-audience")
	})

	it("reuses the token across calls until a minute before it expires", async () => {
		vi.useFakeTimers({ now: 0, toFake: ["Date"] })
		const calls = withToken(120)
		const client = createWorkerClient({ clientId: "id", clientSecret: "secret" })
		const [job] = await take(client.poll("send-email"), 1)
		await job?.complete()
		vi.setSystemTime(61_000)
		await job?.complete()
		const auth = calls.filter((c) => !c.url.includes("oauth")).map((c) => c.headers.authorization)
		expect(auth).toEqual(["Bearer tok-1", "Bearer tok-1", "Bearer tok-2"])
	})

	it("rejects a settle call when the token request fails", async () => {
		let tokenOk = true
		stubFetch((call) => {
			if (call.url.includes("oauth")) {
				return tokenOk
					? Response.json({ access_token: "t", expires_in: 0 })
					: new Response("", { status: 401 })
			}
			return call.url.endsWith("/activation") ? jobsReply([rawJob()]) : ok()
		})
		const client = createWorkerClient({ clientId: "id", clientSecret: "secret" })
		const [job] = await take(client.poll("send-email"), 1)
		tokenOk = false
		await expect(job?.complete()).rejects.toThrow("OAuth2 token request failed: 401")
	})
})

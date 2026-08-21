import { beforeEach, describe, expect, it } from "vitest"
import type { Env } from "../src/env.js"
import type { AiLike } from "../src/lib/ai.js"
import type { ReviewResult } from "../src/lib/review.js"
import { handleAiReview } from "../src/routes/ai-review.js"
import { DEMO_SHARE_ID } from "../src/shared/constants.js"

const NOW = 1_752_000_000_000
const DEMO_FILE = "loan-approval.bpmn"

/**
 * Focused in-memory D1 stand-in: recognizes the exact ai_* statements the
 * handler issues (by table name) and keeps their rows in maps.
 */
function fakeDb() {
	const reviews = new Map<string, { model: string; review: string }>()
	const budget = new Map<string, number>()
	const attempts = new Map<string, number>()
	const stmt = (sql: string) => {
		let args: unknown[] = []
		const api = {
			bind(...a: unknown[]) {
				args = a
				return api
			},
			async first<T>(): Promise<T | null> {
				if (sql.includes("FROM ai_reviews"))
					return (reviews.get(args[0] as string) ?? null) as T | null
				if (sql.includes("FROM ai_budget")) {
					const day = args[0] as string
					return budget.has(day) ? ({ spent: budget.get(day) } as T) : null
				}
				if (sql.includes("FROM ai_unlock_attempts")) {
					const key = `${args[0]}:${args[1]}`
					return attempts.has(key) ? ({ count: attempts.get(key) } as T) : null
				}
				return null
			},
			async run() {
				if (sql.includes("INTO ai_reviews")) {
					reviews.set(args[0] as string, { model: args[1] as string, review: args[2] as string })
				} else if (sql.includes("INTO ai_budget")) {
					const day = args[0] as string
					budget.set(day, (budget.get(day) ?? 0) + (args[1] as number))
				} else if (sql.includes("INTO ai_unlock_attempts")) {
					const key = `${args[0]}:${args[1]}`
					attempts.set(key, (attempts.get(key) ?? 0) + 1)
				}
				return { meta: {} }
			},
		}
		return api
	}
	return { prepare: (sql: string) => stmt(sql) } as unknown as D1Database
}

function makeAi(): AiLike & { calls: number } {
	return {
		calls: 0,
		async run() {
			this.calls++
			return {
				response: JSON.stringify({
					summary: "Solid happy path; tighten error handling.",
					suggestions: [
						{
							title: "Add a boundary timer",
							why: "The user task can wait forever.",
							severity: "warning",
							elementId: "fillForm",
						},
					],
				}),
			}
		},
	}
}

function makeEnv(over: Partial<Env>, ai: AiLike): Env {
	return {
		AI: ai,
		AI_MODEL: "test-model",
		AI_DAILY_BUDGET: "8000",
		DB: fakeDb(),
		...over,
	} as unknown as Env
}

const post = (code?: string) =>
	new Request("http://drop/x", {
		method: "POST",
		headers: code ? { "X-Drop-AI-Code": code } : {},
	})

let ai: AiLike & { calls: number }
beforeEach(() => {
	ai = makeAi()
})

describe("handleAiReview gate", () => {
	it("returns 404 when AI_PASSCODE is unset (feature off)", async () => {
		const env = makeEnv({ AI_PASSCODE: undefined }, ai)
		const res = await handleAiReview(post("x"), DEMO_SHARE_ID, DEMO_FILE, env, NOW)
		expect(res.status).toBe(404)
		expect(ai.calls).toBe(0)
	})

	it("rejects a wrong code with 401, then 429 after 5 failures", async () => {
		const env = makeEnv({ AI_PASSCODE: "sesame" }, ai)
		for (let i = 0; i < 5; i++) {
			const res = await handleAiReview(post("nope"), DEMO_SHARE_ID, DEMO_FILE, env, NOW)
			expect(res.status).toBe(401)
		}
		const blocked = await handleAiReview(post("nope"), DEMO_SHARE_ID, DEMO_FILE, env, NOW)
		expect(blocked.status).toBe(429)
		expect(ai.calls).toBe(0)
	})
})

describe("handleAiReview happy path", () => {
	it("runs the model once on a cache miss, then serves the cache", async () => {
		const env = makeEnv({ AI_PASSCODE: "sesame" }, ai)
		const first = await handleAiReview(post("sesame"), DEMO_SHARE_ID, DEMO_FILE, env, NOW)
		expect(first.status).toBe(200)
		const r1 = (await first.json()) as ReviewResult
		expect(ai.calls).toBe(1)
		expect(r1.summary).toContain("happy path")
		expect(r1.suggestions.length).toBe(1)
		expect(r1.deterministic.length).toBeGreaterThan(0)
		expect(r1.cached).toBe(false)

		const second = await handleAiReview(post("sesame"), DEMO_SHARE_ID, DEMO_FILE, env, NOW)
		const r2 = (await second.json()) as ReviewResult
		expect(ai.calls).toBe(1) // no second model call
		expect(r2.cached).toBe(true)
		expect(r2.summary).toContain("happy path")
	})

	it("degrades to deterministic-only with a note when the budget is exhausted", async () => {
		const env = makeEnv({ AI_PASSCODE: "sesame", AI_DAILY_BUDGET: "0" }, ai)
		const res = await handleAiReview(post("sesame"), DEMO_SHARE_ID, DEMO_FILE, env, NOW)
		expect(res.status).toBe(200)
		const r = (await res.json()) as ReviewResult
		expect(ai.calls).toBe(0)
		expect(r.model).toBeNull()
		expect(r.note).toBeTruthy()
		expect(r.deterministic.length).toBeGreaterThan(0)
	})
})

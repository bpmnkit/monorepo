import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resolveConfig } from "./config.js"

describe("resolveConfig", () => {
	const original = { ...process.env }

	beforeEach(() => {
		for (const key of ["ANTHROPIC_API_KEY", "AI_MODEL", "AI_MAX_TOKENS", "AI_TIMEOUT_MS"]) {
			Reflect.deleteProperty(process.env, key)
		}
	})

	afterEach(() => {
		Object.assign(process.env, original)
	})

	it("throws when ANTHROPIC_API_KEY is not set", () => {
		expect(() => resolveConfig()).toThrow("ANTHROPIC_API_KEY")
	})

	it("returns defaults when only API key is set", () => {
		process.env.ANTHROPIC_API_KEY = "sk-test"
		const cfg = resolveConfig()
		expect(cfg.apiKey).toBe("sk-test")
		expect(cfg.model).toBe("claude-3-5-haiku-20241022")
		expect(cfg.maxTokens).toBe(1024)
		expect(cfg.timeoutMs).toBe(60000)
	})

	it("overrides defaults from env vars", () => {
		process.env.ANTHROPIC_API_KEY = "sk-test"
		process.env.AI_MODEL = "claude-opus-4-6"
		process.env.AI_MAX_TOKENS = "2048"
		process.env.AI_TIMEOUT_MS = "30000"
		const cfg = resolveConfig()
		expect(cfg.model).toBe("claude-opus-4-6")
		expect(cfg.maxTokens).toBe(2048)
		expect(cfg.timeoutMs).toBe(30000)
	})
})

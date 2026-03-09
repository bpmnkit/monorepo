import { describe, expect, it } from "vitest"
import { parseYaml } from "./yaml.js"

describe("parseYaml", () => {
	it("parses basic key-value pairs", () => {
		const result = parseYaml("baseUrl: http://localhost:8080/v2\ntimeout: 30000")
		expect(result.baseUrl).toBe("http://localhost:8080/v2")
		expect(result.timeout).toBe(30000)
	})

	it("parses nested mappings", () => {
		const result = parseYaml(`
auth:
  type: oauth2
  clientId: my-client
  tokenUrl: https://example.com/token
`)
		expect(result.auth).toEqual({
			type: "oauth2",
			clientId: "my-client",
			tokenUrl: "https://example.com/token",
		})
	})

	it("parses inline arrays", () => {
		const result = parseYaml("retryOn: [429, 500, 503]")
		expect(result.retryOn).toEqual([429, 500, 503])
	})

	it("parses block sequences", () => {
		const result = parseYaml(`
items:
  - 429
  - 500
  - 503
`)
		expect(result.items).toEqual([429, 500, 503])
	})

	it("parses booleans", () => {
		const result = parseYaml("enabled: true\ndisabled: false")
		expect(result.enabled).toBe(true)
		expect(result.disabled).toBe(false)
	})

	it("parses null values", () => {
		const result = parseYaml("value: null")
		expect(result.value).toBeNull()
	})

	it("parses double-quoted strings with escapes", () => {
		const result = parseYaml('key: "hello\\nworld"')
		expect(result.key).toBe("hello\nworld")
	})

	it("parses single-quoted strings", () => {
		const result = parseYaml("key: 'it''s fine'")
		expect(result.key).toBe("it's fine")
	})

	it("strips inline comments", () => {
		const result = parseYaml("baseUrl: http://localhost # comment\ntimeout: 5000 # ms")
		expect(result.baseUrl).toBe("http://localhost")
		expect(result.timeout).toBe(5000)
	})

	it("handles URLs with :// correctly (not treated as key: value)", () => {
		const result = parseYaml("tokenUrl: https://login.example.com/oauth/token")
		expect(result.tokenUrl).toBe("https://login.example.com/oauth/token")
	})

	it("parses a realistic config file", () => {
		const yaml = `
baseUrl: http://localhost:8080/v2
auth:
  type: oauth2
  clientId: my-client
  clientSecret: my-secret
  tokenUrl: https://auth.example.com/token
  tokenCache:
    disabled: false
    filePath: /tmp/token-cache.json
retry:
  maxAttempts: 3
  initialDelay: 100
  retryOn: [429, 500, 502, 503, 504]
cache:
  enabled: true
  ttl: 30000
logger:
  level: info
timeout: 10000
`
		const result = parseYaml(yaml)
		expect(result.baseUrl).toBe("http://localhost:8080/v2")
		expect((result.auth as Record<string, unknown>).type).toBe("oauth2")
		expect((result.auth as Record<string, unknown>).clientId).toBe("my-client")
		expect((result.retry as Record<string, unknown>).maxAttempts).toBe(3)
		expect((result.retry as Record<string, unknown>).retryOn).toEqual([429, 500, 502, 503, 504])
		expect((result.cache as Record<string, unknown>).enabled).toBe(true)
		expect(result.timeout).toBe(10000)
	})
})

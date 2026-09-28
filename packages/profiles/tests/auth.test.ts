import { AdminApiClient, CamundaClient } from "@bpmnkit/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type FakeOs, useTempHome } from "./helpers.js"

const fakeOs = vi.hoisted((): FakeOs => ({ platform: "linux", home: "" }))
vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>()
	return { ...actual, platform: () => fakeOs.platform, homedir: () => fakeOs.home }
})

const { createAdminClientFromProfile, createClientFromProfile, getAuthHeader, saveProfile } =
	await import("../src/index.js")

let home: ReturnType<typeof useTempHome>
beforeEach(() => {
	home = useTempHome(fakeOs)
})
afterEach(() => {
	home.restore()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

let tokenCount = 0
function stubTokenEndpoint(expiresIn?: number) {
	const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
		tokenCount++
		return Response.json({ access_token: `tok-${tokenCount}`, expires_in: expiresIn })
	})
	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

/** The token cache is module-wide, so each test uses its own client id. */
let clientSeq = 0
function oauth(overrides: Record<string, string> = {}) {
	clientSeq++
	return {
		auth: {
			type: "oauth2" as const,
			clientId: `client-${clientSeq}`,
			clientSecret: "secret",
			tokenUrl: "https://idp/token",
			...overrides,
		},
	}
}

describe("getAuthHeader", () => {
	it("is empty without auth or with auth none", async () => {
		expect(await getAuthHeader({})).toBe("")
		expect(await getAuthHeader({ auth: { type: "none" } })).toBe("")
	})

	it("passes a bearer token through", async () => {
		expect(await getAuthHeader({ auth: { type: "bearer", token: "abc" } })).toBe("Bearer abc")
	})

	it("encodes basic credentials", async () => {
		const header = await getAuthHeader({
			auth: { type: "basic", username: "demo", password: "p:ss" },
		})
		expect(header).toBe(`Basic ${Buffer.from("demo:p:ss").toString("base64")}`)
	})

	it("fetches an OAuth2 client-credentials token", async () => {
		const fetchMock = stubTokenEndpoint(3600)
		const config = oauth({ audience: "zeebe.camunda.io", scope: "read" })
		const header = await getAuthHeader(config)
		expect(header).toMatch(/^Bearer tok-\d+$/)
		const [url, init] = fetchMock.mock.calls[0] ?? []
		expect(url).toBe("https://idp/token")
		expect(init?.method).toBe("POST")
		expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
			grant_type: "client_credentials",
			client_id: config.auth.clientId,
			client_secret: "secret",
			audience: "zeebe.camunda.io",
			scope: "read",
		})
	})

	it("caches the token until 60 seconds before it expires", async () => {
		vi.useFakeTimers({ now: 0, toFake: ["Date"] })
		const fetchMock = stubTokenEndpoint(120)
		const config = oauth()
		const first = await getAuthHeader(config)
		vi.setSystemTime(59_000)
		expect(await getAuthHeader(config)).toBe(first)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		vi.setSystemTime(61_000)
		expect(await getAuthHeader(config)).not.toBe(first)
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	// Regression: the cache was keyed by client id alone, so two profiles sharing
	// a client id — one cluster's Zeebe and Operate audiences, or two clusters
	// behind one identity provider — were handed each other's token.
	it("does not share a token between configs that differ beyond the client id", async () => {
		const fetchMock = stubTokenEndpoint(3600)
		const base = oauth()
		const zeebe = { auth: { ...base.auth, audience: "zeebe-api" } }
		const operate = { auth: { ...base.auth, audience: "operate-api" } }
		const otherIdp = { auth: { ...base.auth, audience: "zeebe-api", tokenUrl: "https://idp2/t" } }
		const tokens = [
			await getAuthHeader(zeebe),
			await getAuthHeader(operate),
			await getAuthHeader(otherIdp),
		]
		expect(new Set(tokens).size).toBe(3)
		expect(fetchMock).toHaveBeenCalledTimes(3)
		expect(await getAuthHeader(zeebe)).toBe(tokens[0])
	})

	it("throws with the status when the token request fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 401, statusText: "Unauthorized" })),
		)
		await expect(getAuthHeader(oauth())).rejects.toThrow(
			"OAuth2 token request failed: 401 Unauthorized",
		)
	})
})

describe("client factories", () => {
	it("create clients from the active or a named profile", () => {
		saveProfile("a", { baseUrl: "http://a/v2", auth: { type: "none" } })
		saveProfile("b", { baseUrl: "http://b/v2", auth: { type: "none" } }, "admin")
		expect(createClientFromProfile()).toBeInstanceOf(CamundaClient)
		expect(createClientFromProfile("b")).toBeInstanceOf(CamundaClient)
		expect(createAdminClientFromProfile("b")).toBeInstanceOf(AdminApiClient)
	})

	it("throw an actionable error for an unknown profile", () => {
		expect(() => createClientFromProfile("ghost")).toThrow(
			'Profile "ghost" not found. Run `casen profile list` to see available profiles.',
		)
		expect(() => createAdminClientFromProfile("ghost")).toThrow('Profile "ghost" not found')
	})

	it("throw an actionable error when no profile is active", () => {
		expect(() => createClientFromProfile()).toThrow(/No active profile\. Create one with:/)
	})
})

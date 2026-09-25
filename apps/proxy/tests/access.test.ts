import type http from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
	FIRST_PARTY_ORIGINS,
	createAccessPolicy,
	decideAccess,
	exposureWarning,
	isLoopbackHost,
	listenHosts,
	mergeOptions,
	optionsFromEnv,
} from "../src/access.js"
import { createProxyServer, listenProxy } from "../src/index.js"
import { close, listening, send } from "./helpers/http.js"

const EVIL = "https://evil.example"

describe("decideAccess", () => {
	const policy = createAccessPolicy({ allowedOrigins: ["https://intranet.example/"] })

	it("lets programs through: no Origin, no Sec-Fetch-Site", () => {
		expect(decideAccess(policy, { host: "localhost:3033" })).toEqual({
			allowed: true,
			corsOrigin: null,
		})
	})

	it("accepts every first-party origin and reflects it", () => {
		for (const origin of FIRST_PARTY_ORIGINS) {
			expect(decideAccess(policy, { host: "localhost:3033", origin })).toEqual({
				allowed: true,
				corsOrigin: origin,
			})
		}
	})

	it("accepts loopback origins on any port", () => {
		for (const origin of [
			"http://localhost:5174",
			"http://127.0.0.1:4321",
			"http://[::1]:1420",
			"https://localhost",
		]) {
			expect(decideAccess(policy, { host: "127.0.0.1:3033", origin }).allowed, origin).toBe(true)
		}
	})

	it("accepts a configured origin, trailing slash and case aside", () => {
		expect(
			decideAccess(policy, { host: "localhost:3033", origin: "https://Intranet.example" }).allowed,
		).toBe(true)
	})

	it("refuses other origins, look-alikes and the opaque null origin", () => {
		for (const origin of [
			EVIL,
			"null",
			"https://bpmnkit.com.evil.example",
			"https://evil-bpmnkit.com",
			"http://bpmnkit.com",
			"http://localhost.evil.example",
			"file://",
		]) {
			expect(decideAccess(policy, { host: "localhost:3033", origin }).allowed, origin).toBe(false)
		}
	})

	it("refuses a Host that is not loopback — the DNS-rebinding case", () => {
		for (const host of ["evil.example:3033", "192.168.1.20:3033", "", "localhost.evil.example"]) {
			expect(decideAccess(policy, { host }).allowed, host).toBe(false)
		}
		expect(decideAccess(policy, {}).allowed).toBe(false)
		expect(decideAccess(policy, { host: "[::1]:3033" }).allowed).toBe(true)
	})

	it("accepts an allowed host name", () => {
		const lan = createAccessPolicy({ allowedHosts: ["devbox.lan"] })
		expect(decideAccess(lan, { host: "devbox.lan:3033" }).allowed).toBe(true)
		expect(decideAccess(lan, { host: "DEVBOX.lan." }).allowed).toBe(true)
	})

	it("refuses cross-site browser requests that carry no Origin", () => {
		expect(
			decideAccess(policy, { host: "localhost:3033", "sec-fetch-site": "cross-site" }).allowed,
		).toBe(false)
		expect(
			decideAccess(policy, { host: "localhost:3033", "sec-fetch-site": "same-site" }).allowed,
		).toBe(false)
		expect(decideAccess(policy, { host: "localhost:3033", "sec-fetch-site": "none" }).allowed).toBe(
			true,
		)
	})

	it("never lets a configured wildcard open every origin", () => {
		const wild = createAccessPolicy({ allowedOrigins: ["*", "null"] })
		expect(decideAccess(wild, { host: "localhost", origin: EVIL }).allowed).toBe(false)
		expect(decideAccess(wild, { host: "localhost", origin: "null" }).allowed).toBe(false)
	})
})

describe("options", () => {
	it("reads the environment", () => {
		const opts = optionsFromEnv({
			BPMNKIT_PROXY_HOST: " 0.0.0.0 ",
			BPMNKIT_PROXY_ALLOWED_ORIGINS: "https://a.example, https://b.example",
			BPMNKIT_PROXY_ALLOWED_HOSTS: "devbox.lan",
		})
		expect(opts.host).toBe("0.0.0.0")
		expect(opts.allowedOrigins).toEqual(["https://a.example", "https://b.example"])
		expect(opts.allowedHosts).toEqual(["devbox.lan"])
	})

	it("defaults to loopback, and explicit options win over the environment", () => {
		expect(mergeOptions({}, {}).host).toBe("127.0.0.1")
		expect(mergeOptions({ host: "0.0.0.0" }, { host: "127.0.0.1" }).host).toBe("127.0.0.1")
		expect(
			mergeOptions({ allowedOrigins: ["https://a.example"] }, { allowedOrigins: ["https://b"] })
				.allowedOrigins,
		).toEqual(["https://a.example", "https://b"])
	})

	it("listens on both loopback families by default, else on exactly the host asked for", () => {
		expect(listenHosts("127.0.0.1")).toEqual(["127.0.0.1", "::1"])
		expect(listenHosts("localhost")).toEqual(["127.0.0.1", "::1"])
		expect(listenHosts("::1")).toEqual(["127.0.0.1", "::1"])
		expect(listenHosts("0.0.0.0")).toEqual(["0.0.0.0"])
		expect(isLoopbackHost("0.0.0.0")).toBe(false)
	})

	it("warns only when the proxy leaves loopback", () => {
		expect(exposureWarning("127.0.0.1", 3033)).toBeNull()
		expect(exposureWarning("0.0.0.0", 3033)).toMatch(/WARNING.*0\.0\.0\.0:3033/)
	})

	it("answers to a specific bind address as a host name", () => {
		const policy = createAccessPolicy({ host: "192.168.1.20" })
		expect(decideAccess(policy, { host: "192.168.1.20:3033" }).allowed).toBe(true)
		expect(decideAccess(createAccessPolicy({ host: "0.0.0.0" }), { host: "0.0.0.0" }).allowed).toBe(
			false,
		)
	})
})

describe("listenProxy", () => {
	it("binds loopback only by default", async () => {
		const servers = await listenProxy(0)
		try {
			const addresses = servers.map((s) => (s.address() as AddressInfo).address)
			expect(addresses[0]).toBe("127.0.0.1")
			for (const a of addresses) expect(["127.0.0.1", "::1"]).toContain(a)
			const ports = new Set(servers.map((s) => (s.address() as AddressInfo).port))
			expect(ports.size).toBe(1)
		} finally {
			await Promise.all(servers.map(close))
		}
	})

	it("binds the interface given with the opt-in host", async () => {
		const servers = await listenProxy(0, { host: "0.0.0.0" })
		try {
			expect(servers.map((s) => (s.address() as AddressInfo).address)).toEqual(["0.0.0.0"])
		} finally {
			await Promise.all(servers.map(close))
		}
	})
})

describe("the proxy's front door", () => {
	let server: http.Server

	beforeAll(async () => {
		server = await listening(createProxyServer({}))
	})
	afterAll(() => close(server))

	it("serves a first-party origin, reflecting it with Vary: Origin", async () => {
		const r = await send(server, "GET", "/worker-templates", { origin: "https://bpmnkit.com" })
		expect(r.status).toBe(200)
		expect(r.headers["access-control-allow-origin"]).toBe("https://bpmnkit.com")
		expect(r.headers.vary).toBe("Origin")
	})

	it("serves a program that sends no Origin, without CORS headers", async () => {
		const r = await send(server, "GET", "/worker-templates")
		expect(r.status).toBe(200)
		expect(r.headers["access-control-allow-origin"]).toBeUndefined()
	})

	it("refuses a foreign origin with 403 and no CORS headers, on every sensitive route", async () => {
		for (const [method, path] of [
			["GET", "/fs/read?path=/etc/hosts"],
			["POST", "/fs/write"],
			["DELETE", "/fs/file?path=/tmp/x.bpmn"],
			["POST", "/fs/move"],
			["GET", "/api/topology"],
			["GET", "/profiles"],
			["POST", "/chat"],
			["POST", "/secrets/HOME"],
			["POST", "/http-request"],
			["GET", "/element-templates?root=/"],
		] as const) {
			const r = await send(
				server,
				method,
				path,
				{ origin: EVIL, "content-type": "text/plain" },
				method === "POST" ? "{}" : undefined,
			)
			expect(r.status, `${method} ${path}`).toBe(403)
			expect(r.headers["access-control-allow-origin"], path).toBeUndefined()
		}
	})

	it("refuses a no-Origin cross-site request, such as an <img> tag", async () => {
		const r = await send(server, "GET", "/profiles", { "sec-fetch-site": "cross-site" })
		expect(r.status).toBe(403)
	})

	it("refuses a rebinding Host header", async () => {
		const r = await send(server, "GET", "/worker-templates", { host: "attacker.example:3033" })
		expect(r.status).toBe(403)
		expect(JSON.parse(r.body).error).toMatch(/allow-host/)
	})

	it("answers an allowed preflight with the CORS and private-network grants", async () => {
		const r = await send(server, "OPTIONS", "/fs/write", {
			origin: "https://studio.bpmnkit.com",
			"access-control-request-method": "POST",
			"access-control-request-headers": "content-type",
			"access-control-request-private-network": "true",
		})
		expect(r.status).toBe(204)
		expect(r.headers["access-control-allow-origin"]).toBe("https://studio.bpmnkit.com")
		expect(r.headers["access-control-allow-methods"]).toContain("POST")
		expect(r.headers["access-control-allow-headers"]).toMatch(/content-type/i)
		expect(r.headers["access-control-allow-private-network"]).toBe("true")
	})

	it("refuses a foreign preflight", async () => {
		const r = await send(server, "OPTIONS", "/fs/write", {
			origin: EVIL,
			"access-control-request-method": "POST",
		})
		expect(r.status).toBe(403)
		expect(r.headers["access-control-allow-origin"]).toBeUndefined()
	})
})

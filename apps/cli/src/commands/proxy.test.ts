import { delimiter } from "node:path"
import { describe, expect, it } from "vitest"
import { proxyGroup, proxyOptionsFromFlags } from "./proxy.js"

describe("casen proxy start flags", () => {
	it("declares the access flags", () => {
		const start = proxyGroup.commands.find((c) => c.name === "start")
		const names = start?.flags?.map((f) => f.name)
		expect(names).toEqual(expect.arrayContaining(["host", "allow-origin", "allow-host", "root"]))
	})

	it("leaves host unset so the proxy stays on loopback", () => {
		expect(proxyOptionsFromFlags({ port: 3033 })).toEqual({
			allowedOrigins: [],
			allowedHosts: [],
			roots: [],
		})
	})

	it("splits origin and host lists on commas, roots like PATH", () => {
		const options = proxyOptionsFromFlags({
			host: "0.0.0.0",
			"allow-origin": "https://a.example, https://b.example",
			"allow-host": "devbox.lan",
			root: ["/work/a", "/work/b"].join(delimiter),
		})
		expect(options).toEqual({
			host: "0.0.0.0",
			allowedOrigins: ["https://a.example", "https://b.example"],
			allowedHosts: ["devbox.lan"],
			roots: ["/work/a", "/work/b"],
		})
	})
})

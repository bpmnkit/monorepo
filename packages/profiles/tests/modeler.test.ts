import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type FakeOs, useTempHome } from "./helpers.js"

const fakeOs = vi.hoisted((): FakeOs => ({ platform: "linux", home: "" }))
vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>()
	return { ...actual, platform: () => fakeOs.platform, homedir: () => fakeOs.home }
})

const { listModelerProfiles, listProfiles, saveProfile } = await import("../src/index.js")

let home: ReturnType<typeof useTempHome>
beforeEach(() => {
	home = useTempHome(fakeOs)
})
afterEach(() => home.restore())

function writeModelerSettings(dir: string, connections: unknown): void {
	mkdirSync(dir, { recursive: true })
	writeFileSync(
		join(dir, "settings.json"),
		JSON.stringify({ "connectionManagerPlugin.c8connections": connections }),
	)
}
const linuxModelerDir = () => join(fakeOs.home, ".config", "camunda-modeler")

describe("listModelerProfiles", () => {
	it("returns nothing when Camunda Modeler is not installed", () => {
		expect(listModelerProfiles()).toEqual([])
	})

	it("returns nothing for an unreadable or unexpected settings file", () => {
		mkdirSync(linuxModelerDir(), { recursive: true })
		writeFileSync(join(linuxModelerDir(), "settings.json"), "{ not json")
		expect(listModelerProfiles()).toEqual([])
		writeFileSync(join(linuxModelerDir(), "settings.json"), JSON.stringify({ other: 1 }))
		expect(listModelerProfiles()).toEqual([])
	})

	it("maps each connection's auth", () => {
		writeModelerSettings(linuxModelerDir(), [
			{
				name: "SaaS",
				contactPoint: "https://bru-2.zeebe.camunda.io/abc",
				targetType: "camundaCloud",
				camundaCloudClientId: "cid",
				camundaCloudClientSecret: "csecret",
			},
			{
				name: "SM OAuth",
				contactPoint: "http://sm:8080",
				authType: "oauth2",
				clientId: "id",
				clientSecret: "secret",
				tokenUrl: "http://kc/token",
				audience: "zeebe-api",
			},
			{ name: "Bearer", authType: "bearer", bearerToken: "tok" },
			{ name: "Basic", authType: "basic", username: "demo", password: "demo" },
			{ name: "None", contactPoint: "http://localhost:8080" },
		])
		const profiles = listModelerProfiles()
		expect(profiles.map((p) => [p.name, p.config.auth])).toEqual([
			[
				"SaaS",
				{
					type: "oauth2",
					clientId: "cid",
					clientSecret: "csecret",
					tokenUrl: "https://login.cloud.camunda.io/oauth/token",
					audience: "zeebe.camunda.io",
				},
			],
			[
				"SM OAuth",
				{
					type: "oauth2",
					clientId: "id",
					clientSecret: "secret",
					tokenUrl: "http://kc/token",
					audience: "zeebe-api",
				},
			],
			["Bearer", { type: "bearer", token: "tok" }],
			["Basic", { type: "basic", username: "demo", password: "demo" }],
			["None", { type: "none" }],
		])
		expect(profiles[0]).toMatchObject({
			apiType: "c8",
			createdAt: null,
			source: "modeler",
			config: { baseUrl: "https://bru-2.zeebe.camunda.io/abc" },
		})
		expect(profiles[2]?.config.baseUrl).toBeUndefined()
	})

	it("skips connections without a name and falls back to no auth on missing credentials", () => {
		writeModelerSettings(linuxModelerDir(), [
			null,
			"junk",
			{ contactPoint: "http://nameless" },
			{ name: "Half", targetType: "camundaCloud", camundaCloudClientId: "cid" },
		])
		expect(listModelerProfiles()).toEqual([
			{
				name: "Half",
				apiType: "c8",
				config: { baseUrl: undefined, auth: { type: "none" } },
				createdAt: null,
				source: "modeler",
			},
		])
	})

	it("reads the Modeler's per-platform config dir", () => {
		fakeOs.platform = "darwin"
		writeModelerSettings(join(fakeOs.home, "Library", "Application Support", "camunda-modeler"), [
			{ name: "mac" },
		])
		expect(listModelerProfiles().map((p) => p.name)).toEqual(["mac"])

		fakeOs.platform = "win32"
		process.env.APPDATA = join(home.dir, "AppData")
		writeModelerSettings(join(home.dir, "AppData", "camunda-modeler"), [{ name: "win" }])
		expect(listModelerProfiles().map((p) => p.name)).toEqual(["win"])
	})
})

describe("listProfiles with Modeler connections", () => {
	it("lists own profiles first and lets them shadow a Modeler connection of the same name", () => {
		writeModelerSettings(linuxModelerDir(), [{ name: "shared" }, { name: "modeler-only" }])
		saveProfile("shared", { baseUrl: "http://own" })
		const profiles = listProfiles()
		expect(profiles.map((p) => [p.name, p.source])).toEqual([
			["shared", undefined],
			["modeler-only", "modeler"],
		])
		expect(profiles[0]?.config.baseUrl).toBe("http://own")
	})
})

import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type FakeOs, useTempHome } from "./helpers.js"

const fakeOs = vi.hoisted((): FakeOs => ({ platform: "linux", home: "" }))
vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>()
	return { ...actual, platform: () => fakeOs.platform, homedir: () => fakeOs.home }
})

const {
	appendAuditEntry,
	clearAuditLog,
	deleteProfile,
	getActiveName,
	getActiveProfile,
	getAuditLog,
	getConfigFilePath,
	getProfile,
	getSettings,
	listProfiles,
	saveProfile,
	saveSettings,
	setProfileMeta,
	useProfile,
} = await import("../src/index.js")

let home: ReturnType<typeof useTempHome>
beforeEach(() => {
	home = useTempHome(fakeOs)
})
afterEach(() => {
	home.restore()
	vi.useRealTimers()
})

const readStore = () =>
	JSON.parse(readFileSync(getConfigFilePath(), "utf8")) as Record<string, unknown>
const writeStore = (store: unknown) => {
	mkdirSync(dirname(getConfigFilePath()), { recursive: true })
	writeFileSync(getConfigFilePath(), JSON.stringify(store))
}

const local = { baseUrl: "http://localhost:8080/v2", auth: { type: "none" as const } }
const saas = {
	baseUrl: "https://bru-2.zeebe.camunda.io/abc/v2",
	auth: {
		type: "oauth2" as const,
		clientId: "id",
		clientSecret: "s3cret",
		tokenUrl: "https://login.cloud.camunda.io/oauth/token",
		audience: "zeebe.camunda.io",
	},
}

// The storage location is a documented stability contract
// (apps/landing/src/content/docs/getting-started/stability.md).
describe("on-disk location", () => {
	it("Linux: ~/.config/casen/config.json", () => {
		expect(getConfigFilePath()).toBe(join(fakeOs.home, ".config", "casen", "config.json"))
	})

	it("Linux: honours XDG_CONFIG_HOME", () => {
		process.env.XDG_CONFIG_HOME = join(home.dir, "xdg")
		expect(getConfigFilePath()).toBe(join(home.dir, "xdg", "casen", "config.json"))
	})

	it("macOS: ~/Library/Application Support/casen/config.json, ignoring XDG_CONFIG_HOME", () => {
		fakeOs.platform = "darwin"
		process.env.XDG_CONFIG_HOME = join(home.dir, "xdg")
		expect(getConfigFilePath()).toBe(
			join(fakeOs.home, "Library", "Application Support", "casen", "config.json"),
		)
	})

	it("Windows: %APPDATA%\\casen\\config.json", () => {
		fakeOs.platform = "win32"
		process.env.APPDATA = join(home.dir, "AppData", "Roaming")
		expect(getConfigFilePath()).toBe(join(home.dir, "AppData", "Roaming", "casen", "config.json"))
	})

	it("Windows without APPDATA: falls back to the home dir", () => {
		fakeOs.platform = "win32"
		expect(getConfigFilePath()).toBe(join(fakeOs.home, "casen", "config.json"))
	})

	it("writes to that path, creating the directories", () => {
		saveProfile("local", local)
		expect(existsSync(join(fakeOs.home, ".config", "casen", "config.json"))).toBe(true)
	})
})

describe("store format", () => {
	it("writes the documented shape", () => {
		vi.useFakeTimers({ now: new Date("2026-01-02T03:04:05.000Z"), toFake: ["Date"] })
		saveProfile("local", local, "c8", { description: "dev", tags: ["a"] })
		expect(readStore()).toEqual({
			profiles: { local },
			active: "local",
			meta: {
				local: {
					createdAt: "2026-01-02T03:04:05.000Z",
					apiType: "c8",
					description: "dev",
					tags: ["a"],
				},
			},
		})
	})

	it("reads a store written before meta, apiType and settings existed", () => {
		writeStore({ profiles: { old: local }, active: "old" })
		expect(getProfile("old")).toEqual({
			name: "old",
			apiType: "c8",
			config: local,
			createdAt: null,
			description: undefined,
			tags: undefined,
		})
		expect(getSettings()).toEqual({ auditLogSize: 15 })
		expect(getAuditLog()).toEqual([])
	})

	it("keeps an old store's profiles when writing to it", () => {
		writeStore({ profiles: { old: local }, active: "old" })
		saveProfile("new", saas)
		expect(listProfiles().map((p) => p.name)).toEqual(["old", "new"])
		expect(getActiveName()).toBe("old")
		expect(getProfile("old")?.createdAt).toBeNull()
	})

	it("treats a missing file as an empty store", () => {
		expect(listProfiles()).toEqual([])
		expect(getActiveName()).toBeNull()
		expect(getActiveProfile()).toBeUndefined()
		expect(existsSync(getConfigFilePath())).toBe(false)
	})
})

describe("profiles", () => {
	it("saves and reads back a profile, credentials included", () => {
		saveProfile("saas", saas, "c8", { description: "prod", tags: ["prod", "eu"] })
		const p = getProfile("saas")
		expect(p?.config).toEqual(saas)
		expect(p?.apiType).toBe("c8")
		expect(p?.description).toBe("prod")
		expect(p?.tags).toEqual(["prod", "eu"])
		expect(p?.createdAt).toMatch(/^\d{4}-\d\d-\d\dT/)
	})

	it("returns undefined for an unknown profile", () => {
		expect(getProfile("nope")).toBeUndefined()
	})

	it("activates the first profile saved, and only the first", () => {
		saveProfile("a", local)
		saveProfile("b", local)
		expect(getActiveName()).toBe("a")
		expect(getActiveProfile()?.name).toBe("a")
	})

	it("overwrites a profile's config but keeps its createdAt", () => {
		saveProfile("a", local)
		const created = getProfile("a")?.createdAt
		saveProfile("a", saas, "admin")
		expect(getProfile("a")?.config).toEqual(saas)
		expect(getProfile("a")?.apiType).toBe("admin")
		expect(getProfile("a")?.createdAt).toBe(created)
	})

	it("clears description and tags with an empty value, keeps them when omitted", () => {
		saveProfile("a", local, "c8", { description: "d", tags: ["t"] })
		saveProfile("a", local)
		expect(getProfile("a")?.description).toBe("d")
		saveProfile("a", local, "c8", { description: "", tags: [] })
		expect(getProfile("a")?.description).toBeUndefined()
		expect(getProfile("a")?.tags).toBeUndefined()
	})

	it("switches the active profile with useProfile", () => {
		saveProfile("a", local)
		saveProfile("b", saas)
		expect(useProfile("b")).toBe(true)
		expect(getActiveProfile()?.config).toEqual(saas)
		expect(useProfile("nope")).toBe(false)
		expect(getActiveName()).toBe("b")
	})

	it("sets metadata without touching the connection", () => {
		saveProfile("a", saas)
		expect(setProfileMeta("a", { description: "x", tags: ["y"] })).toBe(true)
		expect(getProfile("a")).toMatchObject({ config: saas, description: "x", tags: ["y"] })
		expect(setProfileMeta("nope", { description: "x" })).toBe(false)
	})

	it("returns false from setProfileMeta for a profile with no metadata", () => {
		writeStore({ profiles: { old: local }, active: "old" })
		expect(setProfileMeta("old", { description: "x" })).toBe(false)
	})

	it("deletes a profile and moves the active one to a remaining profile", () => {
		saveProfile("a", local)
		saveProfile("b", saas)
		expect(deleteProfile("a")).toBe(true)
		expect(getProfile("a")).toBeUndefined()
		expect(getActiveName()).toBe("b")
		expect(deleteProfile("b")).toBe(true)
		expect(getActiveName()).toBeNull()
		expect(deleteProfile("b")).toBe(false)
	})

	it("keeps the active profile when deleting another", () => {
		saveProfile("a", local)
		saveProfile("b", local)
		deleteProfile("b")
		expect(getActiveName()).toBe("a")
	})

	// Regression: deleteProfile left the profile's meta behind, so a new profile
	// saved under the same name inherited the old description, tags and createdAt.
	it("does not carry a deleted profile's metadata over to a new one of the same name", () => {
		vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z"), toFake: ["Date"] })
		saveProfile("a", local, "admin", { description: "old", tags: ["old"] })
		deleteProfile("a")
		expect(readStore().meta).toEqual({})
		vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"))
		saveProfile("a", saas)
		expect(getProfile("a")).toMatchObject({
			apiType: "c8",
			createdAt: "2026-02-01T00:00:00.000Z",
			description: undefined,
			tags: undefined,
		})
	})
})

describe("credential handling", () => {
	it.skipIf(process.platform === "win32")("writes the store readable by its owner only", () => {
		saveProfile("saas", saas)
		expect(statSync(getConfigFilePath()).mode & 0o777).toBe(0o600)
	})

	// Regression: the store — which holds client secrets and passwords — was
	// written with the default umask, usually world-readable 0644.
	it.skipIf(process.platform === "win32")("tightens a store created before the fix", () => {
		writeStore({ profiles: { saas }, active: "saas", meta: {} })
		chmodSync(getConfigFilePath(), 0o644)
		saveSettings({ auditLogSize: 3 })
		expect(statSync(getConfigFilePath()).mode & 0o777).toBe(0o600)
	})

	it("stores credentials as given, so reading them back is lossless", () => {
		const basic = {
			baseUrl: "http://x",
			auth: { type: "basic" as const, username: "u", password: "p:w" },
		}
		saveProfile("basic", basic)
		expect(getProfile("basic")?.config).toEqual(basic)
	})
})

describe("settings", () => {
	it("defaults the audit log size to 15", () => {
		expect(getSettings()).toEqual({ auditLogSize: 15 })
	})

	it("merges saved settings", () => {
		saveSettings({ auditLogSize: 5 })
		saveSettings({})
		expect(getSettings()).toEqual({ auditLogSize: 5 })
	})
})

describe("audit log", () => {
	const entry = (command: string) => ({
		group: "profile",
		command,
		positional: [],
		flags: { json: true },
		status: "ok" as const,
	})

	it("appends timestamped entries per profile", () => {
		appendAuditEntry("a", entry("list"))
		const [first] = getAuditLog("a")
		expect(first).toMatchObject(entry("list"))
		expect(first?.timestamp).toMatch(/^\d{4}-\d\d-\d\dT/)
		expect(getAuditLog("b")).toEqual([])
	})

	it("keeps only the newest auditLogSize entries", () => {
		saveSettings({ auditLogSize: 2 })
		for (const c of ["one", "two", "three"]) appendAuditEntry("a", entry(c))
		expect(getAuditLog("a").map((e) => e.command)).toEqual(["two", "three"])
	})

	it("merges all profiles' entries in time order", () => {
		vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z"), toFake: ["Date"] })
		appendAuditEntry("a", entry("first"))
		vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z"))
		appendAuditEntry("a", entry("third"))
		vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"))
		appendAuditEntry("b", entry("second"))
		expect(getAuditLog().map((e) => e.command)).toEqual(["first", "second", "third"])
	})

	it("clears one profile's log or all of them", () => {
		appendAuditEntry("a", entry("x"))
		appendAuditEntry("b", entry("y"))
		clearAuditLog("a")
		expect(getAuditLog("a")).toEqual([])
		expect(getAuditLog("b")).toHaveLength(1)
		clearAuditLog()
		expect(getAuditLog()).toEqual([])
	})

	it("clearing an empty log writes nothing", () => {
		clearAuditLog()
		expect(existsSync(getConfigFilePath())).toBe(false)
	})
})

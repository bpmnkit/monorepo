import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir, platform } from "node:os"
import { join } from "node:path"
import type { CamundaClientInput } from "@bpmnkit/api"
import { listModelerProfiles } from "./modeler.js"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiType = "c8" | "admin"

export interface Profile {
	name: string
	apiType: ApiType
	config: CamundaClientInput
	createdAt: string | null
	source?: "modeler"
}

export interface AuditEntry {
	timestamp: string
	group: string
	command: string
	positional: string[]
	flags: Record<string, string | boolean | number>
	status: "ok" | "error"
	error?: string
}

export interface Settings {
	auditLogSize: number
}

const DEFAULT_AUDIT_LOG_SIZE = 15

interface ConfigStore {
	profiles: Record<string, CamundaClientInput>
	active: string | null
	meta: Record<string, { createdAt: string; apiType?: ApiType }>
	settings?: Partial<Settings>
	auditLog?: Record<string, AuditEntry[]>
}

// ─── Config directory ─────────────────────────────────────────────────────────

function configDir(): string {
	const p = platform()
	if (p === "win32") return join(process.env.APPDATA ?? homedir(), "casen")
	if (p === "darwin") return join(homedir(), "Library", "Application Support", "casen")
	return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "casen")
}

function configFilePath(): string {
	return join(configDir(), "config.json")
}

// ─── Read / write ─────────────────────────────────────────────────────────────

function readStore(): ConfigStore {
	try {
		const raw = readFileSync(configFilePath(), "utf8")
		const store = JSON.parse(raw) as ConfigStore
		if (!store.meta) store.meta = {}
		return store
	} catch {
		return { profiles: {}, active: null, meta: {} }
	}
}

function writeStore(store: ConfigStore): void {
	const dir = configDir()
	mkdirSync(dir, { recursive: true })
	writeFileSync(configFilePath(), JSON.stringify(store, null, 2), "utf8")
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listProfiles(): Profile[] {
	const store = readStore()
	const own: Profile[] = Object.entries(store.profiles).map(([name, config]) => ({
		name,
		apiType: store.meta[name]?.apiType ?? "c8",
		config,
		createdAt: store.meta[name]?.createdAt ?? null,
	}))

	// Merge Camunda Modeler connections; own profiles take precedence by name
	const ownNames = new Set(own.map((p) => p.name))
	const modeler = listModelerProfiles().filter((p) => !ownNames.has(p.name))

	return [...own, ...modeler]
}

export function getProfile(name: string): Profile | undefined {
	const store = readStore()
	const config = store.profiles[name]
	if (!config) return undefined
	return {
		name,
		apiType: store.meta[name]?.apiType ?? "c8",
		config,
		createdAt: store.meta[name]?.createdAt ?? null,
	}
}

export function getActiveProfile(): Profile | undefined {
	const store = readStore()
	if (!store.active) return undefined
	return getProfile(store.active)
}

export function getActiveName(): string | null {
	return readStore().active
}

export function saveProfile(
	name: string,
	config: CamundaClientInput,
	apiType: ApiType = "c8",
): void {
	const store = readStore()
	store.profiles[name] = config
	if (!store.meta[name]) {
		store.meta[name] = { createdAt: new Date().toISOString(), apiType }
	} else {
		store.meta[name].apiType = apiType
	}
	// Auto-activate if this is the first profile
	if (store.active === null) store.active = name
	writeStore(store)
}

export function deleteProfile(name: string): boolean {
	const store = readStore()
	if (!(name in store.profiles)) return false
	const { [name]: _removed, ...rest } = store.profiles
	store.profiles = rest
	if (store.active === name) {
		const remaining = Object.keys(store.profiles)
		store.active = remaining.length > 0 ? (remaining[0] ?? null) : null
	}
	writeStore(store)
	return true
}

export function useProfile(name: string): boolean {
	const store = readStore()
	if (!(name in store.profiles)) return false
	store.active = name
	writeStore(store)
	return true
}

export function getConfigFilePath(): string {
	return configFilePath()
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): Settings {
	const store = readStore()
	return { auditLogSize: store.settings?.auditLogSize ?? DEFAULT_AUDIT_LOG_SIZE }
}

export function saveSettings(settings: Partial<Settings>): void {
	const store = readStore()
	store.settings = { ...store.settings, ...settings }
	writeStore(store)
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export function appendAuditEntry(profile: string, entry: Omit<AuditEntry, "timestamp">): void {
	const store = readStore()
	const size = store.settings?.auditLogSize ?? DEFAULT_AUDIT_LOG_SIZE
	const log = store.auditLog ?? {}
	const existing = log[profile] ?? []
	const updated = [...existing, { ...entry, timestamp: new Date().toISOString() }]
	log[profile] = updated.slice(-size)
	store.auditLog = log
	writeStore(store)
}

export function getAuditLog(profile?: string): AuditEntry[] {
	const store = readStore()
	if (!store.auditLog) return []
	if (profile) return store.auditLog[profile] ?? []
	return Object.values(store.auditLog)
		.flat()
		.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function clearAuditLog(profile?: string): void {
	const store = readStore()
	if (!store.auditLog) return
	if (profile) {
		const { [profile]: _removed, ...rest } = store.auditLog
		store.auditLog = rest
	} else {
		store.auditLog = {}
	}
	writeStore(store)
}

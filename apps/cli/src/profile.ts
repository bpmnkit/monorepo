import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { CamundaClientInput } from "@bpmn-sdk/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
	name: string;
	config: CamundaClientInput;
	createdAt: string | null;
}

interface ConfigStore {
	profiles: Record<string, CamundaClientInput>;
	active: string | null;
	meta: Record<string, { createdAt: string }>;
}

// ─── Config directory ─────────────────────────────────────────────────────────

function configDir(): string {
	const p = platform();
	if (p === "win32") return join(process.env.APPDATA ?? homedir(), "casen");
	if (p === "darwin") return join(homedir(), "Library", "Application Support", "casen");
	return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "casen");
}

function configFilePath(): string {
	return join(configDir(), "config.json");
}

// ─── Read / write ─────────────────────────────────────────────────────────────

function readStore(): ConfigStore {
	try {
		const raw = readFileSync(configFilePath(), "utf8");
		const store = JSON.parse(raw) as ConfigStore;
		if (!store.meta) store.meta = {};
		return store;
	} catch {
		return { profiles: {}, active: null, meta: {} };
	}
}

function writeStore(store: ConfigStore): void {
	const dir = configDir();
	mkdirSync(dir, { recursive: true });
	writeFileSync(configFilePath(), JSON.stringify(store, null, 2), "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listProfiles(): Profile[] {
	const store = readStore();
	return Object.entries(store.profiles).map(([name, config]) => ({
		name,
		config,
		createdAt: store.meta[name]?.createdAt ?? null,
	}));
}

export function getProfile(name: string): Profile | undefined {
	const store = readStore();
	const config = store.profiles[name];
	if (!config) return undefined;
	return { name, config, createdAt: store.meta[name]?.createdAt ?? null };
}

export function getActiveProfile(): Profile | undefined {
	const store = readStore();
	if (!store.active) return undefined;
	return getProfile(store.active);
}

export function getActiveName(): string | null {
	return readStore().active;
}

export function saveProfile(name: string, config: CamundaClientInput): void {
	const store = readStore();
	store.profiles[name] = config;
	if (!store.meta[name]) store.meta[name] = { createdAt: new Date().toISOString() };
	// Auto-activate if this is the first profile
	if (store.active === null) store.active = name;
	writeStore(store);
}

export function deleteProfile(name: string): boolean {
	const store = readStore();
	if (!(name in store.profiles)) return false;
	const { [name]: _removed, ...rest } = store.profiles;
	store.profiles = rest;
	if (store.active === name) {
		const remaining = Object.keys(store.profiles);
		store.active = remaining.length > 0 ? (remaining[0] ?? null) : null;
	}
	writeStore(store);
	return true;
}

export function useProfile(name: string): boolean {
	const store = readStore();
	if (!(name in store.profiles)) return false;
	store.active = name;
	writeStore(store);
	return true;
}

export function getConfigFilePath(): string {
	return configFilePath();
}

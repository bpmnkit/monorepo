import { readFileSync } from "node:fs"
import { homedir, platform } from "node:os"
import { join } from "node:path"
import type { CamundaClientInput } from "@bpmnkit/api"
import type { Profile } from "./profile.js"

// ─── Camunda Modeler connection shape (partial — only fields we care about) ──

interface ModelerConnection {
	id?: unknown
	name?: unknown
	contactPoint?: unknown
	targetType?: unknown
	authType?: unknown
	camundaCloudClientId?: unknown
	camundaCloudClientSecret?: unknown
	bearerToken?: unknown
	tokenUrl?: unknown
	clientId?: unknown
	clientSecret?: unknown
	audience?: unknown
	username?: unknown
	password?: unknown
}

// ─── Modeler config directory ─────────────────────────────────────────────────

function modelerConfigDir(): string {
	const p = platform()
	if (p === "win32") return join(process.env.APPDATA ?? homedir(), "camunda-modeler")
	if (p === "darwin") return join(homedir(), "Library", "Application Support", "camunda-modeler")
	return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "camunda-modeler")
}

// ─── Auth mapping ─────────────────────────────────────────────────────────────

function toAuth(conn: ModelerConnection): CamundaClientInput["auth"] {
	const targetType = typeof conn.targetType === "string" ? conn.targetType : ""
	const authType = typeof conn.authType === "string" ? conn.authType : ""

	// Camunda Cloud (SaaS): use OAuth2 with cloud token endpoint when credentials present
	if (
		targetType === "camundaCloud" &&
		typeof conn.camundaCloudClientId === "string" &&
		conn.camundaCloudClientId &&
		typeof conn.camundaCloudClientSecret === "string" &&
		conn.camundaCloudClientSecret
	) {
		return {
			type: "oauth2",
			clientId: conn.camundaCloudClientId,
			clientSecret: conn.camundaCloudClientSecret,
			tokenUrl: "https://login.cloud.camunda.io/oauth/token",
			audience: "zeebe.camunda.io",
		}
	}

	// Self-managed OAuth2
	if (
		(authType === "clientCredentials" || authType === "oauth2") &&
		typeof conn.clientId === "string" &&
		conn.clientId &&
		typeof conn.clientSecret === "string" &&
		conn.clientSecret
	) {
		return {
			type: "oauth2",
			clientId: conn.clientId,
			clientSecret: conn.clientSecret,
			tokenUrl: typeof conn.tokenUrl === "string" ? conn.tokenUrl : "",
			audience: typeof conn.audience === "string" ? conn.audience : undefined,
		}
	}

	// Bearer token
	if (authType === "bearer" && typeof conn.bearerToken === "string" && conn.bearerToken) {
		return { type: "bearer", token: conn.bearerToken }
	}

	// Basic auth
	if (
		authType === "basic" &&
		typeof conn.username === "string" &&
		conn.username &&
		typeof conn.password === "string"
	) {
		return { type: "basic", username: conn.username, password: conn.password }
	}

	return { type: "none" }
}

function toProfile(conn: ModelerConnection): Profile | null {
	const name = typeof conn.name === "string" && conn.name ? conn.name : null
	if (!name) return null

	const baseUrl =
		typeof conn.contactPoint === "string" && conn.contactPoint ? conn.contactPoint : undefined

	return {
		name,
		apiType: "c8",
		config: { baseUrl, auth: toAuth(conn) },
		createdAt: null,
		source: "modeler",
	}
}

// ─── Public ───────────────────────────────────────────────────────────────────

export function listModelerProfiles(): Profile[] {
	try {
		const raw = readFileSync(join(modelerConfigDir(), "settings.json"), "utf8")
		const settings: unknown = JSON.parse(raw)
		if (!settings || typeof settings !== "object") return []

		const connections = (settings as Record<string, unknown>)[
			"connectionManagerPlugin.c8connections"
		]
		if (!Array.isArray(connections)) return []

		const profiles: Profile[] = []
		for (const conn of connections) {
			if (!conn || typeof conn !== "object") continue
			const profile = toProfile(conn as ModelerConnection)
			if (profile) profiles.push(profile)
		}
		return profiles
	} catch {
		return []
	}
}

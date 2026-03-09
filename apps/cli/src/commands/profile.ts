import { readFileSync } from "node:fs"
import type { AuthConfig, CamundaClientInput } from "@bpmn-sdk/api"
import {
	deleteProfile,
	getActiveName,
	getActiveProfile,
	getConfigFilePath,
	getProfile,
	listProfiles,
	saveProfile,
	useProfile,
} from "../profile.js"
import type { ApiType } from "../profile.js"
import type { CommandGroup, FlagSpec } from "../types.js"

const API_TYPE_FLAG: FlagSpec = {
	name: "api-type",
	description: "API type: c8 (default) or admin",
	type: "string",
	default: "c8",
	placeholder: "TYPE",
}

const AUTH_FLAGS: FlagSpec[] = [
	{
		name: "base-url",
		description: "API base URL",
		type: "string",
		required: true,
		placeholder: "URL",
	},
	{
		name: "auth-type",
		description: "Authentication type: bearer|oauth2|basic|none",
		type: "string",
		required: true,
		placeholder: "TYPE",
	},
	{
		name: "token",
		description: "Bearer token (auth-type=bearer)",
		type: "string",
		placeholder: "TOKEN",
	},
	{ name: "client-id", description: "OAuth2 client ID", type: "string", placeholder: "ID" },
	{
		name: "client-secret",
		description: "OAuth2 client secret",
		type: "string",
		placeholder: "SECRET",
	},
	{
		name: "token-url",
		description: "OAuth2 token endpoint URL",
		type: "string",
		placeholder: "URL",
	},
	{
		name: "audience",
		description: "OAuth2 audience (auth-type=oauth2, default: zeebe.camunda.io)",
		type: "string",
		placeholder: "AUDIENCE",
	},
	{ name: "username", description: "Basic auth username", type: "string", placeholder: "USER" },
	{ name: "password", description: "Basic auth password", type: "string", placeholder: "PASS" },
]

// ─── Camunda Cloud credentials file parser ────────────────────────────────────

/** Parse a shell file of `export KEY='VALUE'` lines into a key-value map. */
function parseEnvFile(content: string): Record<string, string> {
	const result: Record<string, string> = {}
	for (const line of content.split("\n")) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("#")) continue
		const match = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)/)
		if (!match) continue
		const key = match[1] ?? ""
		let value = (match[2] ?? "").trim()
		if (
			(value.startsWith("'") && value.endsWith("'")) ||
			(value.startsWith('"') && value.endsWith('"'))
		) {
			value = value.slice(1, -1)
		}
		result[key] = value
	}
	return result
}

/** Detect the API type from a parsed env map. Returns "admin" if Console vars present, else "c8". */
function detectApiType(env: Record<string, string>): ApiType {
	return env.CAMUNDA_CONSOLE_CLIENT_ID || env.CAMUNDA_CONSOLE_BASE_URL ? "admin" : "c8"
}

/** Build a CamundaClientInput from a Camunda Console (Admin API) env map. */
function configFromConsoleEnv(env: Record<string, string>): CamundaClientInput {
	const baseUrl = env.CAMUNDA_CONSOLE_BASE_URL
	if (!baseUrl) {
		throw new Error(
			"CAMUNDA_CONSOLE_BASE_URL not found in credentials file. " +
				"Make sure you are using a Camunda Console credentials export.",
		)
	}

	const clientId = env.CAMUNDA_CONSOLE_CLIENT_ID ?? ""
	const clientSecret = env.CAMUNDA_CONSOLE_CLIENT_SECRET ?? ""
	const tokenUrl = env.CAMUNDA_OAUTH_URL ?? ""
	const audience = env.CAMUNDA_CONSOLE_OAUTH_AUDIENCE ?? ""

	if (!clientId || !clientSecret || !tokenUrl) {
		throw new Error(
			"Missing required credentials. Expected: " +
				"CAMUNDA_CONSOLE_CLIENT_ID, CAMUNDA_CONSOLE_CLIENT_SECRET, CAMUNDA_OAUTH_URL.",
		)
	}

	return { baseUrl, auth: { type: "oauth2", clientId, clientSecret, tokenUrl, audience } }
}

/** Build a CamundaClientInput from a parsed Camunda Cloud credentials env map. */
function configFromCloudEnv(env: Record<string, string>): CamundaClientInput {
	const restAddress = env.ZEEBE_REST_ADDRESS
	if (!restAddress) {
		throw new Error(
			"ZEEBE_REST_ADDRESS not found in credentials file. " +
				"Make sure you are using a Camunda Cloud credentials export.",
		)
	}
	const baseUrl = restAddress.endsWith("/v2") ? restAddress : `${restAddress}/v2`

	const clientId = env.CAMUNDA_CLIENT_ID ?? env.ZEEBE_CLIENT_ID ?? ""
	const clientSecret = env.CAMUNDA_CLIENT_SECRET ?? env.ZEEBE_CLIENT_SECRET ?? ""
	const tokenUrl = env.CAMUNDA_OAUTH_URL ?? env.ZEEBE_AUTHORIZATION_SERVER_URL ?? ""
	const audience = env.CAMUNDA_TOKEN_AUDIENCE ?? "zeebe.camunda.io"

	if (!clientId || !clientSecret || !tokenUrl) {
		throw new Error(
			"Missing required credentials. Expected: " +
				"CAMUNDA_CLIENT_ID (or ZEEBE_CLIENT_ID), " +
				"CAMUNDA_CLIENT_SECRET (or ZEEBE_CLIENT_SECRET), " +
				"CAMUNDA_OAUTH_URL (or ZEEBE_AUTHORIZATION_SERVER_URL).",
		)
	}

	return { baseUrl, auth: { type: "oauth2", clientId, clientSecret, tokenUrl, audience } }
}

/** Read all of stdin as a string. */
function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = ""
		process.stdin.setEncoding("utf8")
		process.stdin.on("data", (chunk: string) => {
			data += chunk
		})
		process.stdin.on("end", () => resolve(data))
		process.stdin.on("error", reject)
	})
}

// ─── Auth builder ─────────────────────────────────────────────────────────────

function buildAuth(flags: Record<string, string | boolean | number>): AuthConfig {
	const type = flags["auth-type"] as string
	switch (type) {
		case "bearer": {
			const token = flags.token as string | undefined
			if (!token) throw new Error("--token is required for --auth-type bearer")
			return { type: "bearer", token }
		}
		case "oauth2": {
			const clientId = flags["client-id"] as string | undefined
			const clientSecret = flags["client-secret"] as string | undefined
			const tokenUrl = flags["token-url"] as string | undefined
			if (!clientId || !clientSecret || !tokenUrl) {
				throw new Error(
					"--client-id, --client-secret, and --token-url are required for --auth-type oauth2",
				)
			}
			const audience = (flags.audience as string | undefined) ?? "zeebe.camunda.io"
			return { type: "oauth2", clientId, clientSecret, tokenUrl, audience }
		}
		case "basic": {
			const username = flags.username as string | undefined
			const password = flags.password as string | undefined
			if (!username || !password)
				throw new Error("--username and --password are required for --auth-type basic")
			return { type: "basic", username, password }
		}
		case "none":
			return { type: "none" }
		default:
			throw new Error(`Unknown --auth-type "${type}". Valid: bearer|oauth2|basic|none`)
	}
}

export const profileGroup: CommandGroup = {
	name: "profile",
	description: "Manage connection profiles",
	commands: [
		{
			name: "create",
			description: "Create or update a profile",
			args: [{ name: "name", description: "Profile name", required: true }],
			flags: [API_TYPE_FLAG, ...AUTH_FLAGS],
			examples: [
				{
					description: "Bearer token profile",
					command:
						"casen profile create local --base-url http://localhost:8080/v2 --auth-type bearer --token my-token",
				},
				{
					description: "OAuth2 profile for Camunda SaaS",
					command:
						"casen profile create prod --base-url https://cluster.camunda.io/v2 --auth-type oauth2 --client-id id --client-secret secret --token-url https://login.cloud.camunda.io/oauth/token",
				},
				{
					description: "Admin API profile",
					command:
						"casen profile create admin-prod --api-type admin --base-url https://api.cloud.camunda.io --auth-type oauth2 --client-id id --client-secret secret --token-url https://login.cloud.camunda.io/oauth/token",
				},
			],
			async run(ctx) {
				const name = ctx.positional[0]
				if (!name) throw new Error("Missing required argument: <name>")
				const baseUrl = ctx.flags["base-url"] as string | undefined
				if (!baseUrl) throw new Error("--base-url is required")
				const auth = buildAuth(ctx.flags)
				const rawApiType = (ctx.flags["api-type"] as string | undefined) ?? "c8"
				const apiType: ApiType = rawApiType === "admin" ? "admin" : "c8"
				const config: CamundaClientInput = { baseUrl, auth }
				saveProfile(name, config, apiType)
				ctx.output.ok(`Profile "${name}" saved [${apiType}] (${getConfigFilePath()})`)
			},
		},
		{
			name: "list",
			aliases: ["ls"],
			description: "List all profiles",
			examples: [{ description: "List profiles", command: "casen profile list" }],
			async run(ctx) {
				const profiles = listProfiles()
				const active = getActiveName()
				if (profiles.length === 0) {
					ctx.output.info("No profiles. Create one with: casen profile create <name> ...")
					return
				}
				ctx.output.printList(
					{
						items: profiles.map((p) => ({
							active: p.name === active ? "●" : " ",
							name: p.name,
							apiType: p.apiType,
							baseUrl: p.config.baseUrl ?? "(from env/file)",
							authType: (p.config.auth as { type?: string } | undefined)?.type ?? "—",
						})),
					},
					[
						{ key: "active", header: " " },
						{ key: "name", header: "NAME" },
						{ key: "apiType", header: "API" },
						{ key: "baseUrl", header: "BASE URL", maxWidth: 50 },
						{ key: "authType", header: "AUTH TYPE" },
					],
				)
			},
		},
		{
			name: "use",
			description: "Switch the active profile",
			args: [{ name: "name", description: "Profile name", required: true }],
			examples: [
				{ description: "Activate production profile", command: "casen profile use production" },
			],
			async run(ctx) {
				const name = ctx.positional[0]
				if (!name) throw new Error("Missing required argument: <name>")
				if (!useProfile(name)) {
					throw new Error(
						`Profile "${name}" not found. Run \`casen profile list\` to see available profiles.`,
					)
				}
				ctx.output.ok(`Now using profile "${name}"`)
			},
		},
		{
			name: "show",
			description: "Show profile details",
			args: [{ name: "name", description: "Profile name (defaults to active)", required: false }],
			examples: [
				{ description: "Show active profile", command: "casen profile show" },
				{ description: "Show specific profile", command: "casen profile show production" },
			],
			async run(ctx) {
				const name = ctx.positional[0]
				const profile = name ? getProfile(name) : getActiveProfile()
				if (!profile) {
					throw new Error(
						name
							? `Profile "${name}" not found.`
							: "No active profile. Create one with: casen profile create <name> ...",
					)
				}
				const active = getActiveName()
				const isActive = profile.name === active
				ctx.output.info(`Profile: ${profile.name}${isActive ? " (active)" : ""}`)
				ctx.output.printItem(profile.config)
			},
		},
		{
			name: "import",
			description:
				"Import a profile from a Camunda Cloud or Console credentials file (auto-detected)",
			args: [
				{ name: "name", description: "Profile name", required: true },
				{
					name: "file",
					description: "Path to credentials file (use - for stdin)",
					required: true,
				},
			],
			examples: [
				{
					description: "Import C8 credentials",
					command: "casen profile import prod ./camunda-credentials.sh",
				},
				{
					description: "Import Admin API credentials",
					command: "casen profile import admin ./console-credentials.sh",
				},
				{
					description: "Import from stdin",
					command: "cat credentials.sh | casen profile import prod -",
				},
			],
			async run(ctx) {
				const name = ctx.positional[0]
				if (!name) throw new Error("Missing required argument: <name>")
				const filePath = ctx.positional[1]
				if (!filePath) throw new Error("Missing required argument: <file>")
				const content = filePath === "-" ? await readStdin() : readFileSync(filePath, "utf8")
				const env = parseEnvFile(content)
				const apiType = detectApiType(env)
				const config = apiType === "admin" ? configFromConsoleEnv(env) : configFromCloudEnv(env)
				saveProfile(name, config, apiType)
				ctx.output.ok(`Profile "${name}" imported [${apiType}] (${getConfigFilePath()})`)
				ctx.output.info(`baseUrl: ${config.baseUrl ?? ""}`)
			},
		},
		{
			name: "delete",
			aliases: ["rm"],
			description: "Delete a profile",
			args: [{ name: "name", description: "Profile name", required: true }],
			examples: [{ description: "Delete a profile", command: "casen profile delete old-profile" }],
			async run(ctx) {
				const name = ctx.positional[0]
				if (!name) throw new Error("Missing required argument: <name>")
				if (!deleteProfile(name)) {
					throw new Error(`Profile "${name}" not found.`)
				}
				ctx.output.ok(`Deleted profile "${name}"`)
			},
		},
	],
}

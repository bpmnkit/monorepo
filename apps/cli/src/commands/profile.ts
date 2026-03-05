import type { CamundaClientInput } from "@bpmn-sdk/api";
import type { AuthConfig } from "@bpmn-sdk/api";
import {
	deleteProfile,
	getActiveName,
	getActiveProfile,
	getConfigFilePath,
	getProfile,
	listProfiles,
	saveProfile,
	useProfile,
} from "../profile.js";
import type { CommandGroup, FlagSpec } from "../types.js";

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
	{ name: "username", description: "Basic auth username", type: "string", placeholder: "USER" },
	{ name: "password", description: "Basic auth password", type: "string", placeholder: "PASS" },
];

function buildAuth(flags: Record<string, string | boolean | number>): AuthConfig {
	const type = flags["auth-type"] as string;
	switch (type) {
		case "bearer": {
			const token = flags.token as string | undefined;
			if (!token) throw new Error("--token is required for --auth-type bearer");
			return { type: "bearer", token };
		}
		case "oauth2": {
			const clientId = flags["client-id"] as string | undefined;
			const clientSecret = flags["client-secret"] as string | undefined;
			const tokenUrl = flags["token-url"] as string | undefined;
			if (!clientId || !clientSecret || !tokenUrl) {
				throw new Error(
					"--client-id, --client-secret, and --token-url are required for --auth-type oauth2",
				);
			}
			return { type: "oauth2", clientId, clientSecret, tokenUrl };
		}
		case "basic": {
			const username = flags.username as string | undefined;
			const password = flags.password as string | undefined;
			if (!username || !password)
				throw new Error("--username and --password are required for --auth-type basic");
			return { type: "basic", username, password };
		}
		case "none":
			return { type: "none" };
		default:
			throw new Error(`Unknown --auth-type "${type}". Valid: bearer|oauth2|basic|none`);
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
			flags: AUTH_FLAGS,
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
			],
			async run(ctx) {
				const name = ctx.positional[0];
				if (!name) throw new Error("Missing required argument: <name>");
				const baseUrl = ctx.flags["base-url"] as string | undefined;
				if (!baseUrl) throw new Error("--base-url is required");
				const auth = buildAuth(ctx.flags);
				const config: CamundaClientInput = { baseUrl, auth };
				saveProfile(name, config);
				ctx.output.ok(`Profile "${name}" saved (${getConfigFilePath()})`);
			},
		},
		{
			name: "list",
			aliases: ["ls"],
			description: "List all profiles",
			examples: [{ description: "List profiles", command: "casen profile list" }],
			async run(ctx) {
				const profiles = listProfiles();
				const active = getActiveName();
				if (profiles.length === 0) {
					ctx.output.info("No profiles. Create one with: casen profile create <name> ...");
					return;
				}
				ctx.output.printList(
					{
						items: profiles.map((p) => ({
							active: p.name === active ? "●" : " ",
							name: p.name,
							baseUrl: p.config.baseUrl ?? "(from env/file)",
							authType: (p.config.auth as { type?: string } | undefined)?.type ?? "—",
						})),
					},
					[
						{ key: "active", header: " " },
						{ key: "name", header: "NAME" },
						{ key: "baseUrl", header: "BASE URL", maxWidth: 50 },
						{ key: "authType", header: "AUTH TYPE" },
					],
				);
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
				const name = ctx.positional[0];
				if (!name) throw new Error("Missing required argument: <name>");
				if (!useProfile(name)) {
					throw new Error(
						`Profile "${name}" not found. Run \`casen profile list\` to see available profiles.`,
					);
				}
				ctx.output.ok(`Now using profile "${name}"`);
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
				const name = ctx.positional[0];
				const profile = name ? getProfile(name) : getActiveProfile();
				if (!profile) {
					throw new Error(
						name
							? `Profile "${name}" not found.`
							: "No active profile. Create one with: casen profile create <name> ...",
					);
				}
				const active = getActiveName();
				const isActive = profile.name === active;
				ctx.output.info(`Profile: ${profile.name}${isActive ? " (active)" : ""}`);
				ctx.output.printItem(profile.config);
			},
		},
		{
			name: "delete",
			aliases: ["rm"],
			description: "Delete a profile",
			args: [{ name: "name", description: "Profile name", required: true }],
			examples: [{ description: "Delete a profile", command: "casen profile delete old-profile" }],
			async run(ctx) {
				const name = ctx.positional[0];
				if (!name) throw new Error("Missing required argument: <name>");
				if (!deleteProfile(name)) {
					throw new Error(`Profile "${name}" not found.`);
				}
				ctx.output.ok(`Deleted profile "${name}"`);
			},
		},
	],
};

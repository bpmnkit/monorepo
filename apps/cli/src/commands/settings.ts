import {
	clearAuditLog,
	getActiveName,
	getAuditLog,
	getSettings,
	saveSettings,
} from "@bpmnkit/profiles"
import type { CommandGroup } from "../types.js"

export const settingsGroup: CommandGroup = {
	name: "settings",
	description: "Manage CLI settings and audit log",
	commands: [
		{
			name: "show",
			description: "Show current settings",
			examples: [{ description: "Show settings", command: "casen settings show" }],
			async run(ctx) {
				const settings = getSettings()
				ctx.output.info(`audit-log-size:  ${settings.auditLogSize}`)
			},
		},
		{
			name: "set",
			description: "Change a setting",
			args: [
				{
					name: "key",
					description: "Setting name: audit-log-size",
					required: true,
					enum: ["audit-log-size"],
				},
				{ name: "value", description: "New value", required: true },
			],
			examples: [
				{ description: "Keep last 25 actions", command: "casen settings set audit-log-size 25" },
				{ description: "Disable audit log", command: "casen settings set audit-log-size 0" },
			],
			async run(ctx) {
				const key = ctx.positional[0]
				const rawValue = ctx.positional[1]
				if (!key) throw new Error("Missing required argument: <key>")
				if (rawValue === undefined) throw new Error("Missing required argument: <value>")
				if (key === "audit-log-size") {
					const n = Number(rawValue)
					if (Number.isNaN(n) || n < 0)
						throw new Error("audit-log-size must be a non-negative integer")
					saveSettings({ auditLogSize: Math.floor(n) })
					ctx.output.ok(`audit-log-size = ${Math.floor(n)}`)
				} else {
					throw new Error(`Unknown setting: "${key}". Valid: audit-log-size`)
				}
			},
		},
		{
			name: "audit-log",
			aliases: ["log"],
			description: "Show the audit log for the active (or specified) profile",
			flags: [
				{ name: "profile", description: "Profile name (defaults to active)", type: "string" },
				{ name: "limit", description: "Max entries to show (default: all)", type: "number" },
			],
			columns: [
				{ key: "timestamp", header: "TIME", maxWidth: 24 },
				{ key: "profile", header: "PROFILE", maxWidth: 20 },
				{ key: "command", header: "COMMAND", maxWidth: 40 },
				{ key: "status", header: "STATUS", maxWidth: 8 },
			],
			examples: [
				{ description: "Show audit log for active profile", command: "casen settings audit-log" },
				{
					description: "Show audit log for a specific profile",
					command: "casen settings audit-log --profile prod",
				},
			],
			async run(ctx) {
				const profileFilter =
					(ctx.flags.profile as string | undefined) ?? getActiveName() ?? undefined
				const limit = ctx.flags.limit as number | undefined
				const entries = getAuditLog(profileFilter)
				const display = limit !== undefined && limit > 0 ? entries.slice(-limit) : entries
				if (display.length === 0) {
					ctx.output.info(
						profileFilter
							? `No audit log entries for profile "${profileFilter}".`
							: "No audit log entries.",
					)
					return
				}
				ctx.output.printList(
					{
						items: display.map((e) => ({
							timestamp: e.timestamp.replace("T", " ").slice(0, 19),
							profile: profileFilter ?? "(all)",
							command: `${e.group} ${e.command}${e.positional.length ? ` ${e.positional.join(" ")}` : ""}`,
							status: e.status,
						})),
					},
					[
						{ key: "timestamp", header: "TIME", maxWidth: 20 },
						{ key: "profile", header: "PROFILE", maxWidth: 20 },
						{ key: "command", header: "COMMAND", maxWidth: 50 },
						{ key: "status", header: "STATUS", maxWidth: 8 },
					],
				)
			},
		},
		{
			name: "audit-log-clear",
			aliases: ["log-clear"],
			description: "Clear the audit log for the active (or specified) profile",
			flags: [
				{
					name: "profile",
					description: "Profile name to clear (defaults to active; use --all to clear all)",
					type: "string",
				},
				{
					name: "all",
					description: "Clear audit log for all profiles",
					type: "boolean",
					default: false,
				},
			],
			examples: [
				{
					description: "Clear audit log for active profile",
					command: "casen settings audit-log-clear",
				},
				{
					description: "Clear all audit logs",
					command: "casen settings audit-log-clear --all",
				},
			],
			async run(ctx) {
				const clearAll = ctx.flags.all === true
				if (clearAll) {
					clearAuditLog()
					ctx.output.ok("Cleared audit log for all profiles")
					return
				}
				const profileName =
					(ctx.flags.profile as string | undefined) ?? getActiveName() ?? undefined
				clearAuditLog(profileName)
				ctx.output.ok(
					profileName ? `Cleared audit log for profile "${profileName}"` : "Cleared audit log",
				)
			},
		},
	],
}

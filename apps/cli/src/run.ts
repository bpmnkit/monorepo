import type { RawResponseEvent } from "@bpmnkit/api"
import {
	appendAuditEntry,
	createAdminClientFromProfile,
	createClientFromProfile,
	getActiveName,
	getProfile,
} from "@bpmnkit/profiles"
import { parseArgs } from "./args.js"
import { commandGroups } from "./commands/index.js"
import { getRuntimeCompletions } from "./completion.js"
import { printCommandHelp, printGlobalHelp, printGroupHelp, printVersion } from "./help.js"
import { createNullWriter, createOutputWriter, printRawResponse } from "./output.js"
import { runProfileManager } from "./profile-tui.js"
import { runSettingsManager } from "./settings-tui.js"
import { runAskTui, runGroupTui, runMainTui } from "./tui.js"
import type { OutputFormat, RunContext } from "./types.js"

// ─── Profile info ─────────────────────────────────────────────────────────────

function buildProfileInfo(profileName: string | undefined): {
	name: string
	info: Array<{ key: string; value: string }>
} {
	const effectiveName = profileName ?? getActiveName() ?? "none"
	const p = profileName ? getProfile(profileName) : getProfile(effectiveName)
	if (!p) return { name: effectiveName, info: [{ key: "status", value: "profile not found" }] }
	const info: Array<{ key: string; value: string }> = [
		{ key: "name", value: p.name },
		{ key: "apiType", value: p.apiType },
		{ key: "baseUrl", value: p.config.baseUrl ?? "(default)" },
		{ key: "createdAt", value: p.createdAt ?? "unknown" },
	]
	const auth = p.config.auth
	if (auth) {
		info.push({ key: "auth.type", value: auth.type })
		if (auth.type === "bearer") {
			info.push({ key: "auth.token", value: "***" })
		} else if (auth.type === "oauth2") {
			info.push({ key: "auth.clientId", value: auth.clientId })
			info.push({ key: "auth.clientSecret", value: "***" })
			info.push({ key: "auth.tokenUrl", value: auth.tokenUrl })
			if (auth.scope) info.push({ key: "auth.scope", value: auth.scope })
		} else if (auth.type === "basic") {
			info.push({ key: "auth.username", value: auth.username })
			info.push({ key: "auth.password", value: "***" })
		}
	}
	return { name: effectiveName, info }
}

// ─── Error display ────────────────────────────────────────────────────────────

function printError(msg: string, colors: boolean): void {
	const red = colors ? "\x1b[31m" : ""
	const reset = colors ? "\x1b[0m" : ""
	process.stderr.write(`${red}error${reset}: ${msg}\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(argv: string[]): Promise<void> {
	// ── Completion protocol ───────────────────────────────────────────────────
	// casen --complete <cursorWordIndex> -- <words...>
	const completeIdx = argv.indexOf("--complete")
	if (completeIdx !== -1) {
		const cursorIdx = Number(argv[completeIdx + 1] ?? "0")
		const dashDash = argv.indexOf("--", completeIdx + 2)
		const words = dashDash >= 0 ? argv.slice(dashDash + 1) : []
		const suggestions = getRuntimeCompletions(commandGroups, cursorIdx, words)
		process.stdout.write(`${suggestions.join("\n")}\n`)
		return
	}

	// ── Global parse ──────────────────────────────────────────────────────────
	const { positional, flags } = parseArgs(argv)

	const noColor = flags["no-color"] === true
	const colors = !noColor && process.stdout.isTTY === true && !process.env.NO_COLOR
	const wantVersion = flags.version === true || flags.v === true
	const wantHelp = flags.help === true || flags.h === true

	if (wantVersion) {
		printVersion()
		return
	}

	const outputFormat = (flags.output ?? flags.o ?? "table") as OutputFormat
	const profileName = (flags.profile as string | undefined) ?? (flags.p as string | undefined)

	// ── Top-level: main menu TUI or help ─────────────────────────────────────
	if (positional.length === 0) {
		if (wantHelp) {
			printGlobalHelp(commandGroups, colors)
		} else {
			const { name: pName, info: pInfo } = buildProfileInfo(profileName)
			await runMainTui(
				commandGroups,
				() => Promise.resolve(createClientFromProfile(profileName)),
				() => Promise.resolve(createAdminClientFromProfile(profileName)),
				{ profile: pName, profileInfo: pInfo },
			)
		}
		return
	}

	const getClient = () => Promise.resolve(createClientFromProfile(profileName))
	const getAdminClient = () => Promise.resolve(createAdminClientFromProfile(profileName))

	// ── Find group ────────────────────────────────────────────────────────────
	const groupToken = positional[0] ?? ""
	const group = commandGroups.find((g) => g.name === groupToken || g.aliases?.includes(groupToken))

	if (!group) {
		printError(
			`Unknown resource: "${groupToken}". Run \`casen --help\` to see all resources.`,
			colors,
		)
		process.exitCode = 1
		return
	}

	// ── ask: join remaining positionals as the query ─────────────────────────
	if (group.name === "ask" && positional.length >= 2 && !wantHelp) {
		const queryWords = positional.slice(1)
		const output = createOutputWriter(
			(flags.output ?? flags.o ?? "table") as OutputFormat,
			flags["no-color"] === true,
		)
		const ctx: RunContext = {
			positional: queryWords,
			flags,
			output,
			getClient: () => Promise.resolve(createClientFromProfile(profileName)),
			getAdminClient: () => Promise.resolve(createAdminClientFromProfile(profileName)),
		}
		const cmd = group.commands[0]
		if (cmd) await cmd.run(ctx)
		return
	}

	// ── TUI (no subcommand, no --help) ───────────────────────────────────────
	if (positional.length === 1 && !wantHelp) {
		if (group.name === "ask") {
			const { name: pName, info: pInfo } = buildProfileInfo(profileName)
			await runAskTui(commandGroups, getClient, getAdminClient, {
				profile: pName,
				profileInfo: pInfo,
			})
		} else if (group.name === "profile") {
			await runProfileManager()
		} else if (group.name === "settings") {
			await runSettingsManager()
		} else if (group.name !== "completion") {
			const { name: pName, info: pInfo } = buildProfileInfo(profileName)
			await runGroupTui(group, commandGroups, getClient, getAdminClient, {
				profile: pName,
				profileInfo: pInfo,
			})
		} else {
			printGroupHelp(group, colors)
		}
		return
	}

	// ── Group-level help ──────────────────────────────────────────────────────
	if (positional.length === 1 || (wantHelp && positional.length === 1)) {
		printGroupHelp(group, colors)
		return
	}

	// ── Find command ──────────────────────────────────────────────────────────
	const cmdToken = positional[1] ?? ""
	const cmd = group.commands.find((c) => c.name === cmdToken || c.aliases?.includes(cmdToken))

	if (!cmd) {
		printError(
			`Unknown command: "${group.name} ${cmdToken}". Run \`casen ${group.name} --help\` to see available commands.`,
			colors,
		)
		process.exitCode = 1
		return
	}

	// ── Command-level help ────────────────────────────────────────────────────
	if (wantHelp) {
		printCommandHelp(group, cmd, colors)
		return
	}

	// ── Execute ───────────────────────────────────────────────────────────────
	const isRaw = flags.raw === true
	const effectiveProfile = profileName ?? getActiveName() ?? "default"

	// Redact secret-looking flag values before storing in audit log
	const SECRET_FLAG_RE = /secret|password|token/i
	const auditFlags: Record<string, string | boolean | number> = {}
	for (const [k, v] of Object.entries(flags)) {
		auditFlags[k] = SECRET_FLAG_RE.test(k) ? "***" : v
	}
	const auditPositional = positional.slice(2)

	// Wrap client factories to capture the last raw HTTP response
	// Typed as array to prevent TypeScript's control-flow narrowing from collapsing to never
	const rawCaptureRef: [RawResponseEvent | null] = [null]
	const instrumentedGetClient = () => {
		const client = createClientFromProfile(profileName)
		client.on("rawResponse", (evt) => {
			rawCaptureRef[0] = evt
		})
		return Promise.resolve(client)
	}
	const instrumentedGetAdminClient = () => {
		const client = createAdminClientFromProfile(profileName)
		client.on("rawResponse", (evt) => {
			rawCaptureRef[0] = evt
		})
		return Promise.resolve(client)
	}

	const output = isRaw ? createNullWriter() : createOutputWriter(outputFormat, noColor)
	const ctx: RunContext = {
		positional: auditPositional,
		flags,
		output,
		getClient: instrumentedGetClient,
		getAdminClient: instrumentedGetAdminClient,
	}

	try {
		await cmd.run(ctx)
		appendAuditEntry(effectiveProfile, {
			group: group.name,
			command: cmd.name,
			positional: auditPositional,
			flags: auditFlags,
			status: "ok",
		})
		const capture = rawCaptureRef[0]
		if (isRaw && capture) {
			printRawResponse(capture, noColor)
		} else if (capture) {
			// Always show status code in normal mode
			const statusFn =
				capture.status >= 200 && capture.status < 300
					? (s: string) => `\x1b[32m${s}\x1b[39m`
					: (s: string) => `\x1b[31m${s}\x1b[39m`
			const statusStr = colors ? statusFn(`HTTP ${capture.status}`) : `HTTP ${capture.status}`
			process.stdout.write(`\n${statusStr}\n`)
		}
	} catch (err) {
		const capture = rawCaptureRef[0]
		if (isRaw && capture) {
			printRawResponse(capture, noColor)
		}
		const msg = err instanceof Error ? err.message : String(err)
		appendAuditEntry(effectiveProfile, {
			group: group.name,
			command: cmd.name,
			positional: auditPositional,
			flags: auditFlags,
			status: "error",
			error: msg,
		})
		printError(msg, colors)
		if (flags.debug) {
			process.stderr.write(`\n${String(err)}\n`)
		}
		process.exitCode = 1
	}
}

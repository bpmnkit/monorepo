import { parseArgs } from "./args.js";
import { createClientFromProfile } from "./client.js";
import { commandGroups } from "./commands/index.js";
import { getRuntimeCompletions } from "./completion.js";
import { printCommandHelp, printGlobalHelp, printGroupHelp, printVersion } from "./help.js";
import { createOutputWriter } from "./output.js";
import { runProfileManager } from "./profile-tui.js";
import { runGroupTui, runMainTui } from "./tui.js";
import type { OutputFormat, RunContext } from "./types.js";

// ─── Error display ────────────────────────────────────────────────────────────

function printError(msg: string, colors: boolean): void {
	const red = colors ? "\x1b[31m" : "";
	const reset = colors ? "\x1b[0m" : "";
	process.stderr.write(`${red}error${reset}: ${msg}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(argv: string[]): Promise<void> {
	// ── Completion protocol ───────────────────────────────────────────────────
	// casen --complete <cursorWordIndex> -- <words...>
	const completeIdx = argv.indexOf("--complete");
	if (completeIdx !== -1) {
		const cursorIdx = Number(argv[completeIdx + 1] ?? "0");
		const dashDash = argv.indexOf("--", completeIdx + 2);
		const words = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
		const suggestions = getRuntimeCompletions(commandGroups, cursorIdx, words);
		process.stdout.write(`${suggestions.join("\n")}\n`);
		return;
	}

	// ── Global parse ──────────────────────────────────────────────────────────
	const { positional, flags } = parseArgs(argv);

	const noColor = flags["no-color"] === true;
	const colors = !noColor && process.stdout.isTTY === true && !process.env.NO_COLOR;
	const wantVersion = flags.version === true || flags.v === true;
	const wantHelp = flags.help === true || flags.h === true;

	if (wantVersion) {
		printVersion();
		return;
	}

	const outputFormat = (flags.output ?? flags.o ?? "table") as OutputFormat;
	const profileName = (flags.profile as string | undefined) ?? (flags.p as string | undefined);

	// ── Top-level: main menu TUI or help ─────────────────────────────────────
	if (positional.length === 0) {
		if (wantHelp) {
			printGlobalHelp(commandGroups, colors);
		} else {
			await runMainTui(commandGroups, () => Promise.resolve(createClientFromProfile(profileName)));
		}
		return;
	}

	// ── Find group ────────────────────────────────────────────────────────────
	const groupToken = positional[0] ?? "";
	const group = commandGroups.find((g) => g.name === groupToken || g.aliases?.includes(groupToken));

	if (!group) {
		printError(
			`Unknown resource: "${groupToken}". Run \`casen --help\` to see all resources.`,
			colors,
		);
		process.exitCode = 1;
		return;
	}

	// ── TUI (no subcommand, no --help) ───────────────────────────────────────
	if (positional.length === 1 && !wantHelp) {
		if (group.name === "profile") {
			await runProfileManager();
		} else if (group.name !== "completion") {
			await runGroupTui(group, commandGroups, () =>
				Promise.resolve(createClientFromProfile(profileName)),
			);
		} else {
			printGroupHelp(group, colors);
		}
		return;
	}

	// ── Group-level help ──────────────────────────────────────────────────────
	if (positional.length === 1 || (wantHelp && positional.length === 1)) {
		printGroupHelp(group, colors);
		return;
	}

	// ── Find command ──────────────────────────────────────────────────────────
	const cmdToken = positional[1] ?? "";
	const cmd = group.commands.find((c) => c.name === cmdToken || c.aliases?.includes(cmdToken));

	if (!cmd) {
		printError(
			`Unknown command: "${group.name} ${cmdToken}". Run \`casen ${group.name} --help\` to see available commands.`,
			colors,
		);
		process.exitCode = 1;
		return;
	}

	// ── Command-level help ────────────────────────────────────────────────────
	if (wantHelp) {
		printCommandHelp(group, cmd, colors);
		return;
	}

	// ── Execute ───────────────────────────────────────────────────────────────
	const output = createOutputWriter(outputFormat, noColor);
	const ctx: RunContext = {
		positional: positional.slice(2),
		flags,
		output,
		getClient: () => Promise.resolve(createClientFromProfile(profileName)),
	};

	try {
		await cmd.run(ctx);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		printError(msg, colors);
		if (flags.debug) {
			process.stderr.write(`\n${String(err)}\n`);
		}
		process.exitCode = 1;
	}
}

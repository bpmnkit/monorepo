import { readFileSync } from "node:fs"
import { bold, cyan, dim, green } from "./color.js"
import type { Command, CommandGroup, FlagSpec } from "./types.js"

const GLOBAL_FLAGS: FlagSpec[] = [
	{
		name: "profile",
		short: "p",
		description: "Profile to use",
		type: "string",
		placeholder: "NAME",
	},
	{
		name: "output",
		short: "o",
		description: "Output format: table|json|yaml",
		type: "string",
		default: "table",
		placeholder: "FORMAT",
	},
	{ name: "no-color", description: "Disable colored output", type: "boolean" },
	{ name: "debug", description: "Print debug information", type: "boolean" },
	{ name: "help", short: "h", description: "Show help for this command", type: "boolean" },
]

const VERSION: string = (() => {
	try {
		const url = new URL("../package.json", import.meta.url)
		const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string }
		return pkg.version ?? "unknown"
	} catch {
		return "unknown"
	}
})()
const BINARY = "casen"

export function printVersion(): void {
	process.stdout.write(`${BINARY} ${VERSION}\n`)
}

export function printGlobalHelp(groups: CommandGroup[], colors: boolean): void {
	process.stdout.write(`${bold(`${BINARY} — Camunda v2 REST API CLI`, colors)}\n\n`)
	process.stdout.write(`${bold("USAGE", colors)}\n`)
	process.stdout.write(`  ${BINARY} <resource> <command> [args] [flags]\n\n`)

	process.stdout.write(`${bold("RESOURCES", colors)}\n`)
	const maxName = groups.reduce((m, g) => Math.max(m, g.name.length), 0)
	for (const g of groups) {
		const aliases = g.aliases?.length ? dim(` (${g.aliases.join(", ")})`, colors) : ""
		process.stdout.write(`  ${cyan(g.name.padEnd(maxName), colors)}${aliases}  ${g.description}\n`)
	}

	process.stdout.write(`\n${bold("FLAGS", colors)}\n`)
	printFlags(GLOBAL_FLAGS, colors)

	process.stdout.write(`\n${bold("EXAMPLES", colors)}\n`)
	process.stdout.write(`  ${dim("# List active process instances", colors)}\n`)
	process.stdout.write(`  ${BINARY} process-instance list --filter '{"state":"ACTIVE"}'\n\n`)
	process.stdout.write(`  ${dim("# Switch profile", colors)}\n`)
	process.stdout.write(`  ${BINARY} profile use production\n\n`)
	process.stdout.write(`  ${dim("# Enable shell completions (zsh)", colors)}\n`)
	process.stdout.write(`  ${BINARY} completion zsh > ~/.zfunc/_casen\n\n`)

	process.stdout.write(
		`${dim(`Run \`${BINARY} <resource> --help\` for resource-level help.`, colors)}\n`,
	)
}

export function printGroupHelp(group: CommandGroup, colors: boolean): void {
	const aliases = group.aliases?.length ? ` (${group.aliases.join(", ")})` : ""
	process.stdout.write(
		`${bold(`${BINARY} ${group.name}`, colors)}${aliases} — ${group.description}\n\n`,
	)
	process.stdout.write(`${bold("USAGE", colors)}\n`)
	process.stdout.write(`  ${BINARY} ${group.name} <command> [args] [flags]\n\n`)

	process.stdout.write(`${bold("COMMANDS", colors)}\n`)
	const maxName = group.commands.reduce((m, c) => Math.max(m, c.name.length), 0)
	for (const cmd of group.commands) {
		const aliases = cmd.aliases?.length ? dim(` (${cmd.aliases.join(", ")})`, colors) : ""
		process.stdout.write(
			`  ${cyan(cmd.name.padEnd(maxName), colors)}${aliases}  ${cmd.description}\n`,
		)
	}

	process.stdout.write(`\n${bold("FLAGS", colors)}\n`)
	printFlags(GLOBAL_FLAGS, colors)

	process.stdout.write(
		`\n${dim(`Run \`${BINARY} ${group.name} <command> --help\` for command details.`, colors)}\n`,
	)
}

export function printCommandHelp(group: CommandGroup, cmd: Command, colors: boolean): void {
	process.stdout.write(
		`${bold(`${BINARY} ${group.name} ${cmd.name}`, colors)} — ${cmd.description}\n\n`,
	)

	// Usage
	const argPart = cmd.args
		? cmd.args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(" ")
		: ""
	process.stdout.write(`${bold("USAGE", colors)}\n`)
	process.stdout.write(
		`  ${BINARY} ${group.name} ${cmd.name}${argPart ? ` ${argPart}` : ""} [flags]\n\n`,
	)

	// Args
	if (cmd.args?.length) {
		process.stdout.write(`${bold("ARGUMENTS", colors)}\n`)
		const maxName = cmd.args.reduce((m, a) => Math.max(m, a.name.length), 0)
		for (const arg of cmd.args) {
			const req = arg.required ? "" : dim(" (optional)", colors)
			process.stdout.write(
				`  ${cyan(`<${arg.name}>`.padEnd(maxName + 2), colors)}${req}  ${arg.description}\n`,
			)
		}
		process.stdout.write("\n")
	}

	// Flags
	const allFlags = [...(cmd.flags ?? []), ...GLOBAL_FLAGS]
	process.stdout.write(`${bold("FLAGS", colors)}\n`)
	printFlags(allFlags, colors)

	// Examples
	if (cmd.examples?.length) {
		process.stdout.write(`\n${bold("EXAMPLES", colors)}\n`)
		for (const ex of cmd.examples) {
			process.stdout.write(`  ${dim(`# ${ex.description}`, colors)}\n`)
			process.stdout.write(`  ${green(ex.command, colors)}\n\n`)
		}
	}
}

function printFlags(flags: FlagSpec[], colors: boolean): void {
	const entries = flags.map((f) => {
		const shortPart = f.short ? `-${f.short}, ` : "    "
		const placeholder = f.placeholder ? ` <${f.placeholder}>` : ""
		const longPart = `--${f.name}${placeholder}`
		return { shortPart, longPart, description: f.description, def: f.default }
	})
	const maxLong = entries.reduce((m, e) => Math.max(m, e.longPart.length), 0)

	for (const { shortPart, longPart, description, def } of entries) {
		const defPart = def !== undefined ? dim(` (default: ${def})`, colors) : ""
		process.stdout.write(
			`  ${dim(shortPart, colors)}${cyan(longPart.padEnd(maxLong), colors)}  ${description}${defPart}\n`,
		)
	}
}

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Command, CommandGroup } from "../types.js"

/**
 * Install BPMNKit AIKit skills into `.claude/commands/` in the current project.
 * Skills are markdown prompt files that Claude Code executes as slash commands:
 *   /implement, /review, /test, /deploy
 * Lightweight, CLI-only versions of the full plugin's skill set — see aikit.md.
 *
 * Also installs aikit.md into .claude/ as a shared tool reference.
 */
const skillsInstallCmd: Command = {
	name: "install",
	description: "Install BPMNKit AIKit slash commands into .claude/commands/",
	args: [],
	flags: [
		{
			name: "force",
			short: "f",
			description: "Overwrite existing skill files",
			type: "boolean",
		},
	],
	examples: [
		{ description: "Install AIKit skills", command: "casen skills install" },
		{
			description: "Reinstall and overwrite existing skills",
			command: "casen skills install --force",
		},
	],

	async run(ctx) {
		const force = ctx.flags.force === true

		// Locate the bundled skills directory relative to this file.
		// Installed layout: dist/commands/skills.js → ../../skills/<name>.md
		const binDir = fileURLToPath(new URL(".", import.meta.url))
		const skillsSrc = join(binDir, "..", "..", "skills")

		if (!existsSync(skillsSrc)) {
			throw new Error(`Bundled skills directory not found at: ${skillsSrc}`)
		}

		const allFiles = readdirSync(skillsSrc).filter((f) => f.endsWith(".md"))
		if (allFiles.length === 0) {
			throw new Error("No skill files found in bundled skills directory")
		}

		// aikit.md goes to .claude/ as a shared reference; everything else is a slash command
		const REFERENCE_FILE = "aikit.md"
		const skillFiles = allFiles.filter((f) => f !== REFERENCE_FILE)

		const claudeDir = join(process.cwd(), ".claude")
		const commandsDir = join(claudeDir, "commands")
		mkdirSync(commandsDir, { recursive: true })

		let installed = 0
		let skipped = 0

		// Install the tool reference to .claude/aikit.md
		const refSrc = join(skillsSrc, REFERENCE_FILE)
		const refDest = join(claudeDir, REFERENCE_FILE)
		if (existsSync(refSrc)) {
			if (existsSync(refDest) && !force) {
				ctx.output.info(`  skip  ${REFERENCE_FILE} (already exists — use --force to overwrite)`)
				skipped++
			} else {
				writeFileSync(refDest, readFileSync(refSrc, "utf8"), "utf8")
				ctx.output.ok(`  wrote .claude/${REFERENCE_FILE}`)
				installed++
			}
		}

		// Install slash command skills to .claude/commands/
		for (const file of skillFiles) {
			const dest = join(commandsDir, file)
			if (existsSync(dest) && !force) {
				ctx.output.info(`  skip  ${file} (already exists — use --force to overwrite)`)
				skipped++
				continue
			}
			const content = readFileSync(join(skillsSrc, file), "utf8")
			writeFileSync(dest, content, "utf8")
			ctx.output.ok(`  wrote .claude/commands/${file}`)
			installed++
		}

		ctx.output.info("")
		ctx.output.ok(
			`Installed ${installed} file(s)${skipped > 0 ? `, skipped ${skipped}` : ""} → .claude/`,
		)
		ctx.output.info("")
		ctx.output.info("Available slash commands in Claude Code:")
		for (const file of skillFiles) {
			const name = file.replace(/\.md$/, "")
			ctx.output.info(`  /${name}`)
		}
		ctx.output.info("")
		ctx.output.info(
			"These commands drive `casen` directly — no MCP server or proxy needed. " +
				"For the full skill set (implement/extend/agent/connect/review/test/deploy + generated " +
				"reference docs), install the Claude Code plugin instead: " +
				"/plugin marketplace add github:bpmnkit/monorepo && /plugin install bpmnkit",
		)
	},
}

export const skillsGroup: CommandGroup = {
	name: "skills",
	description: "Manage BPMNKit AIKit slash commands for Claude Code",
	commands: [skillsInstallCmd],
}

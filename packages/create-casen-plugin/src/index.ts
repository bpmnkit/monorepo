#!/usr/bin/env node
/**
 * @bpmnkit/create-casen-plugin — Scaffold a new casen CLI plugin.
 *
 * Usage:
 *   pnpm create @bpmnkit/casen-plugin
 *   npx @bpmnkit/create-casen-plugin
 *   bunx @bpmnkit/create-casen-plugin
 *
 * Non-interactive:
 *   pnpm create @bpmnkit/casen-plugin --name casen-deploy --description "Git-tag-aware deploys"
 */

import { execFile } from "node:child_process"
import { mkdir, readdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { promisify } from "node:util"

const execAsync = promisify(execFile)

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface Options {
	name: string | undefined
	displayName: string | undefined
	description: string | undefined
	author: string | undefined
	git: boolean
}

function parseArgv(argv: string[]): Options {
	const opts: Options = {
		name: undefined,
		displayName: undefined,
		description: undefined,
		author: undefined,
		git: true,
	}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] ?? ""
		if (arg === "--name" || arg === "-n") {
			opts.name = argv[++i]
		} else if (arg === "--display-name") {
			opts.displayName = argv[++i]
		} else if (arg === "--description" || arg === "-d") {
			opts.description = argv[++i]
		} else if (arg === "--author" || arg === "-a") {
			opts.author = argv[++i]
		} else if (arg === "--no-git") {
			opts.git = false
		} else if (!arg.startsWith("-") && !opts.name) {
			// First positional arg is the package name (like create-next-app)
			opts.name = arg
		}
	}
	return opts
}

// ── Prompt helpers ────────────────────────────────────────────────────────────

async function prompt(
	rl: Awaited<ReturnType<typeof createInterface>>,
	question: string,
	defaultValue: string,
): Promise<string> {
	const answer = await rl.question(question)
	return answer.trim() || defaultValue
}

async function promptYN(
	rl: Awaited<ReturnType<typeof createInterface>>,
	question: string,
	defaultYes = true,
): Promise<boolean> {
	const hint = defaultYes ? "Y/n" : "y/N"
	const answer = await rl.question(`${question} (${hint}): `)
	const trimmed = answer.trim().toLowerCase()
	if (!trimmed) return defaultYes
	return trimmed === "y" || trimmed === "yes"
}

// ── Name validation ───────────────────────────────────────────────────────────

function isValidPkgName(name: string): boolean {
	return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
}

function deriveDisplayName(pkgName: string): string {
	// "casen-deploy" → "Deploy", "@acme/casen-deploy" → "Deploy"
	const base = pkgName.replace(/^@[^/]+\//, "").replace(/^casen-/, "")
	return (
		base.charAt(0).toUpperCase() +
		base.slice(1).replace(/-([a-z])/g, (_, c: string) => ` ${c.toUpperCase()}`)
	)
}

function deriveId(pkgName: string, author: string): string {
	const safeName = pkgName.replace(/^@[^/]+\//, "").replace(/[^a-z0-9-]/g, "-")
	const safeAuthor = author ? author.toLowerCase().replace(/[^a-z0-9]/g, "") : "example"
	return `com.${safeAuthor}.${safeName}`
}

// ── File templates ────────────────────────────────────────────────────────────

function genPackageJson(opts: {
	name: string
	description: string
	author: string
	version: string
}): string {
	return `${JSON.stringify(
		{
			name: opts.name,
			version: opts.version,
			description: opts.description,
			type: "module",
			main: "dist/index.js",
			keywords: ["casen-plugin"],
			author: opts.author || undefined,
			scripts: {
				build: "tsc",
				"build:watch": "tsc --watch",
				prepublishOnly: "tsc",
			},
			devDependencies: {
				"@bpmnkit/cli-sdk": "latest",
				typescript: "latest",
			},
		},
		null,
		2,
	)}\n`
}

function genTsconfig(): string {
	return `${JSON.stringify(
		{
			compilerOptions: {
				target: "ES2022",
				module: "Node16",
				moduleResolution: "Node16",
				lib: ["ES2022"],
				strict: true,
				outDir: "dist",
				rootDir: "src",
				declaration: true,
				esModuleInterop: true,
				skipLibCheck: true,
			},
			include: ["src"],
		},
		null,
		2,
	)}\n`
}

function genPluginSource(opts: {
	pkgName: string
	displayName: string
	version: string
	id: string
	groupName: string
}): string {
	// JSON string literals are valid TypeScript ones, quotes and backslashes escaped.
	const str = JSON.stringify
	return `import type { CasenPlugin } from "@bpmnkit/cli-sdk"

const plugin: CasenPlugin = {
  id: ${str(opts.id)},
  name: ${str(opts.displayName)},
  version: ${str(opts.version)},
  groups: [
    {
      name: ${str(opts.groupName)},
      description: ${str(`${opts.displayName} commands`)},
      commands: [
        {
          name: "hello",
          description: "Example command — replace with your own",
          async run(ctx) {
            ctx.output.ok(${str(`Hello from ${opts.displayName}!`)})
          },
        },
      ],
    },
  ],
}

export default plugin
`
}

function genGitignore(): string {
	return "node_modules/\ndist/\n"
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const argv = process.argv.slice(2)
	const opts = parseArgv(argv)

	const isInteractive = !opts.name || !opts.description

	process.stdout.write("\n  @bpmnkit/create-casen-plugin — casen plugin scaffolding\n\n")

	let name: string
	let displayName: string
	let description: string
	let author: string
	let initGit: boolean

	if (isInteractive) {
		const rl = createInterface({ input: process.stdin, output: process.stdout })

		try {
			// Package name
			let candidateName = opts.name ?? ""
			while (true) {
				const defaultHint = candidateName ? ` (${candidateName})` : ""
				const answer = await prompt(
					rl,
					`  Plugin name (npm package name)${defaultHint}: `,
					candidateName,
				)
				if (!answer) {
					process.stdout.write("  Package name is required.\n")
					continue
				}
				if (!isValidPkgName(answer)) {
					process.stdout.write(
						"  Invalid package name. Use lowercase letters, numbers, and hyphens.\n",
					)
					continue
				}
				candidateName = answer
				break
			}
			name = candidateName

			const defaultDisplay = opts.displayName ?? deriveDisplayName(name)
			displayName = await prompt(
				rl,
				`  Display name             (${defaultDisplay}): `,
				defaultDisplay,
			)

			description = await prompt(
				rl,
				`  Description              (${opts.description ?? ""}): `,
				opts.description ?? "",
			)

			const defaultAuthor = opts.author ?? ""
			author = await prompt(rl, `  Author                   (${defaultAuthor}): `, defaultAuthor)

			initGit = await promptYN(rl, "\n  Initialize git repo?")
		} finally {
			rl.close()
		}
	} else {
		// isInteractive is false only when opts.name and opts.description are both set
		name = opts.name ?? ""
		if (!isValidPkgName(name)) {
			throw new Error(
				`Invalid package name "${name}". Use lowercase letters, numbers, and hyphens.`,
			)
		}
		displayName = opts.displayName ?? deriveDisplayName(name)
		description = opts.description ?? ""
		author = opts.author ?? ""
		initGit = opts.git
	}

	// ── Scaffold ──────────────────────────────────────────────────────────────

	const targetDir = resolve(process.cwd(), name)
	const groupName =
		name
			.replace(/^@[^/]+\//, "")
			.replace(/^casen-/, "")
			.replace(/[^a-z0-9-]/g, "-") || name
	const id = deriveId(name, author)
	const version = "0.1.0"

	process.stdout.write("\n")

	const existing = await readdir(targetDir).catch(() => [])
	if (existing.length > 0) {
		throw new Error(`${targetDir} already exists and is not empty`)
	}

	await mkdir(join(targetDir, "src"), { recursive: true })

	await writeFile(
		join(targetDir, "package.json"),
		genPackageJson({ name, description, author, version }),
	)
	process.stdout.write("  ✓ package.json\n")

	await writeFile(join(targetDir, "tsconfig.json"), genTsconfig())
	process.stdout.write("  ✓ tsconfig.json\n")

	await writeFile(
		join(targetDir, "src", "index.ts"),
		genPluginSource({ pkgName: name, displayName, version, id, groupName }),
	)
	process.stdout.write("  ✓ src/index.ts\n")

	await writeFile(join(targetDir, ".gitignore"), genGitignore())
	process.stdout.write("  ✓ .gitignore\n")

	if (initGit) {
		try {
			await execAsync("git", ["init", "--quiet"], { cwd: targetDir })
			process.stdout.write("  ✓ git init\n")
		} catch {
			process.stdout.write("  ⚠ git init failed (git not found?)\n")
		}
	}

	process.stdout.write(`
  Done! Created ${name} at ./${name}

  Next steps:

    cd ${name}
    pnpm install        # install @bpmnkit/cli-sdk and typescript
    pnpm build          # compile src/ → dist/
    casen plugin install ./${name}   # install into casen

  Then open src/index.ts and add your commands.
  Publish to npm so others can discover it:
    npm publish
  (Make sure "casen-plugin" stays in your package.json keywords)

`)
}

main().catch((err: unknown) => {
	process.stderr.write(`\nerror: ${err instanceof Error ? err.message : String(err)}\n`)
	process.exit(1)
})

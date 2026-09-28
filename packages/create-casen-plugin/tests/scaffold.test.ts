import { execFileSync, spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI = join(HERE, "../src/index.ts")
const REPO = join(HERE, "../../..")
const TSC = join(REPO, "node_modules/typescript/bin/tsc")
/** tsx, resolved from here: the scaffolder runs with a temp dir as its cwd. */
const TSX = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href

let tmp = ""
beforeAll(() => {
	tmp = mkdtempSync(join(tmpdir(), "create-casen-plugin-"))
})
afterAll(() => {
	rmSync(tmp, { recursive: true, force: true })
})

/** Runs the scaffolder in its own directory under the temp dir. */
function scaffold(args: string[], input?: string) {
	const cwd = mkdtempSync(join(tmp, "run-"))
	const res = spawnSync(process.execPath, ["--import", TSX, CLI, ...args], {
		cwd,
		input: input ?? "",
		encoding: "utf8",
	})
	return { cwd, status: res.status, stdout: res.stdout, stderr: res.stderr }
}

const read = (...p: string[]) => readFileSync(join(...p), "utf8")
const pkgJson = (dir: string) => JSON.parse(read(dir, "package.json")) as Record<string, unknown>

describe("non-interactive scaffold", () => {
	let run: ReturnType<typeof scaffold>
	let dir = ""
	beforeAll(() => {
		run = scaffold([
			"--name",
			"casen-deploy",
			"--description",
			"Git-tag-aware deploys",
			"--author",
			"acme",
			"--no-git",
		])
		dir = join(run.cwd, "casen-deploy")
	})

	it("exits 0 and lists what it wrote", () => {
		expect(run.stderr).toBe("")
		expect(run.status).toBe(0)
		for (const f of ["package.json", "tsconfig.json", "src/index.ts", ".gitignore"]) {
			expect(run.stdout).toContain(`✓ ${f}`)
		}
		expect(run.stdout).toContain("Created casen-deploy at ./casen-deploy")
	})

	it("writes exactly the project files, without a git repo when --no-git", () => {
		expect(existsSync(join(dir, ".git"))).toBe(false)
		for (const f of ["package.json", "tsconfig.json", "src/index.ts", ".gitignore"]) {
			expect(existsSync(join(dir, f)), f).toBe(true)
		}
		expect(read(dir, ".gitignore")).toBe("node_modules/\ndist/\n")
	})

	it("writes a package.json casen can discover and install", () => {
		expect(pkgJson(dir)).toEqual({
			name: "casen-deploy",
			version: "0.1.0",
			description: "Git-tag-aware deploys",
			type: "module",
			main: "dist/index.js",
			keywords: ["casen-plugin"],
			author: "acme",
			scripts: { build: "tsc", "build:watch": "tsc --watch", prepublishOnly: "tsc" },
			devDependencies: { "@bpmnkit/cli-sdk": "latest", typescript: "latest" },
		})
	})

	it("writes a strict tsconfig compiling src/ to dist/", () => {
		const tsconfig = JSON.parse(read(dir, "tsconfig.json"))
		expect(tsconfig.compilerOptions).toMatchObject({
			strict: true,
			module: "Node16",
			outDir: "dist",
			rootDir: "src",
		})
		expect(tsconfig.include).toEqual(["src"])
	})

	it("writes a plugin whose id, name and group derive from the package name", () => {
		const src = read(dir, "src/index.ts")
		expect(src).toContain('import type { CasenPlugin } from "@bpmnkit/cli-sdk"')
		expect(src).toContain('id: "com.acme.casen-deploy"')
		expect(src).toContain('name: "Deploy"')
		expect(src).toContain('name: "deploy"')
		expect(src).toContain("export default plugin")
	})

	it("omits author when none is given", () => {
		const r = scaffold(["--name", "casen-x", "--description", "d", "--no-git"])
		expect(pkgJson(join(r.cwd, "casen-x")).author).toBeUndefined()
		expect(read(r.cwd, "casen-x", "src/index.ts")).toContain('id: "com.example.casen-x"')
	})

	it("uses the scope-less name for a scoped package", () => {
		const r = scaffold(["@acme/casen-big-deploy", "--description", "d", "--no-git"])
		const src = read(r.cwd, "@acme", "casen-big-deploy", "src/index.ts")
		expect(src).toContain('name: "Big Deploy"')
		expect(src).toContain('name: "big-deploy"')
		expect(src).toContain('id: "com.example.casen-big-deploy"')
	})

	it("initialises a git repo by default", () => {
		const r = scaffold(["--name", "casen-git", "--description", "d"])
		expect(r.stdout).toMatch(/✓ git init|⚠ git init failed/)
		if (r.stdout.includes("✓ git init")) {
			expect(existsSync(join(r.cwd, "casen-git", ".git"))).toBe(true)
		}
	})
})

/**
 * Runs the scaffolder interactively, typing each answer once its prompt is
 * shown: readline drops lines that arrive before a question is asked.
 */
function scaffoldInteractive(answers: string[]) {
	const cwd = mkdtempSync(join(tmp, "run-"))
	const child = spawn(process.execPath, ["--import", TSX, CLI], { cwd })
	let stdout = ""
	let asked = 0
	child.stdout.setEncoding("utf8")
	child.stdout.on("data", (chunk: string) => {
		stdout += chunk
		const prompts = stdout.match(/\): /g)?.length ?? 0
		while (asked < prompts && asked < answers.length) {
			child.stdin.write(`${answers[asked++]}\n`)
		}
	})
	return new Promise<{ cwd: string; status: number | null; stdout: string }>((resolve) => {
		child.on("close", (status) => resolve({ cwd, status, stdout }))
	})
}

describe("interactive scaffold", () => {
	it("prompts for the fields, re-asking for an invalid name", async () => {
		const r = await scaffoldInteractive(["Bad Name", "casen-hello", "", "Says hello", "Jane", "n"])
		expect(r.stdout).toContain("Invalid package name")
		expect(r.status).toBe(0)
		const dir = join(r.cwd, "casen-hello")
		expect(pkgJson(dir)).toMatchObject({
			name: "casen-hello",
			description: "Says hello",
			author: "Jane",
		})
		expect(read(dir, "src/index.ts")).toContain('name: "Hello"')
		expect(existsSync(join(dir, ".git"))).toBe(false)
	}, 30_000)
})

describe("bad input", () => {
	// Regression: --name skipped the validation the prompt applies, so a path
	// such as ../outside was scaffolded outside the working directory.
	it("rejects an invalid --name instead of writing outside the working directory", () => {
		const r = scaffold(["--name", "../escaped", "--description", "d", "--no-git"])
		expect(r.status).toBe(1)
		expect(r.stderr).toContain('Invalid package name "../escaped"')
		expect(existsSync(join(r.cwd, "..", "escaped"))).toBe(false)
	})

	// Regression: scaffolding into an existing project silently overwrote it.
	it("refuses to overwrite a non-empty directory", () => {
		const cwd = mkdtempSync(join(tmp, "existing-"))
		mkdirSync(join(cwd, "casen-mine"))
		writeFileSync(join(cwd, "casen-mine", "package.json"), '{"name":"mine"}')
		const res = spawnSync(
			process.execPath,
			["--import", TSX, CLI, "--name", "casen-mine", "--description", "d", "--no-git"],
			{ cwd, encoding: "utf8" },
		)
		expect(res.status).toBe(1)
		expect(res.stderr).toContain("already exists and is not empty")
		expect(read(cwd, "casen-mine", "package.json")).toBe('{"name":"mine"}')
	})

	// Regression: the display name and description were pasted into the source
	// between double quotes, so a quote in either produced a file that did not parse.
	it("escapes quotes in the display name", () => {
		const r = scaffold([
			"--name",
			"casen-q",
			"--display-name",
			'My "Quoted" \\ Plugin',
			"--description",
			"d",
			"--no-git",
		])
		const src = read(r.cwd, "casen-q", "src/index.ts")
		expect(src).toContain('name: "My \\"Quoted\\" \\\\ Plugin"')
	})

	// Regression: the author was filtered to [a-z0-9] before it was lower-cased,
	// so "Acme" became "cme".
	it("lower-cases the author before deriving the plugin id", () => {
		const r = scaffold([
			"--name",
			"casen-a",
			"--description",
			"d",
			"--author",
			"Acme Corp",
			"--no-git",
		])
		expect(read(r.cwd, "casen-a", "src/index.ts")).toContain('id: "com.acmecorp.casen-a"')
	})
})

describe("the generated project", () => {
	let dir = ""
	beforeAll(() => {
		const r = scaffold([
			"--name",
			"casen-typed",
			"--display-name",
			'Typed "Plugin"',
			"--description",
			"d",
			"--no-git",
		])
		dir = join(r.cwd, "casen-typed")
		// Install @bpmnkit/cli-sdk from this workspace's source: its declarations
		// are what a plugin compiles against.
		const sdk = join(dir, "node_modules", "@bpmnkit", "cli-sdk")
		execFileSync(process.execPath, [
			TSC,
			join(REPO, "packages/cli-sdk/src/index.ts"),
			"--declaration",
			"--emitDeclarationOnly",
			"--outDir",
			join(sdk, "dist"),
			"--target",
			"ES2022",
			"--module",
			"Node16",
			"--moduleResolution",
			"Node16",
			"--types",
			"node",
			"--typeRoots",
			join(REPO, "node_modules/@types"),
		])
		writeFileSync(
			join(sdk, "package.json"),
			JSON.stringify({
				name: "@bpmnkit/cli-sdk",
				type: "module",
				exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
			}),
		)
	}, 60_000)

	it("type-checks and builds against @bpmnkit/cli-sdk", () => {
		const res = spawnSync(process.execPath, [TSC, "-p", dir], { encoding: "utf8" })
		expect(res.stdout + res.stderr).toBe("")
		expect(res.status).toBe(0)
		expect(existsSync(join(dir, "dist/index.js"))).toBe(true)
	}, 60_000)

	it("builds a default export casen's plugin loader accepts, with a runnable command", async () => {
		const mod = (await import(pathToFileURL(join(dir, "dist/index.js")).href)) as {
			default: {
				id: string
				name: string
				groups: Array<{
					name: string
					commands: Array<{ name: string; run(ctx: unknown): Promise<void> }>
				}>
			}
		}
		const plugin = mod.default
		expect(plugin.id).toBe("com.example.casen-typed")
		expect(plugin.name).toBe('Typed "Plugin"')
		expect(Array.isArray(plugin.groups)).toBe(true)
		const hello = plugin.groups[0]?.commands[0]
		const lines: string[] = []
		await hello?.run({ output: { ok: (m: string) => lines.push(m) } })
		expect(lines).toEqual(['Hello from Typed "Plugin"!'])
	})
})

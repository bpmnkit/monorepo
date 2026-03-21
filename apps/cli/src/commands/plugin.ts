import { spawn } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import {
	PLUGINS_DIR,
	type PluginMeta,
	readInstalledPlugins,
	sanitiseName,
} from "../plugin-loader.js"
import type { CommandGroup } from "../types.js"

// ── npm helper ────────────────────────────────────────────────────────────────

function runNpm(args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"
		const child = spawn(npmCmd, ["install", ...args], { cwd, stdio: "inherit" })
		child.on("close", (code) => {
			if (code === 0) resolve()
			else reject(new Error(`npm install exited with code ${String(code)}`))
		})
		child.on("error", reject)
	})
}

// ── npm registry search ───────────────────────────────────────────────────────

export interface NpmSearchObject {
	package: {
		name: string
		version: string
		description?: string
		publisher?: { username?: string }
	}
	score: { final: number }
}

export async function searchNpmRegistry(query: string): Promise<NpmSearchObject[]> {
	const text = `keywords:casen-plugin${query ? ` ${query}` : ""}`
	const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=50`
	const res = await fetch(url)
	if (!res.ok) throw new Error(`npm registry returned HTTP ${res.status}`)
	const data = (await res.json()) as { objects: NpmSearchObject[] }
	return data.objects
}

// ── plugin group ──────────────────────────────────────────────────────────────

export const pluginGroup: CommandGroup = {
	name: "plugin",
	description: "Manage casen CLI plugins",
	commands: [
		// ── list ──────────────────────────────────────────────────────────────
		{
			name: "list",
			aliases: ["ls"],
			description: "List installed plugins",
			async run(ctx) {
				const plugins = await readInstalledPlugins()
				if (plugins.length === 0) {
					ctx.output.info('No plugins installed. Run "casen plugin search" to discover plugins.')
					return
				}
				ctx.output.printList(
					{
						items: plugins.map((p) => ({
							name: p.package,
							version: p.version,
							installed: p.installedAt.slice(0, 10),
						})),
					},
					[
						{ key: "name", header: "NAME" },
						{ key: "version", header: "VERSION" },
						{ key: "installed", header: "INSTALLED" },
					],
				)
			},
		},

		// ── install ───────────────────────────────────────────────────────────
		{
			name: "install",
			aliases: ["add"],
			description: "Install a plugin from the npm registry or a local path",
			args: [{ name: "name", description: "npm package name or ./local-path", required: true }],
			examples: [
				{ description: "Install from npm", command: "casen plugin install casen-deploy" },
				{
					description: "Install from local path (dev mode)",
					command: "casen plugin install ./my-plugin",
				},
			],
			async run(ctx) {
				const nameArg = ctx.positional[0]
				if (!nameArg) throw new Error("Missing required argument: <name>")

				// Detect local path vs npm package name
				const isLocalPath = nameArg.startsWith(".") || nameArg.startsWith("/")
				let pkgName: string

				if (isLocalPath) {
					const localPath = join(homedir(), nameArg.startsWith("/") ? "" : ".", nameArg)
					const localPkgText = await readFile(
						join(isLocalPath ? nameArg : localPath, "package.json"),
						"utf8",
					)
					const localPkg = JSON.parse(localPkgText) as { name?: string }
					if (!localPkg.name) throw new Error(`No "name" field found in ${nameArg}/package.json`)
					pkgName = localPkg.name
				} else {
					pkgName = nameArg
				}

				const dirName = sanitiseName(pkgName)
				const pluginDir = join(PLUGINS_DIR, dirName)

				ctx.output.info(`Installing ${pkgName}…`)

				await mkdir(pluginDir, { recursive: true })

				// Initialise a minimal host package.json so npm has a valid workspace
				const hostPkg = { name: "_casen-plugin-host", version: "0.0.0", private: true }
				const hostPkgPath = join(pluginDir, "package.json")
				try {
					await readFile(hostPkgPath, "utf8")
				} catch {
					// Only write if it doesn't already exist
					await writeFile(hostPkgPath, `${JSON.stringify(hostPkg, null, 2)}\n`, "utf8")
				}

				await runNpm([nameArg], pluginDir)

				// Read the installed version from the plugin's own package.json
				const installedPkgText = await readFile(
					join(pluginDir, "node_modules", pkgName, "package.json"),
					"utf8",
				)
				const installedPkg = JSON.parse(installedPkgText) as { version?: string }
				const version = installedPkg.version ?? "unknown"

				const meta: PluginMeta = {
					package: pkgName,
					version,
					installedAt: new Date().toISOString(),
				}
				await writeFile(join(pluginDir, ".meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8")

				ctx.output.ok(`Installed ${pkgName}@${version}`)
				ctx.output.info("Restart casen to activate the plugin.")
			},
		},

		// ── remove ────────────────────────────────────────────────────────────
		{
			name: "remove",
			aliases: ["uninstall", "rm"],
			description: "Uninstall a plugin",
			args: [{ name: "name", description: "Plugin package name", required: true }],
			async run(ctx) {
				const pkgName = ctx.positional[0]
				if (!pkgName) throw new Error("Missing required argument: <name>")

				const pluginDir = join(PLUGINS_DIR, sanitiseName(pkgName))

				try {
					await readFile(join(pluginDir, ".meta.json"), "utf8")
				} catch {
					throw new Error(`Plugin "${pkgName}" is not installed.`)
				}

				await rm(pluginDir, { recursive: true, force: true })
				ctx.output.ok(`Removed ${pkgName}`)
				ctx.output.info("Restart casen for the change to take effect.")
			},
		},

		// ── update ────────────────────────────────────────────────────────────
		{
			name: "update",
			aliases: ["upgrade"],
			description: "Update one or all plugins to their latest versions",
			args: [
				{
					name: "name",
					description: "Plugin to update (omit to update all installed plugins)",
					required: false,
				},
			],
			async run(ctx) {
				const target = ctx.positional[0]
				const plugins = await readInstalledPlugins()

				if (plugins.length === 0) {
					ctx.output.info("No plugins installed.")
					return
				}

				const toUpdate = target ? plugins.filter((p) => p.package === target) : plugins

				if (toUpdate.length === 0) {
					throw new Error(`Plugin "${String(target)}" is not installed.`)
				}

				for (const plugin of toUpdate) {
					ctx.output.info(`Updating ${plugin.package}…`)
					await runNpm([`${plugin.package}@latest`], plugin.dir)

					const pkgText = await readFile(
						join(plugin.dir, "node_modules", plugin.package, "package.json"),
						"utf8",
					)
					const pkg = JSON.parse(pkgText) as { version?: string }
					const newVersion = pkg.version ?? "unknown"

					const meta: PluginMeta = {
						package: plugin.package,
						version: newVersion,
						installedAt: plugin.installedAt,
					}
					await writeFile(
						join(plugin.dir, ".meta.json"),
						`${JSON.stringify(meta, null, 2)}\n`,
						"utf8",
					)
					ctx.output.ok(`Updated ${plugin.package} → ${newVersion}`)
				}

				ctx.output.info("Restart casen for the changes to take effect.")
			},
		},

		// ── info ──────────────────────────────────────────────────────────────
		{
			name: "info",
			description: "Show details for an installed plugin",
			args: [{ name: "name", description: "Plugin package name", required: true }],
			async run(ctx) {
				const pkgName = ctx.positional[0]
				if (!pkgName) throw new Error("Missing required argument: <name>")

				const pluginDir = join(PLUGINS_DIR, sanitiseName(pkgName))

				const metaText = await readFile(join(pluginDir, ".meta.json"), "utf8")
				const meta = JSON.parse(metaText) as PluginMeta

				const pkgText = await readFile(
					join(pluginDir, "node_modules", pkgName, "package.json"),
					"utf8",
				)
				const pkg = JSON.parse(pkgText) as {
					description?: string
					homepage?: string
					repository?: { url?: string } | string
					author?: string | { name?: string }
				}

				const repoUrl =
					typeof pkg.repository === "string" ? pkg.repository : (pkg.repository?.url ?? "")
				const author = typeof pkg.author === "string" ? pkg.author : (pkg.author?.name ?? "")

				ctx.output.printItem({
					name: meta.package,
					version: meta.version,
					installedAt: meta.installedAt,
					description: pkg.description ?? "",
					homepage: pkg.homepage ?? "",
					repository: repoUrl,
					author,
					directory: pluginDir,
				})
			},
		},

		// ── search ────────────────────────────────────────────────────────────
		{
			name: "search",
			description: "Search the npm registry for casen plugins",
			args: [{ name: "query", description: "Search terms (optional)", required: false }],
			examples: [
				{ description: "Browse all plugins", command: "casen plugin search" },
				{ description: "Search for deploy-related plugins", command: "casen plugin search deploy" },
			],
			async run(ctx) {
				const query = ctx.positional[0] ?? ""
				ctx.output.info(`Searching npm for casen plugins${query ? ` matching "${query}"` : ""}…`)

				const results = await searchNpmRegistry(query)

				if (results.length === 0) {
					ctx.output.info("No plugins found.")
					return
				}

				ctx.output.printList(
					{
						items: results.map((r) => ({
							name: r.package.name,
							version: r.package.version,
							description: r.package.description ?? "",
							publisher: r.package.publisher?.username ?? "",
							score: r.score.final.toFixed(2),
						})),
					},
					[
						{ key: "name", header: "NAME" },
						{ key: "version", header: "VERSION" },
						{ key: "description", header: "DESCRIPTION", maxWidth: 52 },
						{ key: "publisher", header: "PUBLISHER" },
						{ key: "score", header: "SCORE" },
					],
				)
			},
		},
	],
}

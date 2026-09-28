#!/usr/bin/env node
// Reads every package in scripts/published-packages.mjs and writes the facts the
// landing site quotes about them — name, version, npm URL, repository directory.
//
// Those facts used to be hand-maintained in apps/landing/src/data/content.ts, and
// by the time anyone noticed, the homepage was advertising @bpmnkit/core v0.1.1
// against a published v0.4.0. A version that has to be copied is a version that
// drifts, so this is generated from the manifests changesets actually bumps, on
// every `dev` and `build`.
//
// Editorial copy — which packages lead the list and what each one is *for* — is
// not here. It stays in content.ts, keyed by package name, and anything with no
// entry there falls back to the manifest's own description. Adding a package to
// PUBLISHED therefore cannot break the page.
//
// Each product's tier comes from TIER and APPS in the same file, so the site cannot label a
// package differently from its README or from the check that enforces the tiers.
//
// Output goes under `src/generated/`, which biome already ignores repo-wide —
// the same arrangement `packages/api` uses for its generated resources.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { APPS, PUBLISHED, TIER, TIERS, manifestVersion } from "./published-packages.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "apps/landing/src/generated/ecosystem.ts")
const REPO = "https://github.com/bpmnkit/monorepo"
const DOCS = join(ROOT, "apps/landing/src/content/docs")

/** The docs page that describes a package: its `packages/` page, or the CLI's own section. */
function docsPage(name) {
	if (name === "@bpmnkit/cli") return "cli/casen"
	const short = name.replace("@bpmnkit/", "")
	return existsSync(join(DOCS, "packages", `${short}.md`)) ? `packages/${short}` : null
}

const facts = PUBLISHED.map((dir) => {
	const manifest = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"))
	if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
		throw new Error(`${dir}/package.json is missing a name or a version`)
	}
	return {
		dir,
		name: manifest.name,
		version: manifest.version,
		description: manifest.description ?? "",
		tier: TIER[dir],
		npm: `https://www.npmjs.com/package/${manifest.name}`,
		github: `${REPO}/tree/main/${dir}`,
		docs: docsPage(manifest.name),
	}
}).sort((a, b) => a.name.localeCompare(b.name))

const apps = APPS.map((app) => ({
	...app,
	version: manifestVersion(readFileSync(join(ROOT, app.manifest), "utf8"), app.manifest),
	github: `${REPO}/tree/main/${app.dir}`,
}))

const entries = facts
	.map(
		(f) => `	{
		dir: ${JSON.stringify(f.dir)},
		name: ${JSON.stringify(f.name)},
		version: ${JSON.stringify(f.version)},
		description: ${JSON.stringify(f.description)},
		tier: ${JSON.stringify(f.tier)},
		npm: ${JSON.stringify(f.npm)},
		github: ${JSON.stringify(f.github)},
		docs: ${JSON.stringify(f.docs)},
	},`,
	)
	.join("\n")

const appEntries = apps
	.map(
		(a) => `	{
		dir: ${JSON.stringify(a.dir)},
		name: ${JSON.stringify(a.name)},
		version: ${JSON.stringify(a.version)},
		description: ${JSON.stringify(a.description)},
		tier: ${JSON.stringify(a.tier)},
		github: ${JSON.stringify(a.github)},
		docs: ${JSON.stringify(a.docs)},
	},`,
	)
	.join("\n")

const output = `/**
 * Every package this repo publishes, as its manifest states it.
 *
 * **Auto-generated** by \`scripts/generate-ecosystem.mjs\` from
 * \`scripts/published-packages.mjs\` and each package's own \`package.json\`, on
 * every \`dev\` and \`build\`. Do not edit it by hand — a version typed twice is a
 * version that drifts, which is the bug this file exists to make impossible.
 *
 * Editorial copy lives in \`content.ts\`; this file carries only facts.
 */

/** A product's public tier. \`TIERS\` says what each one promises. */
export type Tier = ${Object.keys(TIERS)
	.map((t) => JSON.stringify(t))
	.join(" | ")}

export const TIERS: Readonly<Record<Tier, { readonly label: string; readonly promise: string }>> = ${JSON.stringify(TIERS, null, "\t")}

export interface PackageFact {
	/** Workspace-relative directory, e.g. \`packages/core\`. */
	readonly dir: string
	/** npm package name. */
	readonly name: string
	/** The version in the package's own manifest — what the next release publishes. */
	readonly version: string
	/** The manifest's \`description\`, used when \`content.ts\` has nothing to say. */
	readonly description: string
	readonly tier: Tier
	readonly npm: string
	readonly github: string
	/** Collection id of the docs page that describes it, e.g. \`packages/core\`, or null. */
	readonly docs: string | null
}

export const PACKAGE_FACTS: readonly PackageFact[] = [
${entries}
]

/** A product that is not an npm package: an app, an extension, a service. */
export interface AppFact {
	readonly dir: string
	readonly name: string
	/** The version in its \`package.json\` or \`Cargo.toml\`. */
	readonly version: string
	readonly description: string
	readonly tier: Tier
	readonly github: string
	readonly docs: string | null
}

export const APP_FACTS: readonly AppFact[] = [
${appEntries}
]
`

writeFileSync(OUT, output, "utf8")
console.log(`✓ Wrote ${OUT} (${facts.length} packages, ${apps.length} apps)`)

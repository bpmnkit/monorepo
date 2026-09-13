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
// Output goes under `src/generated/`, which biome already ignores repo-wide —
// the same arrangement `packages/api` uses for its generated resources.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PUBLISHED } from "./published-packages.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "apps/landing/src/generated/ecosystem.ts")
const REPO = "https://github.com/bpmnkit/monorepo"

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
		npm: `https://www.npmjs.com/package/${manifest.name}`,
		github: `${REPO}/tree/main/${dir}`,
	}
}).sort((a, b) => a.name.localeCompare(b.name))

const entries = facts
	.map(
		(f) => `	{
		dir: ${JSON.stringify(f.dir)},
		name: ${JSON.stringify(f.name)},
		version: ${JSON.stringify(f.version)},
		description: ${JSON.stringify(f.description)},
		npm: ${JSON.stringify(f.npm)},
		github: ${JSON.stringify(f.github)},
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

export interface PackageFact {
	/** Workspace-relative directory, e.g. \`packages/core\`. */
	readonly dir: string
	/** npm package name. */
	readonly name: string
	/** The version in the package's own manifest — what the next release publishes. */
	readonly version: string
	/** The manifest's \`description\`, used when \`content.ts\` has nothing to say. */
	readonly description: string
	readonly npm: string
	readonly github: string
}

export const PACKAGE_FACTS: readonly PackageFact[] = [
${entries}
]
`

writeFileSync(OUT, output, "utf8")
console.log(`✓ Wrote ${OUT} (${facts.length} packages)`)

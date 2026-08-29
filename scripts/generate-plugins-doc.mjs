#!/usr/bin/env node
// Reads plugins-cli/<name>/package.json and writes the CLI plugins reference page.
// Run: node scripts/generate-plugins-doc.mjs
// Also runs automatically as the landing-site prebuild step.

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PLUGINS_DIR = join(ROOT, "plugins-cli")
const OUT = join(ROOT, "apps/landing/src/content/docs/cli/plugins.md")

// ── Collect plugin metadata ───────────────────────────────────────────────────

const plugins = []

for (const entry of readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue
	try {
		const pkgPath = join(PLUGINS_DIR, entry.name, "package.json")
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
		// Only include packages that declare themselves as casen plugins
		if (!pkg.keywords?.includes("casen-plugin")) continue
		plugins.push({
			name: pkg.name,
			description: pkg.description ?? "",
			version: pkg.version ?? "0.1.0",
			group: pkg.casen?.group ?? entry.name.replace(/^casen-/, ""),
			commands: pkg.casen?.commands ?? [],
		})
	} catch {
		// skip directories without a valid package.json
	}
}

plugins.sort((a, b) => a.name.localeCompare(b.name))

// ── Build markdown ────────────────────────────────────────────────────────────

function pluginSection(p) {
	const installCmd = `casen plugin install ${p.name}`
	const commandRows =
		p.commands.length > 0
			? `\n| Command | Description |\n|---------|-------------|\n${p.commands.map((c) => `| \`casen ${p.group} ${c.name}\` | ${c.description} |`).join("\n")}\n`
			: ""

	return `## \`${p.name}\`

${p.description}

### Installation

\`\`\`sh
${installCmd}
\`\`\`
${commandRows}`
}

const summaryRows = plugins
	.map((p) => `| [\`${p.name}\`](#${p.name.replace(/[^a-z0-9]/g, "-")}) | ${p.description} |`)
	.join("\n")

const sections = plugins.map(pluginSection).join("\n---\n\n")

const output = `---
title: casen Plugins
description: Official casen CLI plugins shipped with the BPMN Kit monorepo.
sidebar:
  order: 6
---

> **Auto-generated** — this page is built from \`plugins-cli/*/package.json\` during the site
> build. Do not edit it by hand.

Official plugins extend \`casen\` with domain-specific command groups. Install them with:

\`\`\`sh
casen plugin install <name>
\`\`\`

## Available Plugins

| Plugin | Description |
|--------|-------------|
${summaryRows}

---

${sections}
---

## Authoring Plugins

See the [Plugin Authoring](/docs/cli/plugin-authoring) guide to build and publish your own \`casen\` plugin.
`

writeFileSync(OUT, output, "utf8")
console.log(`✓ Wrote ${OUT} (${plugins.length} plugin${plugins.length === 1 ? "" : "s"})`)

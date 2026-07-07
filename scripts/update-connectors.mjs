#!/usr/bin/env node
// Source: https://marketplace.cloud.camunda.io/api/v1/ootb-connectors
// Run: pnpm update-connectors
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const REGISTRY_URL = "https://marketplace.cloud.camunda.io/api/v1/ootb-connectors"
const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../packages/connectors")
const OUT_FILE = join(PACKAGE_DIR, "src/templates/generated.ts")
const META_FILE = join(PACKAGE_DIR, "src/templates/catalog-meta.json")

const registry = await fetch(REGISTRY_URL).then((r) => r.json())

const templates = []
for (const [, versions] of Object.entries(registry)) {
	// Take latest version only (last entry in array)
	const latest = versions.at(-1)
	if (!latest?.ref) continue
	const tpl = await fetch(latest.ref)
		.then((r) => r.json())
		.catch(() => null)
	if (!tpl) continue
	templates.push(tpl)
}

const json = JSON.stringify(templates, null, 2)
const content = `\
// AUTO-GENERATED — DO NOT EDIT. Run \`pnpm update-connectors\` to regenerate.
// Source: ${REGISTRY_URL}
import type { ElementTemplate } from "../template-types.js";

export const CAMUNDA_CONNECTOR_TEMPLATES: ElementTemplate[] = ${json} as unknown as ElementTemplate[];
`

writeFileSync(OUT_FILE, content, "utf8")

const meta = {
	fetchedAt: new Date().toISOString(),
	count: templates.length,
	source: REGISTRY_URL,
}
writeFileSync(META_FILE, `${JSON.stringify(meta, null, "\t")}\n`, "utf8")

console.log(`Wrote ${templates.length} templates → ${OUT_FILE}`)
console.log(`Wrote catalog freshness metadata → ${META_FILE}`)

#!/usr/bin/env node
/**
 * Bring the committed `.llms/` payload's version in line with `package.json`.
 *
 * Unlike `@bpmnkit/docspack`, this pack cannot be rebuilt at release time: the
 * payload comes from a `camunda-docs` checkout that only the weekly workflow
 * has. So `build` is `tsc`, the payload is committed, and its version froze at
 * whatever the last rebuild wrote — while `changeset version` moved
 * `package.json` on. `@bpmnkit/camunda-docspack@0.1.0` shipped a manifest
 * claiming 0.0.0, which `docspack doctor` fails and `docspack list` reports.
 *
 * Only the version is touched. The chunks are the upstream documentation and
 * are not this script's business.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))

const manifestPath = join(root, ".llms", "manifest.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const was = manifest.version

if (was !== version) {
	manifest.version = version
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`)
}

// `llms.txt` repeats it in its header line, written by `buildPack`'s
// `tableOfContents` as `Version <v>. <n> chunks documenting <documents>.`
const tocPath = join(root, "llms.txt")
const toc = readFileSync(tocPath, "utf8")
const synced = toc.replace(/^Version .+?\. /m, `Version ${version}. `)
if (synced !== toc) writeFileSync(tocPath, synced)

process.stdout.write(
	was === version
		? `Pack version already ${version}.\n`
		: `Pack version ${was} → ${version} (manifest.json, llms.txt).\n`,
)

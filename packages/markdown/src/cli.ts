#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { prerenderMarkdown } from "./prerender.js"
import type { DiagramTheme } from "./render.js"
import { renderBpmnBlock } from "./render.js"

const USAGE = `Usage: bpmnkit-md [options] <file.md | file.bpmn>...

Pre-renders BPMN diagrams to committed SVG files, for Markdown that no plugin
will ever process (GitHub READMEs).

  file.md     Every \`\`\`bpmn / \`\`\`bpmn-compact / \`\`\`bpmn-json block becomes an image
              of the diagram plus its source, between bpmnkit-md markers.
              Re-running re-renders from the source; it is idempotent.
  file.bpmn   Written to file.svg next to it.

Options:
  --out-dir <dir>     where new SVGs go, relative to each .md file (default: diagrams)
  --theme <theme>     auto | light | dark (default: auto — follows the reader's scheme)
  --max-width <px>    largest width to draw a diagram at
  --check             write nothing; exit 1 if any file is out of date (for CI)
  -h, --help          show this help`

const THEMES: readonly DiagramTheme[] = ["auto", "light", "dark"]

function main(argv: string[]): number {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			"out-dir": { type: "string" },
			theme: { type: "string" },
			"max-width": { type: "string" },
			check: { type: "boolean" },
			help: { type: "boolean", short: "h" },
		},
	})
	if (values.help || positionals.length === 0) {
		console.log(USAGE)
		return values.help ? 0 : 1
	}
	const theme = (values.theme ?? "auto") as DiagramTheme
	if (!THEMES.includes(theme)) {
		console.error(`bpmnkit-md: --theme must be one of ${THEMES.join(", ")} (got "${values.theme}")`)
		return 1
	}
	const maxWidth = values["max-width"] === undefined ? undefined : Number(values["max-width"])
	if (maxWidth !== undefined && !(maxWidth > 0)) {
		console.error(
			`bpmnkit-md: --max-width must be a positive number (got "${values["max-width"]}")`,
		)
		return 1
	}

	/** Every file the run would write, with the content it would write. */
	const outputs = new Map<string, string>()
	for (const input of positionals) {
		const source = readFileSync(input, "utf8")
		try {
			if (extname(input) === ".bpmn") {
				const result = renderBpmnBlock(source, "bpmn", { theme, maxWidth, onError: "throw" })
				if (result.ok)
					outputs.set(join(dirname(input), `${basename(input, ".bpmn")}.svg`), `${result.svg}\n`)
				continue
			}
			const { markdown, files } = prerenderMarkdown(source, {
				theme,
				maxWidth,
				...(values["out-dir"] ? { outDir: values["out-dir"] } : {}),
			})
			outputs.set(input, markdown)
			for (const file of files) outputs.set(join(dirname(input), file.path), file.svg)
		} catch (err) {
			console.error(`bpmnkit-md: ${input}: ${err instanceof Error ? err.message : String(err)}`)
			return 1
		}
	}

	const stale = [...outputs].filter(([path, content]) => read(path) !== content)
	if (values.check) {
		for (const [path] of stale) console.error(`bpmnkit-md: out of date: ${path}`)
		if (stale.length > 0) console.error("Run bpmnkit-md without --check to update.")
		return stale.length > 0 ? 1 : 0
	}
	for (const [path, content] of stale) {
		mkdirSync(dirname(resolve(path)), { recursive: true })
		writeFileSync(path, content)
		console.log(`bpmnkit-md: wrote ${path}`)
	}
	return 0
}

function read(path: string): string | undefined {
	try {
		return readFileSync(path, "utf8")
	} catch {
		return undefined
	}
}

try {
	process.exitCode = main(process.argv.slice(2))
} catch (err) {
	console.error(`bpmnkit-md: ${err instanceof Error ? err.message : String(err)}`)
	process.exitCode = 1
}

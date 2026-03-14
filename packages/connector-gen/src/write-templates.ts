import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ConnectorTemplate, WriteOptions } from "./types.js"

function safeName(id: string): string {
	// Strip idPrefix (everything up to and including the first dot), lowercase
	const base = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id
	return base.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
}

export async function writeTemplates(
	templates: ConnectorTemplate[],
	opts: WriteOptions,
): Promise<string[]> {
	await mkdir(opts.outputDir, { recursive: true })

	const format = opts.format ?? "one-per-op"
	const written: string[] = []

	if (format === "array") {
		const filePath = join(opts.outputDir, "connector-templates.json")
		await writeFile(filePath, JSON.stringify(templates, null, 2), "utf8")
		written.push(filePath)
	} else {
		for (const tpl of templates) {
			const fileName = `${safeName(tpl.id)}.json`
			const filePath = join(opts.outputDir, fileName)
			await writeFile(filePath, JSON.stringify(tpl, null, 2), "utf8")
			written.push(filePath)
		}
	}

	return written
}

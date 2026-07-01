import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Recording } from "../shared/recording-types.js"

export type SaveResult =
	| { status: "ok"; slug: string }
	| { status: "conflict"; slug: string }
	| { status: "invalid" }

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

export function saveRecording(dir: string, recording: Recording): SaveResult {
	const slug = slugify(recording.name)
	if (!slug) return { status: "invalid" }

	mkdirSync(dir, { recursive: true })
	const filePath = join(dir, `${slug}.json`)
	if (existsSync(filePath)) return { status: "conflict", slug }

	writeFileSync(filePath, JSON.stringify(recording, null, 2), "utf-8")
	return { status: "ok", slug }
}

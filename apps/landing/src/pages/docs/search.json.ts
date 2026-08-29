import { getCollection } from "astro:content"
import type { APIRoute } from "astro"
import { docHref, sectionLabel, sectionOf } from "../../data/docs-nav"

/** Per-page body budget. Keeps the whole index well under a hundred kilobytes. */
const MAX_TEXT = 4000

/** Markdown reduced to the words a reader would actually search for. */
function searchable(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[#>*_|~-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.slice(0, MAX_TEXT)
}

export const GET: APIRoute = async () => {
	const docs = await getCollection("docs")
	const index = docs
		.map((entry) => ({
			title: entry.data.title,
			description: entry.data.description,
			section: sectionLabel(sectionOf(entry.id)),
			href: docHref(entry.id),
			text: searchable(entry.body ?? ""),
		}))
		.sort((a, b) => a.href.localeCompare(b.href))

	return new Response(JSON.stringify(index), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	})
}

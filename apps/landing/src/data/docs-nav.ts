/**
 * The documentation sidebar, derived from the `docs` content collection.
 *
 * Nothing here is hand-maintained: dropping a Markdown file into
 * `src/content/docs/<section>/` puts it in the sidebar, in the search index and
 * in the prev/next pager. `sidebar.order` in the front matter positions it
 * inside its section; pages without one sort last, alphabetically by title.
 */

import { getCollection } from "astro:content"

/** Known sections, in the order a reader should meet them. */
const SECTIONS: Record<string, { label: string; order: number }> = {
	"getting-started": { label: "Getting Started", order: 1 },
	guides: { label: "Guides", order: 2 },
	packages: { label: "Packages", order: 3 },
	cli: { label: "CLI", order: 4 },
}

export interface DocLink {
	/** Collection id, e.g. `guides/gateways`. */
	slug: string
	/** Site path, e.g. `/docs/guides/gateways`. */
	href: string
	/** Sidebar text. */
	label: string
	title: string
	description: string
}

export interface DocSection {
	id: string
	label: string
	items: DocLink[]
}

export function docHref(slug: string): string {
	return `/docs/${slug}`
}

/** The section id a slug belongs to (`""` for a page at the docs root). */
export function sectionOf(slug: string): string {
	const [head, ...rest] = slug.split("/")
	return rest.length > 0 ? (head ?? "") : ""
}

export function sectionLabel(id: string): string {
	return (
		SECTIONS[id]?.label ??
		id
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ")
	)
}

export async function getDocsNav(): Promise<DocSection[]> {
	const entries = await getCollection("docs")
	const grouped = new Map<string, DocLink[]>()

	for (const entry of entries) {
		const id = sectionOf(entry.id)
		const items = grouped.get(id) ?? []
		items.push({
			slug: entry.id,
			href: docHref(entry.id),
			label: entry.data.sidebar?.label ?? entry.data.title,
			title: entry.data.title,
			description: entry.data.description,
		})
		grouped.set(id, items)
	}

	const orderOf = new Map<string, number>(
		entries.map((entry) => [entry.id, entry.data.sidebar?.order ?? Number.MAX_SAFE_INTEGER]),
	)

	return [...grouped.entries()]
		.map(([id, items]) => ({
			id,
			label: sectionLabel(id),
			items: items.sort((a, b) => {
				const delta = (orderOf.get(a.slug) ?? 0) - (orderOf.get(b.slug) ?? 0)
				return delta !== 0 ? delta : a.label.localeCompare(b.label)
			}),
		}))
		.sort((a, b) => {
			const rank = (id: string) => SECTIONS[id]?.order ?? Number.MAX_SAFE_INTEGER
			const delta = rank(a.id) - rank(b.id)
			return delta !== 0 ? delta : a.label.localeCompare(b.label)
		})
}

/** Every page in sidebar order — the reading sequence the pager walks. */
export function flattenDocs(nav: DocSection[]): DocLink[] {
	return nav.flatMap((section) => section.items)
}

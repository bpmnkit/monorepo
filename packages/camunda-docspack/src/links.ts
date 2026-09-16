/**
 * Rewriting Camunda's in-repo links to absolute documentation URLs.
 *
 * A chunk is read far away from the tree it came from, so `](/components/foo.md#bar)` and
 * `](../naming-bpmn-elements/)` are worse than no link: they look resolvable and are not.
 * Docusaurus serves `docs/` at `/docs/next/<path minus extension>/`, and nothing in the
 * selected corpus overrides its URL with frontmatter `slug`, so the file path is the URL.
 */

/** Where the unreleased tree is published. */
export const SITE_URL = "https://docs.camunda.io/docs/next"

const INLINE_LINK = /\]\(([^)\s]+)(\s+"[^"]*")?\)/g

/**
 * Rewrite every relative link in one document.
 *
 * @param markdown document body
 * @param slug the document's own path under `docs/`, without extension
 */
export function absoluteLinks(markdown: string, slug: string): string {
	return markdown.replace(INLINE_LINK, (match, target: string, title = "") => {
		const url = resolve(target, slug)
		return url === undefined ? match : `](${url}${title})`
	})
}

function resolve(target: string, slug: string): string | undefined {
	if (target === "" || /^[a-z][\w+.-]*:/i.test(target) || target.startsWith("#")) return undefined

	const [rawPath = "", hash = ""] = splitHash(target)
	if (rawPath === "") return undefined

	// Camunda writes relative links both ways, and Docusaurus resolves them differently.
	//
	// A link naming a file — `./sizing-your-environment.md` — is a file reference, resolved
	// against the directory the linking document sits in. A link without an extension —
	// `../naming-bpmn-elements/` — is left as a URL for the browser, which resolves it against
	// the page's own trailing-slash URL, making the slug itself the base directory.
	//
	// Applying either rule to both forms breaks roughly a third of the corpus's links.
	const isFile = /\.mdx?$/.test(rawPath)
	const base = isFile ? slug.split("/").slice(0, -1) : slug.split("/")
	const path = rawPath.startsWith("/") ? rawPath.slice(1) : joinRelative(base, rawPath)
	if (path === undefined) return undefined

	// An image or download keeps its extension and is served from the site root, not from the
	// docs tree; only a page reference loses `.md` and gains the version prefix.
	const page = path.replace(/\.mdx?$/, "")
	if (page === path && /\.[a-z0-9]{2,5}$/i.test(path)) return undefined

	return `${SITE_URL}/${trimSlashes(page)}${hash}`
}

function splitHash(target: string): [string, string] {
	const index = target.indexOf("#")
	return index === -1 ? [target, ""] : [target.slice(0, index), target.slice(index)]
}

/** Apply `.` and `..` segments against the linking document's own directory. */
function joinRelative(base: string[], target: string): string | undefined {
	const segments = [...base]
	for (const part of target.split("/")) {
		if (part === "" || part === ".") continue
		if (part === "..") {
			if (segments.pop() === undefined) return undefined
			continue
		}
		segments.push(part)
	}
	return segments.join("/")
}

function trimSlashes(value: string): string {
	return value.replace(/^\/+|\/+$/g, "")
}

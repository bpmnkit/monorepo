/** Derives a stable, readable element id from a step name, deduping against ids already used in this plan. */
export function slugify(text: string): string {
	const slug = text
		.trim()
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
	return slug.length > 0 ? slug : "element"
}

/** Returns a unique id: `base`, or `base_2`, `base_3`, … if `base` is already taken. */
export function uniqueId(base: string, taken: Set<string>): string {
	if (!taken.has(base)) {
		taken.add(base)
		return base
	}
	let n = 2
	while (taken.has(`${base}_${n}`)) n++
	const id = `${base}_${n}`
	taken.add(id)
	return id
}

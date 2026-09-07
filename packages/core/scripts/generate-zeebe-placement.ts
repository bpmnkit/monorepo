/**
 * Generates `src/bpmn/zeebe-placement.ts` from the vendored descriptors.
 *
 *   pnpm --filter @bpmnkit/core generate:placement
 *   pnpm --filter @bpmnkit/core generate:placement --check
 *
 * `zeebe.json` records, per extension type, a `meta.allowedIn` list of the BPMN
 * types that extension may be used on. Those entries are frequently abstract
 * (`bpmn:Event`, `bpmn:Activity`) or are themselves Zeebe aliases for a set of
 * BPMN types (`zeebe:ZeebeServiceTask`), so the list is not directly usable at
 * runtime. This resolves both against `bpmn.json`'s type graph and writes out
 * concrete element names, which is all the runtime check then needs to do a set
 * lookup — no descriptor is read, parsed or shipped at runtime.
 *
 * `--check` regenerates and compares, so a descriptor bump that moves the
 * surface fails CI instead of leaving the table quietly stale.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DESCRIPTORS = join(ROOT, "descriptors")
const OUTPUT = join(ROOT, "src", "bpmn", "zeebe-placement.ts")

interface DescriptorType {
	name: string
	superClass?: string[]
	extends?: string[]
	isAbstract?: boolean
	meta?: { allowedIn?: string[] }
}

interface Descriptor {
	name: string
	prefix: string
	types: DescriptorType[]
}

function load(file: string): Descriptor {
	return JSON.parse(readFileSync(join(DESCRIPTORS, file), "utf-8")) as Descriptor
}

/** Both descriptors declare `xml.tagAlias: "lowerCase"`, so this is their rule. */
function tagOf(prefix: string, typeName: string): string {
	const local = typeName.includes(":") ? typeName.split(":")[1] : typeName
	if (local === undefined || local.length === 0) throw new Error(`unnamed type: ${typeName}`)
	return `${prefix}:${local[0]?.toLowerCase()}${local.slice(1)}`
}

function qualify(prefix: string, name: string): string {
	return name.includes(":") ? name : `${prefix}:${name}`
}

const bpmn = load("bpmn.json")
const zeebe = load("zeebe.json")

/** Every BPMN type that is `name` or descends from it, concrete ones only. */
const bpmnDescendants = new Map<string, Set<string>>()
{
	const parents = new Map<string, string[]>()
	for (const type of bpmn.types) {
		parents.set(
			qualify(bpmn.prefix, type.name),
			(type.superClass ?? []).map((name) => qualify(bpmn.prefix, name)),
		)
	}

	const ancestorsOf = (start: string): Set<string> => {
		const seen = new Set<string>([start])
		const queue = [start]
		for (let at = 0; at < queue.length; at++) {
			const current = queue[at]
			if (current === undefined) continue
			for (const parent of parents.get(current) ?? []) {
				if (seen.has(parent)) continue
				seen.add(parent)
				queue.push(parent)
			}
		}
		return seen
	}

	for (const type of bpmn.types) {
		if (type.isAbstract === true) continue
		const self = qualify(bpmn.prefix, type.name)
		for (const ancestor of ancestorsOf(self)) {
			const bucket = bpmnDescendants.get(ancestor) ?? new Set<string>()
			bucket.add(self)
			bpmnDescendants.set(ancestor, bucket)
		}
	}
}

/**
 * A Zeebe type with `extends` is an alias: it attaches its properties to the
 * BPMN types it names, so `allowedIn: ["zeebe:ZeebeServiceTask"]` means those.
 */
const zeebeAliases = new Map<string, string[]>()
for (const type of zeebe.types) {
	if (type.extends !== undefined && type.extends.length > 0) {
		zeebeAliases.set(qualify(zeebe.prefix, type.name), type.extends)
	}
}

/** Expands one `allowedIn` entry to the concrete element tags it permits. */
function resolve(entry: string, seen: Set<string>): string[] {
	if (seen.has(entry)) return []
	seen.add(entry)

	const alias = zeebeAliases.get(entry)
	if (alias !== undefined) return alias.flatMap((name) => resolve(name, seen))

	if (entry.startsWith("bpmn:")) {
		const concrete = bpmndDescendantsOf(entry)
		if (concrete.length > 0) return concrete
		// Not a known BPMN type — leave it for the caller to report.
		return []
	}

	// A Zeebe type that is neither an alias nor BPMN: the extension nests inside
	// another extension element rather than sitting on a BPMN element.
	return [tagOf(zeebe.prefix, entry)]
}

function bpmndDescendantsOf(entry: string): string[] {
	return [...(bpmnDescendants.get(entry) ?? [])]
		.map((name) => tagOf(bpmn.prefix, name))
		.sort((left, right) => left.localeCompare(right))
}

const unresolved: string[] = []
const table = new Map<string, string[]>()
for (const type of zeebe.types) {
	const allowedIn = type.meta?.allowedIn
	if (allowedIn === undefined) continue

	const owners = new Set<string>()
	for (const entry of allowedIn) {
		const resolved = resolve(entry, new Set())
		if (resolved.length === 0) unresolved.push(`${type.name}: ${entry}`)
		for (const owner of resolved) owners.add(owner)
	}
	table.set(
		tagOf(zeebe.prefix, type.name),
		[...owners].sort((left, right) => left.localeCompare(right)),
	)
}

if (unresolved.length > 0) {
	throw new Error(
		[
			"allowedIn entries that resolved to nothing:",
			...unresolved.map((entry) => `  ${entry}`),
			"Either the descriptor names a type bpmn.json does not define, or it is abstract",
			"with no concrete subtype.",
		].join("\n"),
	)
}

const rows = [...table.entries()].sort(([left], [right]) => left.localeCompare(right))

const source = `// Generated by scripts/generate-zeebe-placement.ts — do not edit.
// Source: descriptors/zeebe.json (zeebe-bpmn-moddle, MIT) resolved against
// descriptors/bpmn.json (bpmn-moddle, MIT). Regenerate with:
//   pnpm --filter @bpmnkit/core generate:placement

/**
 * Where each Zeebe extension element may be placed, keyed by element name.
 *
 * The value is the set of element names that may own it. Owners are BPMN
 * elements for extensions that sit in an \`extensionElements\` bag, and Zeebe
 * elements for the few that nest inside another extension.
 *
 * An extension absent from this table is one the descriptor says nothing about;
 * see \`isZeebePlacementAllowed\` for what that means.
 */
export const ZEEBE_PLACEMENT: Readonly<Record<string, readonly string[]>> = {
${rows.map(([tag, owners]) => `\t"${tag}": [${owners.map((owner) => `"${owner}"`).join(", ")}],`).join("\n")}
} as const
`

if (process.argv.includes("--check")) {
	// Compare the table, not the file. Biome owns the formatting of the generated
	// source, so a byte comparison would report the table stale every time Biome
	// wrapped a line differently — and a check that cries wolf gets disabled.
	const { ZEEBE_PLACEMENT } = (await import("../src/bpmn/zeebe-placement.js")) as {
		ZEEBE_PLACEMENT: Record<string, readonly string[]>
	}
	const expected = JSON.stringify(Object.fromEntries(rows))
	const actual = JSON.stringify(
		Object.fromEntries(
			Object.entries(ZEEBE_PLACEMENT).sort(([left], [right]) => left.localeCompare(right)),
		),
	)
	if (expected !== actual) {
		console.error(
			[
				"src/bpmn/zeebe-placement.ts no longer matches the descriptors.",
				"Run: pnpm --filter @bpmnkit/core generate:placement",
			].join("\n"),
		)
		process.exit(1)
	}
	console.log(`zeebe-placement.ts is up to date (${rows.length} extensions).`)
} else {
	writeFileSync(OUTPUT, source)
	console.log(`Wrote ${OUTPUT} (${rows.length} extensions). Run biome to format it.`)
}

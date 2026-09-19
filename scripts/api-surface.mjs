#!/usr/bin/env node
/**
 * api-surface.mjs
 *
 * Records the public API of every package in `STABLE`, and fails when it changes
 * without the snapshot being updated.
 *
 * The 1.0 promise is that these packages' exports will not change shape without a
 * major version. Nothing in this repo could see that happen: `tsc` is happy when an
 * export disappears, the tests only cover what they import, and `check:consumable`
 * checks that entry points *resolve*, not what is behind them. So a rename could
 * reach npm as a patch and the first report would be someone's broken build.
 *
 * What is recorded is the name and kind of everything each declared entry point
 * exports — read from the built `.d.ts` through the TypeScript compiler, so it is
 * the surface consumers actually get rather than what `src/index.ts` appears to say.
 * Signatures are deliberately *not* recorded: they churn on every internal rename and
 * would make the snapshot noise rather than signal. This catches the removals and
 * renames, which are the breaking half; the type-level rules in the stability policy
 * are the reviewer's job.
 *
 * Usage:
 *   node scripts/api-surface.mjs            # update the snapshot
 *   node scripts/api-surface.mjs --check    # fail if it is out of date (CI)
 *
 * Requires a build first — it reads `dist/`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { STABLE } from "./published-packages.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SNAPSHOT = resolve(ROOT, "api-surface.json")

const check = process.argv.includes("--check")

/** The `.d.ts` each declared entry point resolves to, keyed by its subpath. */
function entryPoints(dir, manifest) {
	const found = new Map()

	const walk = (value, subpath) => {
		if (typeof value === "string") {
			if (value.endsWith(".d.ts")) found.set(subpath, value)
			return
		}
		if (!value || typeof value !== "object") return
		for (const [key, entry] of Object.entries(value)) {
			walk(entry, key.startsWith(".") ? key : subpath)
		}
	}
	walk(manifest.exports, ".")

	// A package whose `exports` names only `.js` still has declarations beside them.
	if (found.size === 0 && manifest.exports) {
		const walkJs = (value, subpath) => {
			if (typeof value === "string") {
				if (value.endsWith(".js")) {
					const dts = value.replace(/\.js$/, ".d.ts")
					if (existsSync(resolve(ROOT, dir, dts))) found.set(subpath, dts)
				}
				return
			}
			if (!value || typeof value !== "object") return
			for (const [key, entry] of Object.entries(value)) {
				walkJs(entry, key.startsWith(".") ? key : subpath)
			}
		}
		walkJs(manifest.exports, ".")
	}

	return found
}

/**
 * Every name a declaration file exports, with the kind it is.
 *
 * `type` and `value` are tracked apart because moving between them is breaking in
 * one direction: code that did `new Thing()` stops compiling when `Thing` becomes a
 * type, and the name alone would not show it.
 */
function surfaceOf(dtsPath) {
	const program = ts.createProgram([dtsPath], {
		noResolve: false,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	})
	const checker = program.getTypeChecker()
	const source = program.getSourceFile(dtsPath)
	if (!source) return null

	const moduleSymbol = checker.getSymbolAtLocation(source)
	if (!moduleSymbol) return {}

	const VALUE_FLAGS =
		ts.SymbolFlags.Variable |
		ts.SymbolFlags.Function |
		ts.SymbolFlags.Class |
		ts.SymbolFlags.Enum |
		ts.SymbolFlags.EnumMember |
		ts.SymbolFlags.ValueModule

	const surface = {}
	for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
		// An entry point is a barrel, so nearly every symbol here is an alias for the
		// declaration in the module it re-exports from. An alias carries `Alias` and
		// nothing else, so reading its flags directly reports every re-exported class
		// and function as a type — which is how `ParseError`, `Bpmn` and
		// `ProcessBuilder` were first recorded, and would have made the value/type
		// half of this check worse than useless.
		const resolved =
			symbol.getFlags() & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
		surface[symbol.getName()] = resolved.getFlags() & VALUE_FLAGS ? "value" : "type"
	}
	return Object.fromEntries(Object.entries(surface).sort(([a], [b]) => (a < b ? -1 : 1)))
}

function build() {
	const snapshot = {}
	for (const dir of STABLE) {
		const manifestPath = resolve(ROOT, dir, "package.json")
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
		const entries = entryPoints(dir, manifest)

		// A bin-only package (`@bpmnkit/cli`) has no declarations to record. Its
		// contract is its command surface, which the stability policy covers in prose.
		if (entries.size === 0) continue

		const byEntry = {}
		for (const [subpath, target] of [...entries].sort(([a], [b]) => (a < b ? -1 : 1))) {
			const dtsPath = resolve(ROOT, dir, target)
			if (!existsSync(dtsPath)) {
				console.error(`  ✗  ${manifest.name} ${subpath}: ${target} not built — run the build first`)
				process.exit(1)
			}
			const surface = surfaceOf(dtsPath)
			if (surface === null) continue
			byEntry[subpath] = surface
		}
		snapshot[manifest.name] = byEntry
	}
	return snapshot
}

/** What changed, in the direction that matters: gone, renamed kind, added. */
function diff(before, after) {
	const removed = []
	const changed = []
	const added = []

	for (const [pkg, entries] of Object.entries(before)) {
		for (const [subpath, names] of Object.entries(entries)) {
			const now = after[pkg]?.[subpath]
			if (!now) {
				removed.push(`${pkg}${subpath === "." ? "" : subpath.slice(1)} — entry point gone`)
				continue
			}
			for (const [name, kind] of Object.entries(names)) {
				if (!(name in now)) removed.push(`${pkg}${subpath.slice(1)} → ${name}`)
				else if (now[name] !== kind) {
					changed.push(`${pkg}${subpath.slice(1)} → ${name}: ${kind} became ${now[name]}`)
				}
			}
		}
	}
	for (const [pkg, entries] of Object.entries(after)) {
		for (const [subpath, names] of Object.entries(entries)) {
			const was = before[pkg]?.[subpath]
			if (!was) {
				added.push(`${pkg}${subpath === "." ? "" : subpath.slice(1)} — new entry point`)
				continue
			}
			for (const name of Object.keys(names)) {
				if (!(name in was)) added.push(`${pkg}${subpath.slice(1)} → ${name}`)
			}
		}
	}
	return { removed, changed, added }
}

const current = build()
const total = Object.values(current).reduce(
	(sum, entries) =>
		sum + Object.values(entries).reduce((n, names) => n + Object.keys(names).length, 0),
	0,
)

if (!check) {
	writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, "\t")}\n`, "utf8")
	console.log(`✓  Recorded ${total} exports across ${Object.keys(current).length} packages.\n`)
	process.exit(0)
}

if (!existsSync(SNAPSHOT)) {
	console.error("✗  No api-surface.json — run `node scripts/api-surface.mjs` and commit it.\n")
	process.exit(1)
}

const recorded = JSON.parse(readFileSync(SNAPSHOT, "utf8"))
const { removed, changed, added } = diff(recorded, current)

if (removed.length === 0 && changed.length === 0 && added.length === 0) {
	console.log(
		`✓  API surface unchanged — ${total} exports across ${Object.keys(current).length} packages.\n`,
	)
	process.exit(0)
}

console.error("The public API of a 1.0 package changed.\n")
for (const line of removed) console.error(`  ✗  removed   ${line}`)
for (const line of changed) console.error(`  ✗  kind      ${line}`)
for (const line of added) console.error(`  +  added     ${line}`)

console.error(
	[
		"",
		"Additions are a minor. Removals, renames and kind changes are a MAJOR —",
		"see https://bpmnkit.com/docs/getting-started/stability.",
		"",
		"Either way the snapshot has to be refreshed and committed, so the diff is",
		"reviewed rather than accumulated: a stale baseline cannot catch the removal",
		"of an export that was added after it was last written.",
		"",
		"    node scripts/api-surface.mjs",
		"",
	].join("\n"),
)
process.exit(1)

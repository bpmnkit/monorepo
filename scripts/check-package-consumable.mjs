#!/usr/bin/env node
/**
 * check-package-consumable.mjs
 *
 * Opens each published tarball and consumes it the way npm users will.
 *
 * `check-packages.mjs` reads package.json and can only tell you the metadata is
 * present. It cannot tell you that `exports` points at a file the tarball does
 * not contain, that the `.d.ts` never got built, or that the published types do
 * not compile under the settings a modern consumer uses. Those ship silently and
 * are found by whoever installs the release.
 *
 * For each package this:
 *   1. runs `pnpm pack` — which rewrites `workspace:*` to real versions, the
 *      thing `npm pack` does not do and the reason the tarballs are unusable
 *      without it;
 *   2. checks every path the manifest declares (`main`, `types`, `module`,
 *      `bin`, and every `exports` target) is actually in the tarball;
 *   3. installs it into a throwaway project, with sibling `@bpmnkit/*` tarballs
 *      overriding the registry so it is *this* build being tested;
 *   4. imports every ESM entry point;
 *   5. type-checks a consumer under `strict` + `NodeNext` with `skipLibCheck`
 *      off, so the shipped declarations are compiled rather than trusted.
 *
 * Steps 3-5 install from the network and are slow — 23 packages, one project
 * each. This belongs in the release workflow, not on every PR.
 *
 * Usage:
 *   node scripts/check-package-consumable.mjs
 *   node scripts/check-package-consumable.mjs --filter core --filter feel
 *   node scripts/check-package-consumable.mjs --pack-only   # offline, no install
 *   node scripts/check-package-consumable.mjs --keep        # leave the temp dir
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PUBLISHED } from "./published-packages.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))

const args = process.argv.slice(2)
const filters = args.flatMap((arg, index) =>
	arg === "--filter" ? [args[index + 1]].filter(Boolean) : [],
)
const packOnly = args.includes("--pack-only")
const keep = args.includes("--keep")

/** Extensions Node will load from an ESM `import`. */
const IMPORTABLE = [".js", ".mjs", ".cjs", ".node"]

function run(command, commandArgs, options = {}) {
	return execFileSync(command, commandArgs, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	})
}

/**
 * Walks an `exports` value to every target path it can resolve to, remembering
 * the subpath and conditions each one sits under.
 *
 * `exports` is a string, a map of subpaths, a map of conditions, or any nesting
 * of those, and an array means "first one that works". All of them end at
 * strings starting with `./`, which are the files that have to exist.
 */
function collectExports(value, subpath, conditions, into) {
	if (value === null) return
	if (typeof value === "string") {
		into.push({ subpath, conditions, target: value })
		return
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectExports(entry, subpath, conditions, into)
		return
	}
	if (typeof value !== "object") return

	for (const [key, entry] of Object.entries(value)) {
		if (key.startsWith(".")) {
			collectExports(entry, key, conditions, into)
		} else {
			collectExports(entry, subpath, [...conditions, key], into)
		}
	}
}

/** Every file path the manifest promises, with a label for the error message. */
function declaredEntries(manifest) {
	const entries = []
	for (const field of ["main", "module", "types", "typings"]) {
		if (typeof manifest[field] === "string") {
			entries.push({ label: field, target: manifest[field] })
		}
	}
	if (typeof manifest.bin === "string") {
		entries.push({ label: "bin", target: manifest.bin })
	} else if (manifest.bin && typeof manifest.bin === "object") {
		for (const [name, target] of Object.entries(manifest.bin)) {
			if (typeof target === "string") entries.push({ label: `bin.${name}`, target })
		}
	}

	const exported = []
	if (manifest.exports !== undefined) collectExports(manifest.exports, ".", [], exported)
	for (const entry of exported) {
		const where = entry.conditions.length > 0 ? ` (${entry.conditions.join(" > ")})` : ""
		entries.push({
			label: `exports["${entry.subpath}"]${where}`,
			target: entry.target,
			subpath: entry.subpath,
			conditions: entry.conditions,
		})
	}
	return entries
}

function normalise(target) {
	return target.replace(/^\.\//, "")
}

/** Files inside the tarball, as paths relative to the package root. */
function tarballFiles(tarball) {
	return new Set(
		run("tar", ["-tzf", tarball])
			.split("\n")
			.filter(Boolean)
			.map((line) => line.replace(/^package\//, "").replace(/\/$/, "")),
	)
}

/**
 * Everything is packed, always; `--filter` only narrows what gets *consumed*.
 *
 * The overrides that make a consumer resolve `@bpmnkit/*` to this build have to
 * cover the whole set. Packing only the filtered packages leaves their siblings
 * resolving from the registry, so a filtered run quietly tests the last
 * published version of half the tree — or fails with a 404 that looks like a
 * broken package rather than a broken harness. Packing is offline and cheap.
 */
const consumed = new Set(
	PUBLISHED.filter((dir) => filters.length === 0 || filters.some((filter) => dir.includes(filter))),
)

const workDir = mkdtempSync(join(tmpdir(), "bpmnkit-consumable-"))
const tarballDir = join(workDir, "tarballs")
mkdirSync(tarballDir)

const failures = []
/** Problems in packages this run was not asked about. Reported, never fatal. */
const aside = []
const packed = []

console.log(`Packing ${PUBLISHED.length} package(s) into ${tarballDir}\n`)

for (const dir of PUBLISHED) {
	const manifest = JSON.parse(readFileSync(resolve(ROOT, dir, "package.json"), "utf8"))
	const name = manifest.name ?? dir

	let output
	try {
		output = run("pnpm", ["pack", "--pack-destination", tarballDir], { cwd: resolve(ROOT, dir) })
	} catch (error) {
		failures.push(`${name}: pnpm pack failed — ${String(error.stderr || error.message).trim()}`)
		continue
	}

	const tarball = output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.endsWith(".tgz"))
		.pop()
	if (!tarball) {
		failures.push(`${name}: pnpm pack printed no tarball path`)
		continue
	}

	const files = tarballFiles(tarball)
	const entries = declaredEntries(manifest)
	const missing = entries.filter((entry) => !files.has(normalise(entry.target)))
	for (const entry of missing) {
		const problem = `${name}: ${entry.label} points at "${entry.target}", not in the tarball`
		// Everything is packed even for a filtered run, so a package the caller did
		// not ask about must not fail their run — it would report a problem they
		// cannot act on and did not cause. The unfiltered run, which is the one the
		// release uses, still fails on it.
		if (consumed.has(dir)) failures.push(problem)
		else aside.push(problem)
	}

	// A packed manifest still naming a workspace protocol would install nowhere.
	const packedManifest = JSON.parse(
		run("tar", ["-xzOf", tarball, "package/package.json"], { maxBuffer: 32 * 1024 * 1024 }),
	)
	for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
		for (const [dep, range] of Object.entries(packedManifest[field] ?? {})) {
			if (String(range).startsWith("workspace:")) {
				const problem = `${name}: ${field}["${dep}"] is still "${range}" in the tarball`
				if (consumed.has(dir)) failures.push(problem)
				else aside.push(problem)
			}
		}
	}

	packed.push({
		dir,
		name,
		manifest,
		packedManifest,
		tarball,
		entries,
		ok: missing.length === 0,
		consume: consumed.has(dir),
	})
	console.log(
		`  ${missing.length === 0 ? "✓" : "✗"}  ${name}  (${entries.length} declared entries)`,
	)
}

if (!packOnly) {
	const overrides = Object.fromEntries(packed.map((entry) => [entry.name, `file:${entry.tarball}`]))

	console.log("\nConsuming each tarball from a throwaway project...\n")

	for (const entry of packed) {
		if (!entry.consume) continue
		if (!entry.ok) {
			console.log(`  –  ${entry.name}  (skipped, entries missing)`)
			continue
		}

		const projectDir = join(workDir, "consumers", entry.name.replace(/[@/]/g, "_"))
		mkdirSync(projectDir, { recursive: true })

		// Everything the package depends on that we also publish has to come from
		// this build, not from whatever the registry currently holds.
		writeFileSync(
			join(projectDir, "package.json"),
			`${JSON.stringify(
				{
					name: "consumer",
					private: true,
					version: "1.0.0",
					type: "module",
					dependencies: { [entry.name]: `file:${entry.tarball}`, typescript: "^5.0.0" },
					overrides,
				},
				null,
				2,
			)}\n`,
		)

		try {
			run("npm", ["install", "--no-audit", "--no-fund"], { cwd: projectDir })
		} catch (error) {
			failures.push(
				`${entry.name}: installing the tarball failed — ${String(error.stderr || error.message)
					.trim()
					.split("\n")
					.slice(-4)
					.join(" ")}`,
			)
			console.log(`  ✗  ${entry.name}  (install)`)
			continue
		}

		const importable = []
		const typed = new Set()
		for (const declared of entry.entries) {
			if (declared.subpath === undefined) continue
			if (declared.subpath.includes("*")) continue
			const specifier =
				declared.subpath === "." ? entry.name : `${entry.name}/${declared.subpath.slice(2)}`
			if (declared.conditions.includes("types")) typed.add(specifier)
			const importCondition =
				declared.conditions.length === 0 ||
				declared.conditions.includes("import") ||
				declared.conditions.includes("default")
			if (importCondition && IMPORTABLE.some((ext) => declared.target.endsWith(ext))) {
				importable.push(specifier)
			}
		}

		let problem
		for (const specifier of importable) {
			try {
				run(
					process.execPath,
					["--input-type=module", "-e", `await import(${JSON.stringify(specifier)})`],
					{
						cwd: projectDir,
					},
				)
			} catch (error) {
				problem = `importing "${specifier}" threw — ${String(error.stderr || error.message)
					.trim()
					.split("\n")
					.slice(0, 3)
					.join(" ")}`
				break
			}
		}

		if (problem === undefined && typed.size > 0) {
			writeFileSync(
				join(projectDir, "tsconfig.json"),
				`${JSON.stringify(
					{
						compilerOptions: {
							strict: true,
							module: "nodenext",
							moduleResolution: "nodenext",
							target: "es2022",
							noEmit: true,
							// Off on purpose: the point is to compile the declarations we
							// ship, not to take their word for it.
							skipLibCheck: false,
							types: [],
						},
						include: ["consumer.ts"],
					},
					null,
					2,
				)}\n`,
			)
			writeFileSync(
				join(projectDir, "consumer.ts"),
				`${[...typed]
					.map((specifier, index) => `import * as m${index} from ${JSON.stringify(specifier)}`)
					.join(
						"\n",
					)}\nexport const used: unknown[] = [${[...typed].map((_, index) => `m${index}`).join(", ")}]\n`,
			)
			try {
				run(join(projectDir, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], {
					cwd: projectDir,
				})
			} catch (error) {
				problem = `strict NodeNext consumer does not compile —\n      ${String(
					error.stdout || error.message,
				)
					.trim()
					.split("\n")
					.slice(0, 8)
					.join("\n      ")}`
			}
		}

		if (problem === undefined) {
			// A package with nothing importable and nothing typed passes without
			// having been consumed at all. That is right for one that ships source
			// for a bundler to read, and a false green for anything else, so say so
			// rather than printing a tick that stands for nothing.
			const verified = importable.length + typed.size
			const detail = `(${importable.length} imported, ${typed.size} type-checked)`
			console.log(
				verified === 0
					? `  ~  ${entry.name}  ${detail} — nothing to consume from Node`
					: `  ✓  ${entry.name}  ${detail}`,
			)
		} else {
			failures.push(`${entry.name}: ${problem}`)
			console.log(`  ✗  ${entry.name}`)
		}
	}
}

if (keep) {
	console.log(`\nLeft behind: ${workDir}`)
} else {
	rmSync(workDir, { recursive: true, force: true })
}

if (aside.length > 0) {
	console.log(`\nOutside this run's filter (not counted):\n`)
	for (const note of aside) console.log(`  !  ${note}`)
}

if (failures.length > 0) {
	console.error(`\n${failures.length} problem(s):\n`)
	for (const failure of failures) console.error(`  ✗  ${failure}`)
	console.error("")
	process.exit(1)
}

console.log(`\n✓  ${packed.filter((entry) => entry.consume).length} package(s) consumable.\n`)

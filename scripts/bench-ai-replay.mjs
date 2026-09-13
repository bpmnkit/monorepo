#!/usr/bin/env node
/**
 * bench-ai-replay — re-run recorded SDK generations against the current build
 *
 * Usage:  node scripts/bench-ai-replay.mjs [--out <file>] [--print]
 *
 * The recordings in `apps/demo/recordings/` are frozen: they capture what a
 * model wrote in July 2026 and what happened when the library of that day ran
 * it. When the library changes, the code the model wrote does not — so running
 * that same code again isolates the library's contribution from the model's.
 *
 * This replays every `with-sdk` run's generated TypeScript against the current
 * `@bpmnkit/core` and scores the result exactly as `bench-ai-generation.mjs`
 * scores the originals. It measures the library, not the prompt: a fresh
 * generation would also reflect prompt changes, and needs the demo's `claude`
 * CLI.
 *
 * Every run is replayed, not only the ones that failed, so a fix that broke a
 * previously working run would show up rather than hide.
 *
 * This executes model-written code from the recordings with `tsx`, in-process
 * of your shell — the same thing `apps/demo` does when recording. Read a
 * recording before trusting it.
 *
 * Requires a build: `pnpm turbo build --filter @bpmnkit/core`.
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Bpmn, checkDiCompleteness } from "../packages/core/dist/index.js"

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const RECORDINGS = join(ROOT, "apps/demo/recordings")
const CORE = join(ROOT, "packages/core/dist/index.js")
const DEFAULT_OUT = join(ROOT, "apps/landing/src/generated/ai-benchmark-replay.ts")

const args = process.argv.slice(2)
const outArg = args.indexOf("--out")
const out = outArg !== -1 ? resolve(args[outArg + 1]) : DEFAULT_OUT

/** Pull the TypeScript the model wrote out of its streamed chunks. */
function extractTs(chunks) {
	const text = chunks.map((c) => c.text).join("")
	const fenced = text.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/)
	return fenced ? fenced[1].trim() : null
}

/** Run one generated program and return its BPMN, or the error it died on. */
function execute(code, dir, name) {
	// The recordings import the package by name; point that at this workspace's
	// build so the replay measures this build and not an installed copy.
	const runnable = code.replace(/from ["']@bpmnkit\/core["']/g, `from ${JSON.stringify(CORE)}`)
	const file = join(dir, `${name}.mts`)
	writeFileSync(file, runnable, "utf8")

	const result = spawnSync("npx", ["tsx", file], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 120_000,
		maxBuffer: 32 * 1024 * 1024,
	})
	if (result.status !== 0) {
		const stderr = (result.stderr ?? "").trim()
		const line = stderr.split("\n").find((l) => /Error|error TS/.test(l)) ?? stderr.split("\n")[0]
		return { ok: false, error: (line ?? "unknown failure").slice(0, 200) }
	}
	const xml = (result.stdout ?? "").trim()
	if (!xml.includes("<bpmn:definitions")) return { ok: false, error: "produced no BPMN on stdout" }
	return { ok: true, xml }
}

/** Score exactly as bench-ai-generation.mjs does, so the columns are comparable. */
function score(xml) {
	let defs
	try {
		defs = Bpmn.parse(xml)
	} catch (error) {
		return {
			parsed: false,
			diComplete: false,
			elements: null,
			parseError: String(error.message).slice(0, 160),
		}
	}
	const di = checkDiCompleteness(defs)
	let elements = 0
	const walk = (list) => {
		for (const el of list) {
			elements++
			if (el.flowElements?.length) walk(el.flowElements)
		}
	}
	for (const process of defs.processes) walk(process.flowElements)
	return {
		parsed: true,
		diComplete: di.missingShapes.length === 0 && di.missingEdges.length === 0,
		elements,
		parseError: null,
	}
}

const dir = mkdtempSync(join(tmpdir(), "bpmnkit-replay-"))
const runs = []
try {
	for (const file of readdirSync(RECORDINGS)
		.filter((f) => f.endsWith(".json"))
		.sort()) {
		const recording = JSON.parse(readFileSync(join(RECORDINGS, file), "utf8"))
		const panel = recording.panels["with-sdk"]
		if (!panel) continue

		const name = file.replace(/\.json$/, "")
		const scenario = recording.scenarioId ?? name.replace(/-\d{4}-\d{2}-\d{2}[a-z]?$/, "")
		const code = extractTs(panel.chunks)
		const originallyUsable = panel.result.type === "bpmn"

		if (!code) {
			runs.push({
				recording: name,
				scenario,
				originallyUsable,
				replayed: false,
				usable: false,
				elements: null,
				error: "no code block in the recorded output",
			})
			continue
		}

		const executed = execute(code, dir, name)
		if (!executed.ok) {
			runs.push({
				recording: name,
				scenario,
				originallyUsable,
				replayed: true,
				usable: false,
				elements: null,
				error: executed.error,
			})
			continue
		}
		const scored = score(executed.xml)
		runs.push({
			recording: name,
			scenario,
			originallyUsable,
			replayed: true,
			usable: scored.parsed && scored.diComplete,
			elements: scored.elements,
			error: scored.parseError,
		})
	}
} finally {
	rmSync(dir, { recursive: true, force: true })
}

const version = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")).version

const byScenario = {}
for (const run of runs) {
	byScenario[run.scenario] ??= { runs: 0, originallyUsable: 0, usable: 0 }
	const cell = byScenario[run.scenario]
	cell.runs++
	if (run.originallyUsable) cell.originallyUsable++
	if (run.usable) cell.usable++
}

const dataset = {
	generatedBy: "scripts/bench-ai-replay.mjs",
	coreVersion: version,
	totalRuns: runs.length,
	originallyUsable: runs.filter((r) => r.originallyUsable).length,
	usable: runs.filter((r) => r.usable).length,
	byScenario,
	runs,
}

const HEADER = `/**
 * The recorded SDK generations, re-run against the current \`@bpmnkit/core\`.
 *
 * **Auto-generated** by \`scripts/bench-ai-replay.mjs\`. The model's code is
 * frozen in the recordings, so replaying it isolates what the *library* changed
 * from what the model would do differently today. Do not edit by hand.
 *
 * This is a measurement, not a projection — but of the library only. A fresh
 * generation would also reflect prompt changes, and is not covered here.
 */

/** One recorded \`with-sdk\` run, re-executed. */
export interface ReplayRun {
	readonly recording: string
	readonly scenario: string
	/** Whether the run counted as usable when it was recorded. */
	readonly originallyUsable: boolean
	/** False when the recording carried no extractable code to re-run. */
	readonly replayed: boolean
	/** Parsed, and every element has a shape — the benchmark's own bar. */
	readonly usable: boolean
	readonly elements: number | null
	readonly error: string | null
}

export interface ReplayDataset {
	readonly generatedBy: string
	/** The \`@bpmnkit/core\` version the replay ran against. */
	readonly coreVersion: string
	readonly totalRuns: number
	readonly originallyUsable: number
	readonly usable: number
	readonly byScenario: Readonly<
		Record<string, { readonly runs: number; readonly originallyUsable: number; readonly usable: number }>
	>
	readonly runs: readonly ReplayRun[]
}

export const AI_BENCHMARK_REPLAY: ReplayDataset = `

writeFileSync(out, `${HEADER}${JSON.stringify(dataset, null, "\t")}\n`)
console.log(`wrote ${out} — ${runs.length} runs replayed against @bpmnkit/core ${version}`)

if (args.includes("--print")) {
	for (const run of runs) {
		const before = run.originallyUsable ? "usable" : "failed"
		const after = run.usable ? "usable" : `failed (${run.error})`
		console.log(`  ${run.recording.padEnd(28)} ${before.padEnd(7)} → ${after}`)
	}
	console.log(
		`\n  overall ${dataset.originallyUsable}/${dataset.totalRuns} → ${dataset.usable}/${dataset.totalRuns}`,
	)
}

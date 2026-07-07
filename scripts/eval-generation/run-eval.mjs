#!/usr/bin/env node
/**
 * Golden-prompt eval harness for AI-driven BPMN generation (WP7 of
 * doc/spec-bpmn-generation-skills.md).
 *
 * Two modes, auto-selected per prompt:
 *
 *   Plan-level (CI-safe, default, no LLM call): prompts that ship a
 *   `fixture.plan.json` are run through the real deterministic pipeline —
 *   `casen synth` -> `casen lint --profile deploy` -> `casen test` -> an
 *   attempted `casen deploy deploy` against local Reebe. This is what
 *   `pnpm turbo test` does NOT run (kept as a separate script per the WP7
 *   acceptance criteria) but is safe to run in CI: it never shells out to an
 *   LLM, and gracefully reports "skipped (Reebe unavailable)" for the deploy
 *   dimension rather than failing when no `reebe-server` binary is present
 *   (e.g. this sandboxed dev environment, which lacks the Rust toolchain to
 *   build it — see doc/progress.md's WP5 entry for the same, pre-existing gap).
 *
 *   Full LLM (opt-in via --full): every prompt (including ones with no
 *   fixture, e.g. the ambiguous-request prompt that expects a clarifying
 *   question rather than a diagram) is handed to a headless `claude -p`
 *   invocation with the bpmnkit-claude plugin loaded
 *   (`claude -p "<prompt>" --plugin-dir <repo>/plugins-claude/bpmnkit-claude
 *   --output-format json`), in a fresh temp working directory. The resulting
 *   `.bpmn` file (if any) is then run through the same gates. Requires the
 *   `claude` CLI on PATH; skipped gracefully (one line per prompt, not a
 *   failure) when it isn't found — this mode is not expected to run in CI.
 *
 * Usage:
 *   node scripts/eval-generation/run-eval.mjs             # plan-level subset only
 *   node scripts/eval-generation/run-eval.mjs --full      # + full LLM run
 *
 * Output: scripts/eval-generation/eval-report.json + a markdown summary
 * printed to stdout (and written to eval-report.md).
 */

import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..")
const PROMPTS_DIR = join(HERE, "prompts")
const CLI = join(ROOT, "apps/cli/dist/index.js")
const PLUGIN_DIR = join(ROOT, "plugins-claude/bpmnkit-claude")

const FULL_MODE = process.argv.includes("--full")
const ZEEBE_ADDRESS = (process.env.ZEEBE_ADDRESS ?? "http://localhost:26500").replace(/\/$/, "")

// ── Helpers ───────────────────────────────────────────────────────────────────

function runCli(args, cwd) {
	const start = Date.now()
	const res = spawnSync("node", [CLI, ...args], { cwd, encoding: "utf-8" })
	return {
		ok: res.status === 0,
		stdout: res.stdout ?? "",
		stderr: res.stderr ?? "",
		durationMs: Date.now() - start,
	}
}

async function reebeReachable() {
	try {
		const res = await fetch(`${ZEEBE_ADDRESS}/v2/topology`, { signal: AbortSignal.timeout(1500) })
		return res.ok
	} catch {
		return false
	}
}

function claudeAvailable() {
	const res = spawnSync("which", ["claude"], { encoding: "utf-8" })
	return res.status === 0
}

// ── Plan-level pipeline ───────────────────────────────────────────────────────

async function runPlanLevel(promptDir, expected, reebeUp) {
	const tmp = mkdtempSync(join(tmpdir(), "bpmnkit-eval-"))
	const result = {
		mode: "plan-level",
		iterations: 1,
		synthProblems: null,
		lintDeployErrors: null,
		testPassRate: null,
		deploy: "not-attempted",
		wallTimeMs: 0,
		errors: [],
	}
	const startedAt = Date.now()

	try {
		const planPath = join(promptDir, "fixture.plan.json")
		const bpmnPath = join(tmp, "out.bpmn")

		let mergeTarget
		if (existsSync(join(promptDir, "base.bpmn"))) {
			mergeTarget = join(tmp, "base.bpmn")
			writeFileSync(mergeTarget, readFileSync(join(promptDir, "base.bpmn"), "utf-8"))
		}

		const synthArgs = mergeTarget
			? ["synth", "synth", planPath, "--merge", mergeTarget, "--output", bpmnPath, "--json"]
			: ["synth", "synth", planPath, "--output", bpmnPath, "--json"]
		const synth = runCli(synthArgs, tmp)
		let synthJson
		try {
			synthJson = JSON.parse(synth.stdout)
		} catch {
			result.errors.push(`synth: unparseable output — ${synth.stderr.slice(0, 300)}`)
			return result
		}
		result.synthProblems = synthJson.problems?.length ?? null
		if (!synthJson.xml) {
			result.errors.push("synth produced no XML")
			return result
		}
		// --json mode never writes files (main .bpmn or the plan.tests sidecar) — re-run without
		// it to get the real on-disk artifacts, exactly as a user's `casen synth` invocation would.
		const nonJsonArgs = synthArgs.filter((a) => a !== "--json")
		runCli(nonJsonArgs, tmp)

		const lint = runCli(["lint", "lint", bpmnPath, "--profile", "deploy", "--format", "json"], tmp)
		try {
			const findings = JSON.parse(lint.stdout)
			result.lintDeployErrors = findings.filter((f) => f.severity === "error").length
		} catch {
			result.lintDeployErrors = lint.ok ? 0 : null
		}

		if (existsSync(`${bpmnPath}.tests.json`)) {
			const test = runCli(["test", "test", bpmnPath], tmp)
			const passMatch = test.stdout.match(/(\d+)\/(\d+) passed/)
			if (passMatch) {
				result.testPassRate = Number(passMatch[1]) / Math.max(1, Number(passMatch[2]))
			} else if (test.stderr.includes("reebe-wasm is not installed")) {
				// casen test runs scenarios via the WASM engine (@bpmnkit/reebe-wasm), which requires
				// a Rust/wasm-pack build this sandbox doesn't have — same pre-existing, environment-
				// specific gap as elsewhere in this repo. Not a real test failure: report it as such,
				// not as a 0% pass rate.
				result.testPassRate = null
				result.errors.push("test: skipped — @bpmnkit/reebe-wasm unavailable in this environment")
			} else {
				result.testPassRate = test.ok ? 1 : 0
			}
		} else {
			result.testPassRate = null // fixture declared no tests
		}

		if (reebeUp) {
			const deploy = runCli(["deploy", "deploy", bpmnPath], tmp)
			result.deploy = deploy.ok ? "green" : "failed"
			if (!deploy.ok) result.errors.push(`deploy: ${deploy.stderr.slice(0, 300)}`)
		} else {
			result.deploy = "skipped (Reebe unavailable)"
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true })
		result.wallTimeMs = Date.now() - startedAt
	}

	return result
}

// ── Full LLM pipeline ─────────────────────────────────────────────────────────

async function runFullLlm(promptText, reebeUp) {
	const tmp = mkdtempSync(join(tmpdir(), "bpmnkit-eval-llm-"))
	const result = {
		mode: "full-llm",
		iterations: null,
		synthProblems: null,
		lintDeployErrors: null,
		testPassRate: null,
		deploy: "not-attempted",
		wallTimeMs: 0,
		tokenCost: null,
		errors: [],
	}
	const startedAt = Date.now()

	try {
		let claudeOut
		try {
			claudeOut = execFileSync(
				"claude",
				["-p", promptText, "--plugin-dir", PLUGIN_DIR, "--output-format", "json"],
				{ cwd: tmp, encoding: "utf-8", timeout: 10 * 60 * 1000 },
			)
		} catch (err) {
			result.errors.push(`claude -p failed: ${err instanceof Error ? err.message : String(err)}`)
			return result
		}

		try {
			const parsed = JSON.parse(claudeOut)
			if (typeof parsed.total_cost_usd === "number") result.tokenCost = parsed.total_cost_usd
		} catch {
			/* claude's --output-format json shape may vary by version; cost is best-effort */
		}

		const bpmnFiles = readdirSync(tmp).filter((f) => f.endsWith(".bpmn"))
		if (bpmnFiles.length === 0) {
			result.errors.push(
				"no .bpmn file produced (may be an intentional clarifying-question prompt)",
			)
			return result
		}
		const bpmnPath = join(tmp, bpmnFiles[0])

		const lint = runCli(["lint", "lint", bpmnPath, "--profile", "deploy", "--format", "json"], tmp)
		try {
			const findings = JSON.parse(lint.stdout)
			result.lintDeployErrors = findings.filter((f) => f.severity === "error").length
		} catch {
			result.lintDeployErrors = lint.ok ? 0 : null
		}

		if (existsSync(`${bpmnPath}.tests.json`)) {
			const test = runCli(["test", "test", bpmnPath], tmp)
			const passMatch = test.stdout.match(/(\d+)\/(\d+) passed/)
			if (passMatch) {
				result.testPassRate = Number(passMatch[1]) / Math.max(1, Number(passMatch[2]))
			} else if (test.stderr.includes("reebe-wasm is not installed")) {
				result.testPassRate = null
				result.errors.push("test: skipped — @bpmnkit/reebe-wasm unavailable in this environment")
			} else {
				result.testPassRate = test.ok ? 1 : 0
			}
		}

		if (reebeUp) {
			const deploy = runCli(["deploy", "deploy", bpmnPath], tmp)
			result.deploy = deploy.ok ? "green" : "failed"
		} else {
			result.deploy = "skipped (Reebe unavailable)"
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true })
		result.wallTimeMs = Date.now() - startedAt
	}

	return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	if (!existsSync(CLI)) {
		console.error(`CLI not built at ${CLI} — run: pnpm --filter @bpmnkit/cli build`)
		process.exit(1)
	}

	const reebeUp = await reebeReachable()
	if (!reebeUp) {
		console.log(
			`Reebe not reachable at ${ZEEBE_ADDRESS} — the deploy dimension will be reported as skipped, not failed. Start it with: casen reebe start --port 26500`,
		)
	}

	const fullMode = FULL_MODE
	if (fullMode && !claudeAvailable()) {
		console.log("--full requested but `claude` is not on PATH — falling back to plan-level only.")
	}
	const runFull = fullMode && claudeAvailable()

	const promptDirs = readdirSync(PROMPTS_DIR, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort()

	const results = []
	for (const name of promptDirs) {
		const dir = join(PROMPTS_DIR, name)
		const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf-8"))
		const promptText = readFileSync(join(dir, "prompt.md"), "utf-8")

		const entry = { id: expected.id ?? name, category: expected.category, expected }

		if (existsSync(join(dir, "fixture.plan.json"))) {
			entry.planLevel = await runPlanLevel(dir, expected, reebeUp)
			console.log(
				`[plan-level] ${entry.id}: synthProblems=${entry.planLevel.synthProblems} lintErrors=${entry.planLevel.lintDeployErrors} deploy=${entry.planLevel.deploy}`,
			)
		} else if (expected.expectClarification) {
			entry.planLevel = { mode: "plan-level", skipped: "expects a clarifying question, not a plan" }
			console.log(`[plan-level] ${entry.id}: skipped (expects clarification, LLM-only)`)
		} else {
			entry.planLevel = { mode: "plan-level", skipped: "no fixture.plan.json" }
			console.log(`[plan-level] ${entry.id}: skipped (no fixture)`)
		}

		if (runFull) {
			entry.fullLlm = await runFullLlm(promptText, reebeUp)
			console.log(`[full-llm]   ${entry.id}: deploy=${entry.fullLlm.deploy}`)
		}

		results.push(entry)
	}

	// ── Summary ───────────────────────────────────────────────────────────────

	const planLevelAttempted = results.filter((r) => r.planLevel && !r.planLevel.skipped)
	const zeroSynthProblems = planLevelAttempted.filter((r) => r.planLevel.synthProblems === 0).length
	const zeroLintErrors = planLevelAttempted.filter((r) => r.planLevel.lintDeployErrors === 0).length
	const deployAttempted = planLevelAttempted.filter(
		(r) => r.planLevel.deploy === "green" || r.planLevel.deploy === "failed",
	)
	const deployGreen = planLevelAttempted.filter((r) => r.planLevel.deploy === "green").length

	const summary = {
		generatedAt: new Date(0).toISOString(), // stamped by caller if needed; kept deterministic here
		totalPrompts: results.length,
		planLevelAttempted: planLevelAttempted.length,
		planLevelSkipped: results.length - planLevelAttempted.length,
		synthCleanRate: planLevelAttempted.length
			? zeroSynthProblems / planLevelAttempted.length
			: null,
		deployProfileCleanRate: planLevelAttempted.length
			? zeroLintErrors / planLevelAttempted.length
			: null,
		deployAttempted: deployAttempted.length,
		deployGreenRate: deployAttempted.length ? deployGreen / deployAttempted.length : null,
		reebeAvailable: reebeUp,
		fullLlmModeRan: runFull,
	}

	const report = { summary, results }
	writeFileSync(join(HERE, "eval-report.json"), JSON.stringify(report, null, "\t"), "utf-8")

	const md = [
		"# BPMN generation eval report",
		"",
		`- Prompts: ${summary.totalPrompts} (${summary.planLevelAttempted} plan-level attempted, ${summary.planLevelSkipped} skipped)`,
		`- Synth-clean rate (0 problems): ${fmtPct(summary.synthCleanRate)}`,
		`- Deploy-profile-clean rate (0 lint errors): ${fmtPct(summary.deployProfileCleanRate)}`,
		`- Deploy attempted: ${summary.deployAttempted}/${summary.planLevelAttempted}; deploys-green rate: ${fmtPct(summary.deployGreenRate)}`,
		`- Reebe available this run: ${summary.reebeAvailable}`,
		`- Full LLM mode ran: ${summary.fullLlmModeRan}`,
		"",
		"| Prompt | Category | Synth problems | Lint errors | Test pass rate | Deploy |",
		"|---|---|---|---|---|---|",
		...results.map((r) => {
			const p = r.planLevel
			if (p.skipped) return `| ${r.id} | ${r.category ?? ""} | — | — | — | skipped: ${p.skipped} |`
			return `| ${r.id} | ${r.category ?? ""} | ${p.synthProblems} | ${p.lintDeployErrors} | ${p.testPassRate ?? "—"} | ${p.deploy} |`
		}),
	].join("\n")
	writeFileSync(join(HERE, "eval-report.md"), md, "utf-8")
	console.log(`\n${md}`)

	if (planLevelAttempted.length > 0 && zeroSynthProblems < planLevelAttempted.length) {
		process.exitCode = 1
	}
}

function fmtPct(n) {
	return n === null ? "n/a" : `${Math.round(n * 100)}%`
}

await main()

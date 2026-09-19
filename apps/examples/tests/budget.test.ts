import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Bpmn } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnFlowElement } from "@bpmnkit/core"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * A budget on what it costs to express a real process with this SDK.
 *
 * These examples are the closest thing we have to the code a model writes: six
 * whole processes, built by chaining the public API and nothing else. If a
 * change makes the builder more verbose, it shows up here as more lines for the
 * same diagram — and that is the property that decides whether a model can emit
 * a correct process in one pass.
 *
 * The numbers are a ratchet, not a limit to grow into. Both directions are
 * checked: a file that gets longer fails, and so does one that gets shorter
 * without the budget being tightened. Changing one is a deliberate edit with a
 * reason in the commit message.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, "..", "src")

/**
 * Non-comment, non-blank lines, and the elements they produce.
 *
 * Comments are excluded on purpose: a budget on raw lines would reward deleting
 * the explanations, which is the opposite of what these files are for.
 */
interface Budget {
	/** Lines of code, comments and blanks excluded. */
	lines: number
	/** Flow elements and sequence flows in the model it builds. */
	elements: number
}

const BUDGETS: Record<string, Budget> = {
	"01-employee-onboarding": { lines: 65, elements: 22 },
	"02-incident-response": { lines: 97, elements: 34 },
	"03-loan-approval": { lines: 112, elements: 34 },
	"04-invoice-processing": { lines: 117, elements: 35 },
	"05-content-publishing": { lines: 139, elements: 46 },
	"06-ai-code-review-agent": { lines: 192, elements: 20 },
}

/**
 * Ceiling on lines per element, across all the examples together.
 *
 * A backstop rather than a tight bound: it catches a verbosity regression that
 * someone waved through by bumping the per-file numbers. The spread between
 * examples is wide and legitimately so — 06 configures an AI agent and its tools,
 * so most of its lines are configuration rather than topology.
 */
const MAX_LINES_PER_ELEMENT = 5

/**
 * Ceiling on what it costs to run one example, start to finish.
 *
 * This times `await import(...)`, so it measures resolving and transforming the
 * script and its imports as well as the builder calls — and the transform
 * dominates. It is therefore a backstop against a pathological regression, not
 * a latency bound on the SDK, and the number has to leave room for the machine.
 *
 * It was 250ms, on the claim that this "cannot fire by accident". It can: under
 * `pnpm -r test`, with every package's suite running at once, 06 took 304ms on a
 * cold import and failed a green tree. A ceiling that trips on how loaded the
 * runner is tests the runner, and a flaky gate on `main` blocks releases at
 * random. Eight seconds is far above anything a loaded machine produces here and
 * still an order of magnitude below a genuine algorithmic regression.
 */
const MAX_BUILD_MS = 8_000

function codeLines(source: string): number {
	let count = 0
	let inBlockComment = false
	for (const raw of source.split("\n")) {
		const line = raw.trim()
		if (inBlockComment) {
			if (line.includes("*/")) inBlockComment = false
			continue
		}
		if (line.startsWith("/*")) {
			if (!line.includes("*/")) inBlockComment = true
			continue
		}
		if (line === "" || line.startsWith("//")) continue
		count++
	}
	return count
}

function countElements(definitions: BpmnDefinitions): number {
	let total = 0
	const walk = (elements: BpmnFlowElement[]): void => {
		for (const element of elements) {
			total++
			if ("flowElements" in element && Array.isArray(element.flowElements)) {
				walk(element.flowElements)
			}
		}
	}
	for (const process of definitions.processes) {
		walk(process.flowElements)
		total += process.sequenceFlows.length
	}
	return total
}

const names = Object.keys(BUDGETS)
const measured = new Map<string, Budget & { ms: number }>()
let workDir = ""
let originalCwd = ""

beforeAll(async () => {
	// The examples write to ./output, so give them somewhere harmless to do it.
	originalCwd = process.cwd()
	workDir = mkdtempSync(join(tmpdir(), "bpmnkit-examples-"))
	process.chdir(workDir)

	for (const name of names) {
		const started = performance.now()
		// Importing runs the script, which is the only way to time the builder
		// calls themselves. Spawning `tsx` instead would mostly measure `tsx`.
		await import(join(SRC, `${name}.ts`))
		const ms = performance.now() - started

		const xml = readFileSync(join(workDir, "output", `${name}.bpmn`), "utf-8")
		measured.set(name, {
			lines: codeLines(readFileSync(join(SRC, `${name}.ts`), "utf-8")),
			elements: countElements(Bpmn.parse(xml)),
			ms,
		})
	}
}, 60_000)

afterAll(() => {
	if (originalCwd !== "") process.chdir(originalCwd)
	if (workDir !== "") rmSync(workDir, { recursive: true, force: true })
})

describe("example scripts stay within budget", () => {
	it("covers every example in src", () => {
		const onDisk = readdirSync(SRC)
			.filter((file) => /^\d\d-.*\.ts$/.test(file))
			.map((file) => file.replace(/\.ts$/, ""))
			.sort()
		// An example added without a budget would otherwise be silently unmeasured.
		expect(onDisk).toEqual([...names].sort())
	})

	for (const name of names) {
		it(`${name} costs exactly what it is budgeted`, () => {
			const actual = measured.get(name)
			expect(actual).toBeDefined()
			expect(
				{ lines: actual?.lines, elements: actual?.elements },
				[
					"This is a ratchet, not a limit to grow into.",
					"Fewer lines for the same diagram is an improvement — tighten the number.",
					"More lines is a regression unless the example genuinely grew, in which case",
					"update both numbers and say why.",
				].join(" "),
			).toEqual({ lines: BUDGETS[name]?.lines, elements: BUDGETS[name]?.elements })
		})
	}

	it("keeps lines per element under the global ceiling", () => {
		const lines = [...measured.values()].reduce((sum, entry) => sum + entry.lines, 0)
		const elements = [...measured.values()].reduce((sum, entry) => sum + entry.elements, 0)
		expect(elements).toBeGreaterThan(0)
		expect(lines / elements).toBeLessThanOrEqual(MAX_LINES_PER_ELEMENT)
	})

	for (const name of names) {
		it(`${name} builds well inside the time ceiling`, () => {
			expect(measured.get(name)?.ms).toBeLessThan(MAX_BUILD_MS)
		})
	}
})

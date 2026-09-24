/**
 * The terminal half of `casen dev`: one line per check, with the problems of a
 * failing one underneath, and a running tally of what is red.
 */

import { type CheckResult, isFailing } from "./checks.js"

/** How many problem lines to print under a failing file before summarising the rest. */
const MAX_DETAIL_LINES = 6

interface Paint {
	red(s: string): string
	green(s: string): string
	yellow(s: string): string
	dim(s: string): string
}

export function paint(colors: boolean): Paint {
	const wrap = (code: number) => (s: string) => (colors ? `\x1b[${code}m${s}\x1b[39m` : s)
	return {
		red: wrap(31),
		green: wrap(32),
		yellow: wrap(33),
		dim: (s) => (colors ? `\x1b[2m${s}\x1b[22m` : s),
	}
}

/** The one-line verdict for a file, e.g. `✓ orders/order.bpmn  lint 0✖ 1⚠  tests 3/3`. */
export function formatCheckLine(result: CheckResult, p: Paint): string {
	const failing = isFailing(result)
	const mark = failing ? p.red("✖") : p.green("✓")
	const parts: string[] = [`${mark} ${result.path}`]
	if (result.parseError !== undefined) {
		parts.push(p.red("does not parse"))
	} else if (result.lint !== undefined) {
		const { errors, warnings } = result.lint
		const lint = `lint ${errors}✖ ${warnings}⚠`
		parts.push(errors > 0 ? p.red(lint) : warnings > 0 ? p.yellow(lint) : p.dim(lint))
	}
	if (result.tests !== undefined) {
		const { passed, failed, engine } = result.tests
		const tests = `tests ${passed}/${passed + failed}${engine === "wasm" ? " (wasm)" : ""}`
		parts.push(failed > 0 ? p.red(tests) : p.green(tests))
	} else if (result.testsError !== undefined) {
		parts.push(p.red("tests unreadable"))
	}
	return parts.join("  ")
}

/** The lines printed under a failing file: parse error, lint errors, failed scenarios. */
export function formatCheckDetails(result: CheckResult): string[] {
	const lines: string[] = []
	if (result.parseError !== undefined) lines.push(result.parseError)
	if (result.testsError !== undefined) lines.push(result.testsError)
	for (const f of result.lint?.findings ?? []) {
		if (f.severity !== "error") continue
		const where = f.elementIds.length > 0 ? ` [${f.elementIds.join(", ")}]` : ""
		lines.push(`lint ${f.category}${where}: ${f.message}`)
	}
	for (const s of result.tests?.scenarios ?? []) {
		if (s.passed) continue
		lines.push(`FAIL ${s.name}`)
		for (const problem of s.problems) lines.push(`  ${problem}`)
	}
	if (lines.length <= MAX_DETAIL_LINES) return lines
	return [
		...lines.slice(0, MAX_DETAIL_LINES),
		`… ${lines.length - MAX_DETAIL_LINES} more — open the file in the browser for all of it`,
	]
}

/** `3 files · all green` / `3 files · 1 failing: orders/order.bpmn`. */
export function formatTally(results: CheckResult[], p: Paint): string {
	const failing = results.filter(isFailing).map((r) => r.path)
	const files = `${results.length} file${results.length === 1 ? "" : "s"}`
	if (failing.length === 0) return p.dim(`${files} · all green`)
	return `${p.dim(`${files} ·`)} ${p.red(`${failing.length} failing: ${failing.join(", ")}`)}`
}

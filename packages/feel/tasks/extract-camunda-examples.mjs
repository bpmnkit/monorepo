#!/usr/bin/env node
/**
 * Extracts the worked examples of Camunda's FEEL documentation — expression and
 * documented result — so that `tests/camunda-parity.test.ts` can check this
 * package against what Camunda 8's engine (feel-scala) is documented to do.
 *
 *   node tasks/extract-camunda-examples.mjs            # summary
 *   node tasks/extract-camunda-examples.mjs --skipped  # and every skipped example, with why
 *   node tasks/extract-camunda-examples.mjs --json     # everything, as JSON on stdout
 *
 * The source is @bpmnkit/camunda-docspack, which is in this repository, so the
 * test extracts at run time and nothing derived from the documentation is
 * committed. That is deliberate: the documentation is Camunda's, licensed
 * CC BY-SA 3.0, and a fixture copied out of it into this MIT package would
 * carry the share-alike terms with it.
 *
 * The pages write their examples as fenced `feel` blocks:
 *
 *     context put({x:1}, ["y"], 2)
 *     // {x:1, y:2}
 *
 * A result line is a FEEL literal, `error` (optionally `error(message)` or
 * `error - why`), or — when it depends on a variable — carries a condition,
 * `// 4 - if x is 4`, which is turned into a binding where it names one. The
 * AI agent pages write `// toolCall.userId contents`, read as: bind that path
 * and expect its value back. A few
 * pages instead put the expression, an "Evaluation context" and an "Evaluation
 * result" in consecutive blocks. Everything else is skipped with its reason.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

/** The docspack's chunk directory, relative to this package. */
export const DEFAULT_CHUNKS_DIR = path.resolve(here, "../../camunda-docspack/.llms/chunks")

/** Chunks holding FEEL language and built-in documentation. */
const PAGE_PREFIXES = ["components.modeler.feel.", "components.concepts.bpmn-dmn-feel"]

const NON_DETERMINISTIC = /\b(now|today|random number|uuid)\s*\(/

// `name(param: type, ...): type` — a signature, not an example.
const SIGNATURE = /^[A-Za-z][\w ]*\((?:[\w ]+:\s*[A-Za-z][^"'[\]{}]*)?\)(?:\s*:\s*\w.*)?$/

/** Reads every chunk and returns the runnable cases and the skipped examples. */
export function extractCamundaExamples(chunksDir = DEFAULT_CHUNKS_DIR) {
	/** @type {import("./extract-camunda-examples.d.mts").CamundaCase[]} */
	const cases = []
	/** @type {import("./extract-camunda-examples.d.mts").SkippedExample[]} */
	const skipped = []
	const seen = new Set()

	const files = fs
		.readdirSync(chunksDir)
		.filter((f) => f.endsWith(".md") && PAGE_PREFIXES.some((p) => f.startsWith(p)))
		.sort()

	for (const file of files) {
		const page = file.slice(0, -".md".length)
		const markdown = fs.readFileSync(path.join(chunksDir, file), "utf8")
		const source = /^Source: (\S+)/m.exec(markdown)?.[1] ?? ""
		const blocks = feelBlocks(markdown)

		const addCase = (c) => {
			const binding = c.context ? ` with ${collapse(c.context)}` : ""
			const id = `${collapse(c.expression)}${binding}`
			const key = `${id} => ${c.error ? "error" : c.expected}`
			if (seen.has(key)) return
			seen.add(key)
			cases.push({ id, page, source, ...c })
		}
		const skip = (section, expression, result, reason) => {
			skipped.push({ page, section, expression, result, reason })
		}

		for (let b = 0; b < blocks.length; b++) {
			const block = blocks[b]
			if (block.heading === "Evaluation context" || block.heading === "Evaluation result") {
				continue // consumed with the expression block before it
			}

			// Expression, then "Evaluation context" and/or "Evaluation result" blocks.
			const next = blocks[b + 1]
			if (next?.heading === "Evaluation context" || next?.heading === "Evaluation result") {
				const contextBlock = next.heading === "Evaluation context" ? next : null
				const resultBlock = [next, blocks[b + 2]].find((x) => x?.heading === "Evaluation result")
				const expression = block.text.trim()
				if (!resultBlock) {
					skip(
						block.section,
						expression,
						null,
						"the page gives an evaluation context but no result",
					)
				} else if (NON_DETERMINISTIC.test(expression)) {
					skip(block.section, expression, resultBlock.text, "depends on the clock or on chance")
				} else if (contextBlock && !contextBlock.text.trim().startsWith("{")) {
					skip(
						block.section,
						expression,
						resultBlock.text,
						"the evaluation context is a bare value; the page does not say which variable holds it",
					)
				} else {
					const result = normalizeResult(resultBlock.text.trim())
					if (!isFeelLiteral(result.text)) {
						skip(block.section, expression, resultBlock.text, "the result is not a FEEL literal")
					} else {
						addCase({
							section: block.section,
							expression,
							context: contextBlock ? contextBlock.text.trim() : null,
							expected: result.text,
							error: false,
							note: result.note,
						})
					}
				}
				continue
			}

			for (const example of examplesOf(block.text)) {
				const { expression, results, leadingComment } = example
				const section = block.section
				if (leadingComment) {
					skip(section, expression, null, "the comment annotates the expression; no result")
					continue
				}
				if (results.length === 0) {
					const reason = SIGNATURE.test(expression)
						? "a function signature, not an example"
						: "no documented result"
					skip(section, expression, null, reason)
					continue
				}
				if (NON_DETERMINISTIC.test(expression)) {
					skip(section, expression, results.join("\n"), "depends on the clock or on chance")
					continue
				}

				const conditional = results.map((r) => /^(.*?)\s+-\s+if\s+(.+)$/.exec(r))
				if (results.length > 1 && conditional.some((m) => m === null)) {
					skip(section, expression, results.join("\n"), "the result is described in prose")
					continue
				}

				for (let i = 0; i < results.length; i++) {
					const text = results[i]
					const cond = conditional[i]
					const outcome = cond ? cond[1] : text
					let context = null
					if (cond) {
						const binding = bindingFor(cond[2])
						if (binding === undefined) {
							skip(section, expression, text, `the condition "${cond[2]}" is described in prose`)
							continue
						}
						context = binding
					}

					const error = /^error\b\s*(?:\((.*)\))?\s*(?:-\s+.*)?$/.exec(outcome)
					if (error) {
						addCase({ section, expression, context, expected: null, error: true, note: null })
						continue
					}
					// "toolCall.userId contents": the value at that path, unchanged.
					const contents = /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+) contents$/.exec(outcome)
					if (contents && !cond && expression.includes(contents[1])) {
						const [root, ...rest] = contents[1].split(".")
						const value = JSON.stringify(contents[1])
						const nested = rest.reduceRight((inner, key) => `{${key}: ${inner}}`, value)
						addCase({
							section,
							expression,
							context: `{${root}: ${nested}}`,
							expected: value,
							error: false,
							note: `"${contents[1]} contents" read as the value bound at ${contents[1]}`,
						})
						continue
					}
					const result = normalizeResult(outcome)
					if (!isFeelLiteral(result.text)) {
						skip(section, expression, text, "the result is described in prose")
						continue
					}
					addCase({
						section,
						expression,
						context,
						expected: result.text,
						error: false,
						note: result.note,
					})
				}
			}
		}
	}

	return { cases, skipped }
}

/** The fenced `feel` blocks of a page, each with the headings above it. */
function feelBlocks(markdown) {
	const blocks = []
	let section = ""
	let heading = ""
	let inBlock = false
	let lines = []
	for (const line of markdown.split("\n")) {
		if (inBlock) {
			if (/^```\s*$/.test(line)) {
				blocks.push({ section, heading, text: lines.join("\n") })
				inBlock = false
				heading = ""
			} else {
				lines.push(line)
			}
			continue
		}
		if (/^```feel\s*$/.test(line)) {
			inBlock = true
			lines = []
			continue
		}
		const h = /^(#{1,6})\s+(.*)$/.exec(line)
		if (h) {
			heading = h[2].trim()
			if (h[1].length <= 3) section = heading
		}
	}
	return blocks
}

/**
 * Splits a block into examples: code lines, then the `//` comment lines that
 * give their result. A blank line or a code line after a result starts the
 * next example.
 */
function examplesOf(text) {
	const examples = []
	let code = []
	let results = []
	let leadingComment = false
	const flush = () => {
		if (code.length > 0) {
			examples.push({ expression: code.join("\n").trim(), results, leadingComment })
		}
		code = []
		results = []
		leadingComment = false
	}
	for (const raw of text.split("\n")) {
		const line = raw.trimEnd()
		const trimmed = line.trim()
		if (trimmed === "") {
			flush()
			continue
		}
		const isComment = /^(\/\/|\/\*|\*)/.test(trimmed)
		if (isComment) {
			if (code.length === 0) {
				leadingComment = true
				continue
			}
			if (leadingComment) continue
			results.push(trimmed.replace(/^\/\/\s*(=>\s*)?/, "").trim())
			continue
		}
		if (results.length > 0) flush()
		code.push(line)
	}
	flush()
	return examples
}

/**
 * Turns a result's condition into variable bindings: `x is 4` binds x, and
 * "no variable" / "doesn't exist" is the empty context a standalone evaluation
 * already has. Returns undefined when the condition cannot be bound.
 */
function bindingFor(condition) {
	if (/no variable|doesn't exist|does not exist/.test(condition)) return null
	const m = /^([A-Za-z_]\w*) is (.+)$/.exec(condition.trim())
	if (m && isFeelLiteral(m[2])) return `{${m[1]}: ${m[2]}}`
	return undefined
}

/**
 * Corrects the documentation's typographical slips in a result, recording
 * each: trailing commas in a multi-line list or context (not FEEL), a stray
 * closing parenthesis, and a temporal constructor wrapped in quotes.
 */
function normalizeResult(text) {
	const notes = []
	let out = text

	const noTrailingCommas = out.replace(/,(\s*[\]}])/g, "$1")
	if (noTrailingCommas !== out) {
		notes.push("trailing commas removed")
		out = noTrailingCommas
	}

	const quoted = /^"((?:date and time|date|time|duration)\(".*"\))"$/.exec(out)
	if (quoted) {
		notes.push("quotes around the temporal constructor removed")
		out = quoted[1]
	}

	let depth = 0
	for (const ch of out.replace(/"(?:[^"\\]|\\.)*"/g, "")) {
		if (ch === "(") depth++
		if (ch === ")") depth--
	}
	if (depth < 0 && out.endsWith(")".repeat(-depth))) {
		notes.push("unbalanced closing parenthesis removed")
		out = out.slice(0, out.length + depth)
	}

	return { text: out, note: notes.length > 0 ? notes.join("; ") : null }
}

const LITERAL_WORDS = new Set(["null", "true", "false", "date", "and", "time", "duration"])
const LITERAL_TOKEN =
	/\s+|@?"(?:[^"\\]|\\.)*"|-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?|[[\]{}(),:]|[A-Za-z_]\w*/y

/**
 * Whether a result reads as a FEEL literal — null, a boolean, number, string,
 * list, context or temporal value — rather than prose describing one. Words
 * are allowed only as context keys and in the temporal constructors.
 */
export function isFeelLiteral(text) {
	const tokens = []
	LITERAL_TOKEN.lastIndex = 0
	while (LITERAL_TOKEN.lastIndex < text.length) {
		const start = LITERAL_TOKEN.lastIndex
		const m = LITERAL_TOKEN.exec(text)
		if (!m || LITERAL_TOKEN.lastIndex === start) return false
		if (m[0].trim() !== "") tokens.push(m[0])
	}
	if (tokens.length === 0) return false
	return tokens.every((t, i) => {
		if (!/^[A-Za-z_]/.test(t)) return true
		return LITERAL_WORDS.has(t) || tokens[i + 1] === ":"
	})
}

/** Collapses the whitespace between tokens, keeping string literals as written. */
function collapse(text) {
	return text.replace(/("(?:[^"\\]|\\.)*")|\s+/g, (match, literal) => literal ?? " ").trim()
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
	const args = process.argv.slice(2)
	if (args.includes("--help")) {
		console.log("usage: extract-camunda-examples.mjs [--chunks <dir>] [--skipped] [--json]")
		return
	}
	const at = args.indexOf("--chunks")
	const chunksDir = at >= 0 && args[at + 1] ? path.resolve(args[at + 1]) : DEFAULT_CHUNKS_DIR
	const { cases, skipped } = extractCamundaExamples(chunksDir)

	if (args.includes("--json")) {
		console.log(JSON.stringify({ cases, skipped }, null, 2))
		return
	}
	console.log(`${cases.length} runnable examples, ${skipped.length} skipped`)
	const byReason = new Map()
	for (const s of skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1)
	for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${String(count).padStart(4)}  ${reason}`)
	}
	if (args.includes("--skipped")) {
		for (const s of skipped) {
			console.log(`\n[${s.reason}] ${s.page}\n  ${s.expression.replace(/\n/g, "\n  ")}`)
			if (s.result) console.log(`  // ${s.result.replace(/\n/g, "\n  // ")}`)
		}
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

/**
 * The FEEL playground, evaluated in the page.
 *
 * FEEL is the expression language DMN decision tables and BPMN gateway
 * conditions are written in, and until now the only way to try one on this site
 * was to open the editor and find the panel inside it. This is the same
 * evaluator — `@bpmnkit/feel`, which is what the editor's panel calls too — in
 * the landing page's own chrome, so there is one implementation of FEEL and two
 * views of it.
 *
 * Mounting is deliberately a function rather than a top-level side effect: the
 * homepage imports it only once the section is in view, so a visitor who never
 * scrolls that far never downloads the parser.
 */

import {
	evaluate,
	evaluateUnaryTests,
	highlightToHtml,
	parseExpression,
	parseUnaryTests,
} from "@bpmnkit/feel"
import type { FeelValue } from "@bpmnkit/feel"

type Mode = "expression" | "unary-tests"

interface Example {
	readonly label: string
	readonly expr: string
	readonly context: string
	readonly mode: Mode
}

const EXAMPLES: readonly Example[] = [
	{
		label: "Order total",
		expr: "order.amount * (1 + vat)",
		context: '{"order": {"amount": 100}, "vat": 0.19}',
		mode: "expression",
	},
	{
		label: "Routing condition",
		expr: 'if amount > 1000 then "manual review" else "auto approve"',
		context: '{"amount": 2500}',
		mode: "expression",
	},
	{
		label: "List filter",
		expr: "items[price > 20]",
		context: '{"items": [{"price": 10}, {"price": 30}, {"price": 50}]}',
		mode: "expression",
	},
	{
		label: "String & list built-ins",
		expr: 'sum([1, 2, 3]) + string length("FEEL")',
		context: "{}",
		mode: "expression",
	},
	{
		label: "Every / some",
		expr: "every line in lines satisfies line.qty > 0",
		context: '{"lines": [{"qty": 2}, {"qty": 5}]}',
		mode: "expression",
	},
	{
		label: "Decision table range",
		expr: "[18..65]",
		context: '{"?": 30}',
		mode: "unary-tests",
	},
	{
		label: "Decision table list",
		expr: '"visa", "mastercard"',
		context: '{"?": "visa"}',
		mode: "unary-tests",
	},
]

/** How a result is written out — the same shapes the editor's panel shows. */
function renderValue(value: FeelValue): string {
	if (value === null) return "null"
	if (typeof value === "string") return `"${value}"`
	if (typeof value === "boolean" || typeof value === "number") return String(value)
	return JSON.stringify(value, null, 2)
}

export function mountFeelPlayground(root: HTMLElement): void {
	const expr = root.querySelector<HTMLTextAreaElement>("[data-fp-expr]")
	const highlight = root.querySelector<HTMLElement>("[data-fp-highlight]")
	const context = root.querySelector<HTMLTextAreaElement>("[data-fp-context]")
	const result = root.querySelector<HTMLElement>("[data-fp-result]")
	const error = root.querySelector<HTMLElement>("[data-fp-error]")
	const examples = root.querySelector<HTMLElement>("[data-fp-examples]")
	const modeButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-fp-mode]")]
	if (!expr || !highlight || !context || !result || !error) return

	let mode: Mode = "expression"

	function fail(message: string): void {
		if (!error || !result) return
		error.textContent = message
		result.textContent = ""
	}

	function run(): void {
		if (!expr || !context || !result || !error) return

		let vars: Record<string, FeelValue>
		try {
			vars = JSON.parse(context.value.trim() || "{}") as Record<string, FeelValue>
		} catch {
			// Naming the offending half matters: the expression is usually fine and
			// the reader is looking at the wrong box.
			fail("The context is not valid JSON.")
			return
		}

		if (mode === "expression") {
			const { ast, errors } = parseExpression(expr.value)
			if (errors.length > 0 || !ast) {
				fail(errors.map((e) => e.message).join("; ") || "Could not parse that expression.")
				return
			}
			error.textContent = ""
			try {
				result.textContent = renderValue(evaluate(ast, { vars }))
			} catch (e) {
				fail(e instanceof Error ? e.message : String(e))
			}
			return
		}

		// Unary tests are what a decision-table input entry holds, so the value
		// under test is the `?` the table would have bound.
		const input = vars["?"] ?? null
		const { ast, errors } = parseUnaryTests(expr.value)
		if (errors.length > 0 || !ast) {
			fail(errors.map((e) => e.message).join("; ") || "Could not parse those unary tests.")
			return
		}
		error.textContent = ""
		try {
			result.textContent = renderValue(evaluateUnaryTests(ast, input, { vars, input }))
		} catch (e) {
			fail(e instanceof Error ? e.message : String(e))
		}
	}

	function paint(): void {
		if (!expr || !highlight) return
		highlight.innerHTML = highlightToHtml(expr.value)
		highlight.scrollTop = expr.scrollTop
		highlight.scrollLeft = expr.scrollLeft
	}

	function setMode(next: Mode): void {
		mode = next
		for (const button of modeButtons) {
			const active = button.dataset.fpMode === next
			button.classList.toggle("active", active)
			button.setAttribute("aria-pressed", String(active))
		}
		if (context) context.placeholder = next === "expression" ? "{}" : '{"?": 30}'
		run()
	}

	function load(example: Example): void {
		if (!expr || !context) return
		expr.value = example.expr
		context.value = example.context
		paint()
		setMode(example.mode)
	}

	expr.addEventListener("input", () => {
		paint()
		run()
	})
	expr.addEventListener("scroll", paint)
	context.addEventListener("input", run)
	for (const button of modeButtons) {
		button.addEventListener("click", () => {
			const next = button.dataset.fpMode
			if (next === "expression" || next === "unary-tests") setMode(next)
		})
	}

	if (examples) {
		for (const example of EXAMPLES) {
			const button = document.createElement("button")
			button.type = "button"
			button.className = "fp-example"
			button.textContent = example.label
			button.addEventListener("click", () => load(example))
			examples.appendChild(button)
		}
	}

	const first = EXAMPLES[0]
	if (first) load(first)
}

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import {
	evaluate,
	evaluateUnaryTests,
	highlightToHtml,
	parseExpression,
	parseUnaryTests,
} from "@bpmn-sdk/feel";
import type { FeelValue } from "@bpmn-sdk/feel";
import { injectPlaygroundStyles } from "./css.js";

export interface FeelPlaygroundPlugin extends CanvasPlugin {
	/** Show the FEEL Playground panel. */
	show(): void;
}

const EXAMPLES: Array<{
	label: string;
	expr: string;
	context: string;
	mode: "expression" | "unary-tests";
}> = [
	{ label: "Arithmetic", expr: "1 + 2 * 3", context: "{}", mode: "expression" },
	{ label: "String ops", expr: 'string length("Hello FEEL")', context: "{}", mode: "expression" },
	{ label: "List ops", expr: "sum([1, 2, 3, 4, 5])", context: "{}", mode: "expression" },
	{
		label: "Context access",
		expr: "order.amount * 1.1",
		context: '{"order": {"amount": 100}}',
		mode: "expression",
	},
	{
		label: "If-then-else",
		expr: 'if age >= 18 then "adult" else "minor"',
		context: '{"age": 20}',
		mode: "expression",
	},
	{
		label: "For expression",
		expr: "for x in [1, 2, 3] return x * x",
		context: "{}",
		mode: "expression",
	},
	{ label: "Temporal", expr: 'date("2021-01-15").month', context: "{}", mode: "expression" },
	{ label: "Unary tests — range", expr: "[18..65]", context: '{"?": 30}', mode: "unary-tests" },
	{
		label: "Unary tests — list",
		expr: '"visa", "master"',
		context: '{"?": "visa"}',
		mode: "unary-tests",
	},
	{
		label: "Contains filter",
		expr: "items[item > 2]",
		context: '{"items": [1, 2, 3, 4]}',
		mode: "expression",
	},
];

function renderValue(v: FeelValue): { html: string; cssClass: string } {
	if (v === null) return { html: "null", cssClass: "null-val" };
	if (typeof v === "boolean") return { html: String(v), cssClass: v ? "bool-true" : "bool-false" };
	if (typeof v === "number") return { html: String(v), cssClass: "number" };
	if (typeof v === "string") return { html: `"${v}"`, cssClass: "string" };
	if (Array.isArray(v)) return { html: JSON.stringify(v, null, 2), cssClass: "" };
	return { html: JSON.stringify(v, null, 2), cssClass: "" };
}

/**
 * Builds the FEEL Playground panel DOM.
 * When `onClose` is provided a close button is rendered that calls it.
 * Omit `onClose` when embedding in a full-screen tab.
 * Pass `initialExpression` to pre-fill the expression textarea.
 */
export function buildFeelPlaygroundPanel(
	onClose?: () => void,
	initialExpression?: string,
): HTMLDivElement {
	let mode: "expression" | "unary-tests" = "expression";
	let exprEl: HTMLTextAreaElement | null = null;
	let contextEl: HTMLTextAreaElement | null = null;
	let resultEl: HTMLDivElement | null = null;
	let errorsEl: HTMLDivElement | null = null;
	let highlightEl: HTMLDivElement | null = null;

	function evaluate_(): void {
		if (!exprEl || !contextEl || !resultEl || !errorsEl) return;
		const src = exprEl.value;
		let vars: Record<string, FeelValue> = {};
		try {
			const parsed = JSON.parse(contextEl.value || "{}") as Record<string, FeelValue>;
			vars = parsed;
		} catch {
			errorsEl.textContent = "Invalid JSON context";
			return;
		}

		if (mode === "expression") {
			const { ast, errors } = parseExpression(src);
			if (errors.length > 0) {
				errorsEl.textContent = errors.map((e) => e.message).join("; ");
				resultEl.className = "feel-playground__result";
				resultEl.textContent = "";
				return;
			}
			errorsEl.textContent = "";
			if (!ast) return;
			const val = evaluate(ast, { vars });
			const { html, cssClass } = renderValue(val);
			resultEl.className = `feel-playground__result ${cssClass}`;
			resultEl.innerHTML = html;
		} else {
			const input = vars["?"] ?? null;
			const { ast, errors } = parseUnaryTests(src);
			if (errors.length > 0) {
				errorsEl.textContent = errors.map((e) => e.message).join("; ");
				return;
			}
			errorsEl.textContent = "";
			if (!ast) return;
			const result = evaluateUnaryTests(ast, input, { vars, input });
			const { html, cssClass } = renderValue(result);
			resultEl.className = `feel-playground__result ${cssClass}`;
			resultEl.innerHTML = html;
		}
	}

	function updateHighlight(): void {
		if (!exprEl || !highlightEl) return;
		const html = highlightToHtml(exprEl.value);
		highlightEl.innerHTML = html;
		highlightEl.scrollTop = exprEl.scrollTop;
		highlightEl.scrollLeft = exprEl.scrollLeft;
	}

	const div = document.createElement("div");
	div.className = "feel-playground";

	// Header
	const header = document.createElement("div");
	header.className = "feel-playground__header";

	const title = document.createElement("span");
	title.className = "feel-playground__title";
	title.textContent = "FEEL Playground";

	const modeDiv = document.createElement("div");
	modeDiv.className = "feel-playground__mode";

	const exprBtn = document.createElement("button");
	exprBtn.textContent = "Expression";
	exprBtn.className = "active"; // mode starts as "expression"
	exprBtn.addEventListener("click", () => {
		mode = "expression";
		exprBtn.className = "active";
		utBtn.className = "";
		evaluate_();
	});

	const utBtn = document.createElement("button");
	utBtn.textContent = "Unary Tests";
	utBtn.className = ""; // mode starts as "expression", so utBtn starts inactive
	utBtn.addEventListener("click", () => {
		mode = "unary-tests";
		utBtn.className = "active";
		exprBtn.className = "";
		evaluate_();
	});

	modeDiv.appendChild(exprBtn);
	modeDiv.appendChild(utBtn);

	header.appendChild(title);
	header.appendChild(modeDiv);

	if (onClose) {
		const closeBtn = document.createElement("button");
		closeBtn.className = "feel-playground__close";
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", onClose);
		header.appendChild(closeBtn);
	}

	// Body
	const body = document.createElement("div");
	body.className = "feel-playground__body";

	// Examples
	const examplesRow = document.createElement("div");
	examplesRow.className = "feel-playground__examples";
	const exLabel = document.createElement("span");
	exLabel.className = "feel-playground__label";
	exLabel.textContent = "Examples:";
	const select = document.createElement("select");
	const defaultOpt = document.createElement("option");
	defaultOpt.value = "";
	defaultOpt.textContent = "— pick an example —";
	select.appendChild(defaultOpt);
	for (let i = 0; i < EXAMPLES.length; i++) {
		const ex = EXAMPLES[i];
		if (!ex) continue;
		const opt = document.createElement("option");
		opt.value = String(i);
		opt.textContent = ex.label;
		select.appendChild(opt);
	}
	select.addEventListener("change", () => {
		const idx = Number(select.value);
		const ex = EXAMPLES[idx];
		if (!ex || !exprEl || !contextEl) return;
		mode = ex.mode;
		exprBtn.className = mode === "expression" ? "active" : "";
		utBtn.className = mode === "unary-tests" ? "active" : "";
		exprEl.value = ex.expr;
		contextEl.value = ex.context;
		updateHighlight();
		evaluate_();
		select.value = "";
	});
	examplesRow.appendChild(exLabel);
	examplesRow.appendChild(select);

	// Expression input
	const exprLabel = document.createElement("div");
	exprLabel.className = "feel-playground__label";
	exprLabel.textContent = "Expression";

	const inputWrap = document.createElement("div");
	inputWrap.className = "feel-playground__input-wrap";

	highlightEl = document.createElement("div");
	highlightEl.className = "feel-playground__highlight";

	exprEl = document.createElement("textarea");
	exprEl.className = "feel-playground__textarea";
	exprEl.rows = 3;
	exprEl.spellcheck = false;
	exprEl.placeholder = "Enter FEEL expression...";
	exprEl.addEventListener("input", () => {
		updateHighlight();
		evaluate_();
	});
	exprEl.addEventListener("scroll", () => {
		if (!highlightEl || !exprEl) return;
		highlightEl.scrollTop = exprEl.scrollTop;
	});

	if (initialExpression) exprEl.value = initialExpression;

	inputWrap.appendChild(highlightEl);
	inputWrap.appendChild(exprEl);

	// Context input
	const ctxLabel = document.createElement("div");
	ctxLabel.className = "feel-playground__label";
	ctxLabel.textContent = "Context (JSON)";

	contextEl = document.createElement("textarea");
	contextEl.className = "feel-playground__context";
	contextEl.rows = 3;
	contextEl.value = "{}";
	contextEl.spellcheck = false;
	contextEl.placeholder = '{"x": 10}';
	contextEl.addEventListener("input", evaluate_);

	// Errors
	errorsEl = document.createElement("div");
	errorsEl.className = "feel-playground__errors";
	errorsEl.style.display = "none";

	const errObserver = new MutationObserver(() => {
		if (!errorsEl) return;
		errorsEl.style.display = errorsEl.textContent?.trim() ? "" : "none";
	});
	errObserver.observe(errorsEl, { childList: true, characterData: true, subtree: true });

	// Result
	const resultLabel = document.createElement("div");
	resultLabel.className = "feel-playground__label";
	resultLabel.textContent = "Result";

	resultEl = document.createElement("div");
	resultEl.className = "feel-playground__result";

	body.appendChild(examplesRow);
	body.appendChild(exprLabel);
	body.appendChild(inputWrap);
	body.appendChild(ctxLabel);
	body.appendChild(contextEl);
	body.appendChild(errorsEl);
	body.appendChild(resultLabel);
	body.appendChild(resultEl);

	div.appendChild(header);
	div.appendChild(body);

	if (initialExpression) {
		updateHighlight();
		evaluate_();
	}

	return div;
}

export function createFeelPlaygroundPlugin(): FeelPlaygroundPlugin {
	let overlay: HTMLDivElement | null = null;

	return {
		name: "feel-playground",

		install(api) {
			injectPlaygroundStyles();
			overlay = document.createElement("div");
			overlay.className = "feel-playground-overlay";
			overlay.style.display = "none";
			overlay.appendChild(
				buildFeelPlaygroundPanel(() => {
					if (overlay) overlay.style.display = "none";
				}),
			);
			api.container.style.position = "relative";
			api.container.appendChild(overlay);
		},

		uninstall() {
			overlay?.remove();
			overlay = null;
		},

		show() {
			if (overlay) overlay.style.display = "";
		},
	};
}

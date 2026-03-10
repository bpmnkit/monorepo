import { BpmnCanvas } from "@bpmn-sdk/canvas"
import { Bpmn, Dmn, Form } from "@bpmn-sdk/core"

// ── DMN section tabs ─────────────────────────────────────────────────────────

function setupDmnTabs(): void {
	const tabs = document.querySelectorAll<HTMLElement>(".dmn-tab")
	const panels = document.querySelectorAll<HTMLElement>(".dmn-panel")

	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const target = tab.dataset.tab
			if (!target) return
			for (const t of tabs) t.classList.remove("active")
			for (const p of panels) p.classList.remove("active")
			tab.classList.add("active")
			const panel = document.querySelector<HTMLElement>(`.dmn-panel[data-panel="${target}"]`)
			if (panel) panel.classList.add("active")

			// Render BPMN preview when that tab is first activated
			if (target === "bpmn") renderDmnBpmnPreview()
		})
	}
}

let _dmnBpmnCanvas: BpmnCanvas | null = null
function renderDmnBpmnPreview(): void {
	const container = document.getElementById("dmn-bpmn-preview")
	if (!container || _dmnBpmnCanvas) return

	const xml = Bpmn.export(
		Bpmn.createProcess("loan-application")
			.name("Loan Application")
			.startEvent("start", { name: "Application Received" })
			.userTask("collect", { name: "Collect Applicant Data", formId: "ApplicationForm" })
			.businessRuleTask("eligibility", {
				name: "Check Eligibility",
				decisionId: "Eligibility",
				resultVariable: "eligibilityResult",
			})
			.exclusiveGateway("gw", { name: "Eligible?" })
			.branch("approved", (b) =>
				b
					.condition("= eligibilityResult.eligible")
					.serviceTask("disburse", { name: "Disburse Loan", taskType: "disburse-loan" })
					.endEvent("end-ok", { name: "Loan Approved" }),
			)
			.branch("rejected", (b) =>
				b
					.defaultFlow()
					.serviceTask("notify", { name: "Notify Applicant", taskType: "send-rejection-email" })
					.endEvent("end-no", { name: "Rejected" }),
			)
			.withAutoLayout()
			.build(),
	)

	_dmnBpmnCanvas = new BpmnCanvas({ container, xml, theme: "dark", fit: "contain", grid: false })
}

// ── Starter code ────────────────────────────────────────────────────────────

const STARTER_CODE = `return Bpmn.createProcess("my-process")
  .name("My Process")
  .startEvent("start", { name: "Start" })
  .userTask("collect", {
    name: "Collect Data",
    formId: "MyForm",
  })
  .businessRuleTask("decide", {
    name: "Make Decision",
    decisionId: "MyDecision",
    resultVariable: "result",
  })
  .exclusiveGateway("gw", { name: "OK?" })
  .branch("yes", b =>
    b.condition("= result.approved")
     .serviceTask("process", { name: "Process", taskType: "process-it" })
     .endEvent("end-ok", { name: "Done" }))
  .branch("no", b =>
    b.defaultFlow()
     .endEvent("end-no", { name: "Rejected" }))
  .withAutoLayout()
  .build()`

const EXAMPLE_SNIPPETS: Array<{ label: string; code: string }> = [
	{
		label: "Linear flow",
		code: `return Bpmn.createProcess("linear-flow")
  .name("Order Processing")
  .startEvent("start", { name: "Order Received" })
  .serviceTask("validate", { name: "Validate", taskType: "validate" })
  .serviceTask("process", { name: "Process Order", taskType: "process" })
  .serviceTask("notify",  { name: "Send Confirmation", taskType: "send-email" })
  .endEvent("end", { name: "Done" })
  .withAutoLayout()
  .build()`,
	},
	{
		label: "Approval flow",
		code: `return Bpmn.createProcess("approval-flow")
  .name("Approval Flow")
  .startEvent("start", { name: "Request Submitted" })
  .userTask("review", { name: "Review Request" })
  .exclusiveGateway("gw", { name: "Approved?" })
  .branch("yes", b =>
    b.condition("= approved")
     .serviceTask("notify", { name: "Notify Approved", taskType: "send-email" })
     .endEvent("end-ok", { name: "Approved" }))
  .branch("no", b =>
    b.defaultFlow()
     .endEvent("end-no", { name: "Rejected" }))
  .withAutoLayout()
  .build()`,
	},
	{
		label: "DMN + Form",
		code: `return Bpmn.createProcess("loan-application")
  .name("Loan Application")
  .startEvent("start", { name: "Application Received" })
  .userTask("collect", {
    name: "Collect Applicant Data",
    formId: "ApplicationForm",
  })
  .businessRuleTask("eligibility", {
    name: "Check Eligibility",
    decisionId: "Eligibility",
    resultVariable: "eligibilityResult",
  })
  .exclusiveGateway("gw", { name: "Eligible?" })
  .branch("approved", b =>
    b.condition("= eligibilityResult.eligible")
     .serviceTask("disburse", { name: "Disburse Loan", taskType: "disburse" })
     .endEvent("end-ok", { name: "Loan Approved" }))
  .branch("rejected", b =>
    b.defaultFlow()
     .serviceTask("notify", { taskType: "send-rejection-email" })
     .endEvent("end-no", { name: "Rejected" }))
  .withAutoLayout()
  .build()`,
	},
	{
		label: "Parallel gateway",
		code: `return Bpmn.createProcess("fulfillment")
  .name("Order Fulfillment")
  .startEvent("start", { name: "Order Confirmed" })
  .parallelGateway("split")
  .branch("warehouse", b =>
    b.serviceTask("pick", { name: "Pick & Pack", taskType: "warehouse-pick" }))
  .branch("payment", b =>
    b.serviceTask("charge", { name: "Charge Payment", taskType: "payment-charge" }))
  .branch("notify", b =>
    b.serviceTask("email", { name: "Notify Customer", taskType: "send-email" }))
  .parallelGateway("join")
  .endEvent("end", { name: "Fulfilled" })
  .withAutoLayout()
  .build()`,
	},
]

// ── Syntax highlighting ──────────────────────────────────────────────────────

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function isAlpha(c: string): boolean {
	return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$"
}

function isAlphaNum(c: string): boolean {
	return isAlpha(c) || (c >= "0" && c <= "9")
}

const KEYWORDS = new Set([
	"import",
	"export",
	"const",
	"let",
	"var",
	"return",
	"new",
	"from",
	"function",
	"if",
	"else",
	"for",
	"of",
	"in",
	"true",
	"false",
	"null",
	"undefined",
	"class",
	"extends",
	"async",
	"await",
	"type",
	"interface",
])

function tokenize(raw: string): string {
	let out = ""
	let i = 0
	const len = raw.length

	while (i < len) {
		const c = raw.charAt(i)

		// Line comment
		if (c === "/" && raw.charAt(i + 1) === "/") {
			let j = i
			while (j < len && raw.charAt(j) !== "\n") j++
			out += `<span class="comment">${esc(raw.slice(i, j))}</span>`
			i = j
			continue
		}

		// String literals: " ' `
		if (c === '"' || c === "'" || c === "`") {
			const quote = c
			let j = i + 1
			while (j < len) {
				const qc = raw.charAt(j)
				if (qc === "\\") {
					j += 2
					continue
				}
				if (qc === quote) {
					j++
					break
				}
				j++
			}
			out += `<span class="str">${esc(raw.slice(i, j))}</span>`
			i = j
			continue
		}

		// Identifier, keyword, or method call
		if (isAlpha(c)) {
			let j = i + 1
			while (j < len && isAlphaNum(raw.charAt(j))) j++
			const word = raw.slice(i, j)
			// Peek past whitespace — method call if followed by "("
			let k = j
			while (k < len && raw.charAt(k) === " ") k++
			if (!KEYWORDS.has(word) && raw.charAt(k) === "(") {
				out += `<span class="fn">${esc(word)}</span>`
			} else if (KEYWORDS.has(word)) {
				out += `<span class="kw">${esc(word)}</span>`
			} else {
				out += esc(word)
			}
			i = j
			continue
		}

		out += esc(c)
		i++
	}

	return out
}

// ── Playground setup ────────────────────────────────────────────────────────

function setupPlayground(): void {
	const section = document.getElementById("playground")
	if (!section) return

	const textarea = section.querySelector<HTMLTextAreaElement>("#playground-code")
	const runBtn = section.querySelector<HTMLButtonElement>("#playground-run")
	const errEl = section.querySelector<HTMLElement>("#playground-error")
	const diagramEl = section.querySelector<HTMLElement>("#playground-diagram")
	const examplesEl = section.querySelector<HTMLElement>("#playground-examples")
	const highlightEl = section.querySelector<HTMLElement>("#pg-highlight")
	if (!textarea || !runBtn || !errEl || !diagramEl || !examplesEl) return

	function highlight(): void {
		if (!highlightEl || !textarea) return
		highlightEl.innerHTML = `${tokenize(textarea.value)}\n`
		highlightEl.scrollTop = textarea.scrollTop
		highlightEl.scrollLeft = textarea.scrollLeft
	}

	let canvas: BpmnCanvas | null = null

	function run(): void {
		if (!textarea || !errEl || !diagramEl) return
		const code = textarea.value.trim()
		if (!code) return

		errEl.textContent = ""
		errEl.style.display = "none"

		// biome-ignore lint/suspicious/noExplicitAny: dynamic result from user code
		let defs: any
		try {
			const fn = new Function("Bpmn", "Dmn", "Form", code)
			defs = fn(Bpmn, Dmn, Form)
		} catch (err) {
			errEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`
			errEl.style.display = ""
			return
		}

		if (!defs || typeof defs !== "object") {
			errEl.textContent = "Code must return a BpmnDefinitions object (call .build())"
			errEl.style.display = ""
			return
		}

		let xml: string
		try {
			xml = Bpmn.export(defs)
		} catch (err) {
			errEl.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`
			errEl.style.display = ""
			return
		}

		canvas?.destroy()
		canvas = null
		diagramEl.innerHTML = ""
		try {
			canvas = new BpmnCanvas({
				container: diagramEl,
				xml,
				theme: "dark",
				fit: "contain",
				grid: false,
			})
		} catch (err) {
			errEl.textContent = `Render failed: ${err instanceof Error ? err.message : String(err)}`
			errEl.style.display = ""
		}
	}

	// Pre-fill and run starter code
	textarea.value = STARTER_CODE
	highlight()
	run()

	textarea.addEventListener("input", highlight)
	textarea.addEventListener("scroll", () => {
		if (!highlightEl || !textarea) return
		highlightEl.scrollTop = textarea.scrollTop
		highlightEl.scrollLeft = textarea.scrollLeft
	})

	runBtn.addEventListener("click", run)
	textarea.addEventListener("keydown", (e) => {
		// Ctrl/Cmd+Enter to run
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault()
			run()
		}
		// Tab key inserts spaces
		if (e.key === "Tab") {
			e.preventDefault()
			const start = textarea.selectionStart
			const end = textarea.selectionEnd
			textarea.value = `${textarea.value.slice(0, start)}  ${textarea.value.slice(end)}`
			textarea.selectionStart = start + 2
			textarea.selectionEnd = start + 2
		}
	})

	// Example buttons
	for (const example of EXAMPLE_SNIPPETS) {
		const btn = document.createElement("button")
		btn.className = "pg-example-btn"
		btn.textContent = example.label
		btn.addEventListener("click", () => {
			textarea.value = example.code
			highlight()
			run()
		})
		examplesEl.append(btn)
	}
}

// ── Init ─────────────────────────────────────────────────────────────────────

setupDmnTabs()
setupPlayground()

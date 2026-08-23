import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { esc, tokenize } from "../lib/highlight.js"
import { createSpecThemePlugin } from "./canvas-theme.js"

// ── DMN section tabs ─────────────────────────────────────────────────────────

function setupDmnTabs(): void {
	const tabs = Array.from(document.querySelectorAll<HTMLElement>(".dmn-tab"))
	const panels = document.querySelectorAll<HTMLElement>(".dmn-panel")

	function activate(tab: HTMLElement): void {
		const target = tab.dataset.tab
		if (!target) return
		for (const t of tabs) {
			const isActive = t === tab
			t.classList.toggle("active", isActive)
			t.setAttribute("aria-selected", String(isActive))
			t.tabIndex = isActive ? 0 : -1
		}
		for (const p of panels) p.classList.remove("active")
		const panel = document.querySelector<HTMLElement>(`.dmn-panel[data-panel="${target}"]`)
		if (panel) panel.classList.add("active")

		// Render BPMN preview when that tab is first activated
		if (target === "bpmn") renderDmnBpmnPreview()
	}

	for (const [i, tab] of tabs.entries()) {
		tab.addEventListener("click", () => activate(tab))

		// Roving-tabindex arrow-key navigation, per the WAI-ARIA tabs pattern.
		tab.addEventListener("keydown", (e) => {
			let nextIndex: number | null = null
			if (e.key === "ArrowRight") nextIndex = (i + 1) % tabs.length
			else if (e.key === "ArrowLeft") nextIndex = (i - 1 + tabs.length) % tabs.length
			else if (e.key === "Home") nextIndex = 0
			else if (e.key === "End") nextIndex = tabs.length - 1
			if (nextIndex === null) return

			e.preventDefault()
			const next = tabs[nextIndex]
			if (next) {
				next.focus()
				activate(next)
			}
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

	_dmnBpmnCanvas = new BpmnCanvas({
		container,
		xml,
		theme: "light",
		fit: "contain",
		grid: false,
		plugins: [createSpecThemePlugin()],
	})
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
	{
		label: "DMN decision table",
		code: `return Dmn.createDecisionTable("Eligibility")
  .name("Loan Eligibility")
  .input({ label: "Credit Score", expression: "creditScore", typeRef: "integer" })
  .input({ label: "Income", expression: "income", typeRef: "number" })
  .output({ label: "Eligible", name: "eligible", typeRef: "boolean" })
  .output({ label: "Max Amount", name: "maxAmount", typeRef: "number" })
  .rule({ inputs: [">= 700", ">= 50000"], outputs: ["true", "500000"] })
  .rule({ inputs: [">= 600", ">= 30000"], outputs: ["true", "200000"] })
  .rule({ inputs: ["-", "-"], outputs: ["false", "0"] })
  .build()`,
	},
	{
		label: "Camunda Form",
		code: `return Form.create("ApplicationForm")
  .textfield("Applicant Name", "applicantName")
  .textfield("Requested Amount", "requestAmount")
  .select("Loan Type", "loanType", {
    values: [
      { label: "Personal", value: "personal" },
      { label: "Business", value: "business" },
    ],
  })
  .build()`,
	},
]

function renderTextPreview(container: HTMLElement, content: string): void {
	container.innerHTML = `<pre class="pg-text-preview">${esc(content)}</pre>`
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
			errEl.textContent =
				"Code must return a BpmnDefinitions, DmnDefinitions, or FormDefinition object (call .build())"
			errEl.style.display = ""
			return
		}

		canvas?.destroy()
		canvas = null
		diagramEl.innerHTML = ""

		// BPMN diagrams render on the live canvas. DMN tables and Forms have no
		// diagram notation — show their generated XML/JSON instead.
		if (Array.isArray(defs.processes)) {
			let xml: string
			try {
				xml = Bpmn.export(defs)
			} catch (err) {
				errEl.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`
				errEl.style.display = ""
				return
			}
			try {
				canvas = new BpmnCanvas({
					container: diagramEl,
					xml,
					theme: "light",
					fit: "contain",
					grid: false,
					plugins: [createSpecThemePlugin()],
				})
			} catch (err) {
				errEl.textContent = `Render failed: ${err instanceof Error ? err.message : String(err)}`
				errEl.style.display = ""
			}
			return
		}

		if (Array.isArray(defs.decisions)) {
			try {
				renderTextPreview(diagramEl, Dmn.export(defs))
			} catch (err) {
				errEl.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`
				errEl.style.display = ""
			}
			return
		}

		if (Array.isArray(defs.components)) {
			try {
				renderTextPreview(diagramEl, Form.export(defs))
			} catch (err) {
				errEl.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`
				errEl.style.display = ""
			}
			return
		}

		errEl.textContent =
			"Code must return a BpmnDefinitions, DmnDefinitions, or FormDefinition object (call .build())"
		errEl.style.display = ""
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

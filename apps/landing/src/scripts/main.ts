import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn } from "@bpmnkit/core"
import { createSpecThemePlugin } from "./canvas-theme.js"

// ── Utilities ──────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Copies text to the clipboard, falling back to a hidden textarea when the
 * Clipboard API is unavailable (e.g. non-secure contexts). Resolves `true`
 * on success so callers can show accurate feedback. */
async function copyText(text: string): Promise<boolean> {
	if (navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text)
			return true
		} catch {
			// fall through to the legacy fallback below
		}
	}
	try {
		const textarea = document.createElement("textarea")
		textarea.value = text
		textarea.style.position = "fixed"
		textarea.style.opacity = "0"
		document.body.appendChild(textarea)
		textarea.select()
		const ok = document.execCommand("copy")
		textarea.remove()
		return ok
	} catch {
		return false
	}
}

/** Announces a message to screen readers via the shared aria-live region.
 * Clearing it first ensures repeat announcements (e.g. "Copied!" twice in a
 * row) still fire, since AT only announces on a content change. */
function announce(message: string): void {
	const region = document.getElementById("copy-status")
	if (!region) return
	region.textContent = ""
	window.setTimeout(() => {
		region.textContent = message
	}, 30)
}

// ── Package manager tabs ───────────────────────────────────────────────

function setupPkgTabs(): void {
	const tabs = document.querySelectorAll<HTMLElement>(".pkg-tab")
	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const pkg = tab.dataset.pkg
			if (!pkg) return
			const step = tab.closest(".step")
			if (!step) return

			for (const t of step.querySelectorAll<HTMLElement>(".pkg-tab")) {
				t.classList.remove("active")
				t.setAttribute("aria-pressed", "false")
			}
			for (const c of step.querySelectorAll<HTMLElement>(".pkg-cmd")) c.classList.remove("active")

			tab.classList.add("active")
			tab.setAttribute("aria-pressed", "true")
			const cmd = step.querySelector<HTMLElement>(`.pkg-cmd[data-pkg="${pkg}"]`)
			if (cmd) cmd.classList.add("active")
		})
	}
}

// ── Copy buttons ───────────────────────────────────────────────────────

function setupCopyButtons(): void {
	const blocks = document.querySelectorAll<HTMLElement>("pre:not(.cmp-code--xml)")
	for (const pre of blocks) {
		const wrapper = document.createElement("div")
		wrapper.className = "copy-wrapper"
		pre.parentNode?.insertBefore(wrapper, pre)
		wrapper.appendChild(pre)

		const btn = document.createElement("button")
		btn.className = "copy-btn"
		btn.textContent = "copy"
		btn.type = "button"
		wrapper.appendChild(btn)

		btn.addEventListener("click", async () => {
			const code = pre.querySelector("code")
			const text = (code ?? pre).textContent ?? ""
			const ok = await copyText(text.trim())
			btn.textContent = ok ? "copied" : "copy failed"
			btn.classList.toggle("copied", ok)
			announce(ok ? "Copied to clipboard" : "Copy failed")
			setTimeout(() => {
				btn.textContent = "copy"
				btn.classList.remove("copied")
			}, 1500)
		})
	}
}

// ── Install button ─────────────────────────────────────────────────────

function setupInstallButton(): void {
	const btn = document.getElementById("install-btn")
	if (!btn) return
	btn.addEventListener("click", async () => {
		const code = btn.querySelector("code")
		const text = code?.textContent?.trim() ?? ""
		const ok = await copyText(text)
		if (ok) {
			btn.classList.add("copied")
			announce("Copied to clipboard")
			setTimeout(() => btn.classList.remove("copied"), 1500)
		} else {
			announce("Copy failed")
		}
	})
}

// ── "See it in action" animation ───────────────────────────────────────

type AnimStage = {
	lines: string[]
	xml: string | null
}

type AnimExample = {
	filename: string
	stages: AnimStage[]
}

function buildAnimExamples(): AnimExample[] {
	// ── Example 1: Order Validation (linear) ─────────────────────────────
	const e1s1 = Bpmn.export(
		Bpmn.createProcess("order-validation")
			.name("Order Validation")
			.startEvent("start", { name: "Order Received" })
			.serviceTask("validate", { name: "Validate Order", taskType: "validate-order" })
			.withAutoLayout()
			.build(),
	)
	const e1s2 = Bpmn.export(
		Bpmn.createProcess("order-validation")
			.name("Order Validation")
			.startEvent("start", { name: "Order Received" })
			.serviceTask("validate", { name: "Validate Order", taskType: "validate-order" })
			.serviceTask("notify", { name: "Send Confirmation", taskType: "send-email" })
			.endEvent("end", { name: "Done" })
			.withAutoLayout()
			.build(),
	)

	// ── Example 2: Approval Workflow (exclusive gateway) ─────────────────
	const e2s1 = Bpmn.export(
		Bpmn.createProcess("approval-flow")
			.name("Approval Flow")
			.startEvent("start", { name: "Request Submitted" })
			.userTask("review", { name: "Review Request" })
			.exclusiveGateway("gw", { name: "Approved?" })
			.withAutoLayout()
			.build(),
	)
	const e2s2 = Bpmn.export(
		Bpmn.createProcess("approval-flow")
			.name("Approval Flow")
			.startEvent("start", { name: "Request Submitted" })
			.userTask("review", { name: "Review Request" })
			.exclusiveGateway("gw", { name: "Approved?" })
			.branch("yes", (b) =>
				b
					.condition("= approved")
					.serviceTask("notify-ok", { name: "Notify Approved", taskType: "send-email" })
					.endEvent("end-ok", { name: "Approved" }),
			)
			.branch("no", (b) => b.defaultFlow().endEvent("end-no", { name: "Rejected" }))
			.withAutoLayout()
			.build(),
	)

	// ── Example 3: AI Support Agent (ad-hoc subprocess) ──────────────────
	const e3s1 = Bpmn.export(
		Bpmn.createProcess("ai-support-agent")
			.name("AI Support Agent")
			.startEvent("start", { name: "Ticket Received" })
			.serviceTask("classify", { name: "Classify Issue", taskType: "llm-classify" })
			.withAutoLayout()
			.build(),
	)
	const e3s2 = Bpmn.export(
		Bpmn.createProcess("ai-support-agent")
			.name("AI Support Agent")
			.startEvent("start", { name: "Ticket Received" })
			.serviceTask("classify", { name: "Classify Issue", taskType: "llm-classify" })
			.adHocSubProcess(
				"agent-loop",
				(sub) =>
					sub
						.serviceTask("think", { name: "Think", taskType: "llm-think" })
						.serviceTask("act", { name: "Act", taskType: "tool-call" })
						.serviceTask("observe", { name: "Observe", taskType: "tool-result" }),
				{ name: "Agent Loop" },
			)
			.endEvent("end", { name: "Resolved" })
			.withAutoLayout()
			.build(),
	)

	// ── Example 4: Order Fulfillment (parallel gateway) ──────────────────
	const e4s1 = Bpmn.export(
		Bpmn.createProcess("order-fulfillment")
			.name("Order Fulfillment")
			.startEvent("start", { name: "Order Confirmed" })
			.parallelGateway("split", { name: "Parallel Split" })
			.withAutoLayout()
			.build(),
	)
	const e4s2 = Bpmn.export(
		Bpmn.createProcess("order-fulfillment")
			.name("Order Fulfillment")
			.startEvent("start", { name: "Order Confirmed" })
			.parallelGateway("split", { name: "" })
			.branch("warehouse", (b) =>
				b.serviceTask("pick", { name: "Pick & Pack", taskType: "warehouse-pick" }),
			)
			.branch("payment", (b) =>
				b.serviceTask("charge", { name: "Charge Payment", taskType: "payment-charge" }),
			)
			.branch("notify", (b) =>
				b.serviceTask("email", { name: "Send Email", taskType: "send-email" }),
			)
			.parallelGateway("join", { name: "" })
			.endEvent("end", { name: "Fulfilled" })
			.withAutoLayout()
			.build(),
	)

	// ── Example 5: Payment Processing (linear with user task) ────────────
	const e5s1 = Bpmn.export(
		Bpmn.createProcess("payment-processing")
			.name("Payment Processing")
			.startEvent("start", { name: "Checkout" })
			.serviceTask("validate-card", { name: "Validate Card", taskType: "payment-validate" })
			.serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
			.withAutoLayout()
			.build(),
	)
	const e5s2 = Bpmn.export(
		Bpmn.createProcess("payment-processing")
			.name("Payment Processing")
			.startEvent("start", { name: "Checkout" })
			.serviceTask("validate-card", { name: "Validate Card", taskType: "payment-validate" })
			.serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
			.serviceTask("receipt", { name: "Send Receipt", taskType: "send-email" })
			.endEvent("end", { name: "Payment Done" })
			.withAutoLayout()
			.build(),
	)

	return [
		{
			filename: "order-validation.ts",
			stages: [
				{
					lines: [
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;`,
						"",
						`<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"order-validation"</span>)`,
						`  .<span class="fn">name</span>(<span class="str">"Order Validation"</span>)`,
						`  .<span class="fn">startEvent</span>(<span class="str">"start"</span>, { name: <span class="str">"Order Received"</span> })`,
						`  .<span class="fn">serviceTask</span>(<span class="str">"validate"</span>, {`,
						`    taskType: <span class="str">"validate-order"</span>,`,
						"  })",
					],
					xml: e1s1,
				},
				{
					lines: [
						`  .<span class="fn">serviceTask</span>(<span class="str">"notify"</span>, {`,
						`    name: <span class="str">"Send Confirmation"</span>,`,
						`    taskType: <span class="str">"send-email"</span>,`,
						"  })",
						`  .<span class="fn">endEvent</span>(<span class="str">"end"</span>, { name: <span class="str">"Done"</span> })`,
						`  .<span class="fn">withAutoLayout</span>().<span class="fn">build</span>();`,
					],
					xml: e1s2,
				},
			],
		},
		{
			filename: "approval-flow.ts",
			stages: [
				{
					lines: [
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;`,
						"",
						`<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"approval-flow"</span>)`,
						`  .<span class="fn">name</span>(<span class="str">"Approval Flow"</span>)`,
						`  .<span class="fn">startEvent</span>(<span class="str">"start"</span>, { name: <span class="str">"Request Submitted"</span> })`,
						`  .<span class="fn">userTask</span>(<span class="str">"review"</span>, { name: <span class="str">"Review Request"</span> })`,
						`  .<span class="fn">exclusiveGateway</span>(<span class="str">"gw"</span>, { name: <span class="str">"Approved?"</span> })`,
					],
					xml: e2s1,
				},
				{
					lines: [
						`  .<span class="fn">branch</span>(<span class="str">"yes"</span>, b =>`,
						`    b.<span class="fn">condition</span>(<span class="str">"= approved"</span>)`,
						`     .<span class="fn">serviceTask</span>(<span class="str">"notify-ok"</span>, { taskType: <span class="str">"send-email"</span> })`,
						`     .<span class="fn">endEvent</span>(<span class="str">"end-ok"</span>))`,
						`  .<span class="fn">branch</span>(<span class="str">"no"</span>, b =>`,
						`    b.<span class="fn">defaultFlow</span>().<span class="fn">endEvent</span>(<span class="str">"end-no"</span>))`,
						`  .<span class="fn">withAutoLayout</span>().<span class="fn">build</span>();`,
					],
					xml: e2s2,
				},
			],
		},
		{
			filename: "ai-support-agent.ts",
			stages: [
				{
					lines: [
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;`,
						"",
						`<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"ai-support-agent"</span>)`,
						`  .<span class="fn">name</span>(<span class="str">"AI Support Agent"</span>)`,
						`  .<span class="fn">startEvent</span>(<span class="str">"start"</span>, { name: <span class="str">"Ticket Received"</span> })`,
						`  .<span class="fn">serviceTask</span>(<span class="str">"classify"</span>, {`,
						`    taskType: <span class="str">"llm-classify"</span>,`,
						"  })",
					],
					xml: e3s1,
				},
				{
					lines: [
						`  .<span class="fn">adHocSubProcess</span>(<span class="str">"agent-loop"</span>, sub =>`,
						`    sub.<span class="fn">serviceTask</span>(<span class="str">"think"</span>, { taskType: <span class="str">"llm-think"</span> })`,
						`       .<span class="fn">serviceTask</span>(<span class="str">"act"</span>, { taskType: <span class="str">"tool-call"</span> })`,
						`       .<span class="fn">serviceTask</span>(<span class="str">"observe"</span>, { taskType: <span class="str">"tool-result"</span> }),`,
						`    { name: <span class="str">"Agent Loop"</span> })`,
						`  .<span class="fn">endEvent</span>(<span class="str">"end"</span>, { name: <span class="str">"Resolved"</span> })`,
						`  .<span class="fn">withAutoLayout</span>().<span class="fn">build</span>();`,
					],
					xml: e3s2,
				},
			],
		},
		{
			filename: "order-fulfillment.ts",
			stages: [
				{
					lines: [
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;`,
						"",
						`<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"order-fulfillment"</span>)`,
						`  .<span class="fn">name</span>(<span class="str">"Order Fulfillment"</span>)`,
						`  .<span class="fn">startEvent</span>(<span class="str">"start"</span>, { name: <span class="str">"Order Confirmed"</span> })`,
						`  .<span class="fn">parallelGateway</span>(<span class="str">"split"</span>)`,
					],
					xml: e4s1,
				},
				{
					lines: [
						`  .<span class="fn">branch</span>(<span class="str">"warehouse"</span>, b =>`,
						`    b.<span class="fn">serviceTask</span>(<span class="str">"pick"</span>, { taskType: <span class="str">"warehouse-pick"</span> }))`,
						`  .<span class="fn">branch</span>(<span class="str">"payment"</span>, b =>`,
						`    b.<span class="fn">serviceTask</span>(<span class="str">"charge"</span>, { taskType: <span class="str">"payment-charge"</span> }))`,
						`  .<span class="fn">branch</span>(<span class="str">"notify"</span>, b =>`,
						`    b.<span class="fn">serviceTask</span>(<span class="str">"email"</span>, { taskType: <span class="str">"send-email"</span> }))`,
						`  .<span class="fn">parallelGateway</span>(<span class="str">"join"</span>)`,
						`  .<span class="fn">endEvent</span>(<span class="str">"end"</span>).<span class="fn">withAutoLayout</span>().<span class="fn">build</span>();`,
					],
					xml: e4s2,
				},
			],
		},
		{
			filename: "payment-processing.ts",
			stages: [
				{
					lines: [
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;`,
						"",
						`<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"payment-processing"</span>)`,
						`  .<span class="fn">name</span>(<span class="str">"Payment Processing"</span>)`,
						`  .<span class="fn">startEvent</span>(<span class="str">"start"</span>, { name: <span class="str">"Checkout"</span> })`,
						`  .<span class="fn">serviceTask</span>(<span class="str">"validate-card"</span>, {`,
						`    taskType: <span class="str">"payment-validate"</span>,`,
						"  })",
						`  .<span class="fn">serviceTask</span>(<span class="str">"charge"</span>, { taskType: <span class="str">"payment-charge"</span> })`,
					],
					xml: e5s1,
				},
				{
					lines: [
						`  .<span class="fn">serviceTask</span>(<span class="str">"receipt"</span>, {`,
						`    name: <span class="str">"Send Receipt"</span>,`,
						`    taskType: <span class="str">"send-email"</span>,`,
						"  })",
						`  .<span class="fn">endEvent</span>(<span class="str">"end"</span>, { name: <span class="str">"Payment Done"</span> })`,
						`  .<span class="fn">withAutoLayout</span>().<span class="fn">build</span>();`,
					],
					xml: e5s2,
				},
			],
		},
	]
}

let animCanvas: BpmnCanvas | null = null
let animActive = false
let animHovered = false
let animCancelled = false
let animResumeIndex: number | null = null
let animHoverIndex = 0

// Persistent cursor element moved between lines
const animCursor = document.createElement("span")
animCursor.className = "anim-cursor"
animCursor.setAttribute("aria-hidden", "true")

function appendAnimLine(container: HTMLElement, html: string): void {
	// Detach cursor from previous line before appending new one
	animCursor.remove()

	const line = document.createElement("div")
	line.className = "anim-line anim-line-entering"

	if (html === "") {
		line.innerHTML = "\u00a0" // non-breaking space keeps line height
		line.classList.add("anim-line--empty")
	} else {
		line.innerHTML = html
		line.appendChild(animCursor)
	}

	container.appendChild(line)

	// Double-RAF ensures the entering class is removed after the browser has painted,
	// triggering the CSS transition from the "entering" state to the final state.
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			line.classList.remove("anim-line-entering")
		})
	})
}

async function updateAnimDiagram(xml: string): Promise<void> {
	const container = document.getElementById("anim-diagram")
	if (!container) return

	// Fade out old canvas
	container.style.transition = "opacity 0.25s ease"
	container.style.opacity = "0"
	await delay(280)

	animCanvas?.destroy()
	animCanvas = null
	container.innerHTML = ""
	container.style.transition = ""
	container.style.opacity = "1"

	// The theme plugin handles the fade-in after diagram:load.
	// maxZoom: 1.4 keeps compact diagrams from over-filling the canvas.
	animCanvas = new BpmnCanvas({
		container,
		xml,
		theme: "light",
		fit: "contain",
		plugins: [createSpecThemePlugin({ maxZoom: 1.4 })],
	})
}

// Show the final state of an example instantly (no animation) — used on hover.
function showExampleInstant(
	example: AnimExample,
	linesContainer: HTMLElement,
	filenameEl: HTMLElement,
): void {
	filenameEl.textContent = example.filename
	linesContainer.style.transition = ""
	linesContainer.style.opacity = "1"
	linesContainer.innerHTML = ""
	animCursor.remove()

	for (const stage of example.stages) {
		for (const html of stage.lines) {
			const line = document.createElement("div")
			line.className = "anim-line"
			if (html === "") {
				line.innerHTML = "\u00a0"
				line.classList.add("anim-line--empty")
			} else {
				line.innerHTML = html
			}
			linesContainer.appendChild(line)
		}
	}

	// Show the final diagram instantly (no fade)
	const finalXml = [...example.stages].reverse().find((s) => s.xml !== null)?.xml ?? null
	if (finalXml) {
		const container = document.getElementById("anim-diagram")
		if (container) {
			animCanvas?.destroy()
			animCanvas = null
			container.innerHTML = ""
			container.style.transition = ""
			container.style.opacity = "1"
			animCanvas = new BpmnCanvas({
				container,
				xml: finalXml,
				theme: "light",
				fit: "contain",
				plugins: [createSpecThemePlugin({ maxZoom: 1.4 })],
			})
		}
	}
}

async function runAnimCycle(
	linesContainer: HTMLElement,
	filenameEl: HTMLElement,
	example: AnimExample,
): Promise<void> {
	// Update filename in code topbar
	filenameEl.textContent = example.filename
	linesContainer.innerHTML = ""
	animCursor.remove()

	for (const stage of example.stages) {
		for (const line of stage.lines) {
			if (animCancelled) return
			appendAnimLine(linesContainer, line)
			await delay(115)
		}
		if (animCancelled) return

		if (stage.xml !== null) {
			await delay(420)
			if (animCancelled) return
			await updateAnimDiagram(stage.xml)
			await delay(800)
			if (animCancelled) return
		} else {
			await delay(300)
			if (animCancelled) return
		}
	}

	// Hold on the completed diagram before switching to next example
	await delay(2000)
	if (animCancelled) return

	// Fade out code lines
	linesContainer.style.transition = "opacity 0.45s ease"
	linesContainer.style.opacity = "0"
	await delay(480)
	linesContainer.style.transition = ""
	linesContainer.style.opacity = "1"
}

// Returns the ms a cycle takes up to (and including) the hold — i.e. how long
// the progress bar should take to fill from 0 → 100%.
function computeExampleDuration(example: AnimExample): number {
	let ms = 0
	for (const stage of example.stages) {
		ms += stage.lines.length * 115
		if (stage.xml !== null) {
			// delay before diagram + fade-out inside updateAnimDiagram + post-diagram delay
			ms += 420 + 280 + 800
		} else {
			ms += 300
		}
	}
	ms += 2000 // hold at end
	return ms
}

async function runAnimLoop(
	linesContainer: HTMLElement,
	filenameEl: HTMLElement,
	examples: AnimExample[],
): Promise<void> {
	const progressEl = document.getElementById("anim-progress")
	const barFills = progressEl
		? Array.from(progressEl.querySelectorAll<HTMLElement>(".anim-bar-fill"))
		: []

	let i = 0
	while (animActive) {
		// Pause here while the user is hovering a bar
		if (animHovered) {
			await delay(50)
			continue
		}

		// Resume from the example the user last hovered
		if (animResumeIndex !== null) {
			i = animResumeIndex
			animResumeIndex = null
		}

		const idx = i % examples.length
		const example = examples[idx]
		if (!example) {
			i += 1
			continue
		}

		// Reset all fills, then animate only the current one
		for (const fill of barFills) {
			fill.style.transition = "none"
			fill.style.width = "0%"
		}
		const currFill = barFills[idx]
		if (currFill) {
			currFill.getBoundingClientRect() // force reflow so transition triggers
			currFill.style.transition = `width ${computeExampleDuration(example)}ms linear`
			currFill.style.width = "100%"
		}

		animCancelled = false
		await runAnimCycle(linesContainer, filenameEl, example)

		// Only advance if the cycle completed naturally (not cancelled by hover)
		if (!animCancelled) {
			i += 1
		}
	}

	// Reset all bars when animation stops
	for (const fill of barFills) {
		fill.style.transition = "none"
		fill.style.width = "0%"
	}
}

function setupAnimation(): void {
	const demo = document.getElementById("anim-demo")
	const linesContainer = document.getElementById("anim-code-lines")
	const filenameEl = document.getElementById("anim-filename")
	if (!demo || !linesContainer || !filenameEl) return

	// buildAnimExamples() runs several build+layout+export passes — defer it
	// until the section is actually needed instead of paying that cost at
	// page load for a section the visitor may never scroll to.
	let examples: AnimExample[] | null = null
	const getExamples = (): AnimExample[] => {
		if (!examples) examples = buildAnimExamples()
		return examples
	}

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		// Show the first example's completed code + diagram instead of animating.
		const first = getExamples()[0]
		if (first) showExampleInstant(first, linesContainer, filenameEl)
		document.getElementById("anim-progress")?.style.setProperty("display", "none")
		return
	}

	// ── Bar hover: show example instantly, pause animation ─────────────
	const progressEl = document.getElementById("anim-progress")
	if (progressEl) {
		const bars = Array.from(progressEl.querySelectorAll<HTMLElement>(".anim-bar"))
		const fills = Array.from(progressEl.querySelectorAll<HTMLElement>(".anim-bar-fill"))

		for (const [idx, bar] of bars.entries()) {
			bar.addEventListener("mouseenter", () => {
				if (!animActive) return
				animCancelled = true
				animHovered = true
				animHoverIndex = idx

				// Freeze all fills at their current visual width
				for (const fill of fills) {
					const w = window.getComputedStyle(fill).width
					fill.style.transition = "none"
					fill.style.width = w
				}

				// Highlight hovered bar
				for (const [j, b] of bars.entries()) {
					b.classList.toggle("anim-bar--active", j === idx)
				}

				const example = getExamples()[idx]
				if (example) showExampleInstant(example, linesContainer, filenameEl)
			})
		}

		// Use the container's mouseleave (not individual bars) so moving between
		// bars doesn't briefly unpause the animation.
		progressEl.addEventListener("mouseleave", () => {
			animHovered = false
			animCancelled = false
			animResumeIndex = animHoverIndex
			for (const b of bars) b.classList.remove("anim-bar--active")
		})
	}

	// ── Start/pause animation based on viewport visibility ─────────────
	// Pausing when out of view prevents layout shifts from happening while
	// the user is reading other sections (especially important on mobile).
	let loopRunning = false

	const startLoop = () => {
		animActive = true
		animCancelled = false
		if (!loopRunning) {
			loopRunning = true
			runAnimLoop(linesContainer, filenameEl, getExamples()).finally(() => {
				loopRunning = false
			})
		}
		// If the loop is already running mid-await, setting animActive = true
		// is enough — it will continue when the current await resolves.
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					startLoop()
				} else {
					// Signal the loop to stop at the next animCancelled check.
					animActive = false
					animCancelled = true
				}
			}
		},
		{ threshold: 0.1 },
	)

	observer.observe(demo)
}

// ── Init ───────────────────────────────────────────────────────────────
// Mobile nav is handled by Nav.astro's own inline script.

setupCopyButtons()
setupPkgTabs()
setupInstallButton()
setupAnimation()

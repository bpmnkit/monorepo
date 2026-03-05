import { BpmnCanvas } from "@bpmn-sdk/canvas";
import { Bpmn } from "@bpmn-sdk/core";
import { createNeonThemePlugin } from "./neon-plugin.js";

// ── Utilities ──────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Hero diagram ───────────────────────────────────────────────────────

function setupHeroDiagram(): void {
	const container = document.getElementById("diagram-hero");
	if (!container) return;

	const xml = Bpmn.export(
		Bpmn.createProcess("order-flow")
			.name("Order Flow")
			.startEvent("start", { name: "Order Received" })
			.serviceTask("validate", { name: "Validate Order", taskType: "validate-order" })
			.exclusiveGateway("gw", { name: "Valid?" })
			.branch("yes", (b) =>
				b
					.condition("= valid")
					.serviceTask("process", { name: "Process Order", taskType: "process-order" })
					.endEvent("end-ok", { name: "Done" }),
			)
			.branch("no", (b) => b.defaultFlow().endEvent("end-rejected", { name: "Rejected" }))
			.withAutoLayout()
			.build(),
	);

	new BpmnCanvas({
		container,
		xml,
		theme: "dark",
		grid: true,
		fit: "contain",
		plugins: [createNeonThemePlugin()],
	});
}

// ── Package manager tabs ───────────────────────────────────────────────

function setupPkgTabs(): void {
	const tabs = document.querySelectorAll<HTMLElement>(".pkg-tab");
	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const pkg = tab.dataset.pkg;
			if (!pkg) return;
			const step = tab.closest(".step");
			if (!step) return;

			for (const t of step.querySelectorAll<HTMLElement>(".pkg-tab")) t.classList.remove("active");
			for (const c of step.querySelectorAll<HTMLElement>(".pkg-cmd")) c.classList.remove("active");

			tab.classList.add("active");
			const cmd = step.querySelector<HTMLElement>(`.pkg-cmd[data-pkg="${pkg}"]`);
			if (cmd) cmd.classList.add("active");
		});
	}
}

// ── Copy buttons ───────────────────────────────────────────────────────

function setupCopyButtons(): void {
	const blocks = document.querySelectorAll<HTMLElement>("pre");
	for (const pre of blocks) {
		const wrapper = document.createElement("div");
		wrapper.className = "copy-wrapper";
		pre.parentNode?.insertBefore(wrapper, pre);
		wrapper.appendChild(pre);

		const btn = document.createElement("button");
		btn.className = "copy-btn";
		btn.textContent = "Copy";
		btn.type = "button";
		wrapper.appendChild(btn);

		btn.addEventListener("click", () => {
			const code = pre.querySelector("code");
			const text = (code ?? pre).textContent ?? "";
			navigator.clipboard.writeText(text.trim()).then(() => {
				btn.textContent = "Copied!";
				btn.classList.add("copied");
				setTimeout(() => {
					btn.textContent = "Copy";
					btn.classList.remove("copied");
				}, 1500);
			});
		});
	}
}

// ── Install button ─────────────────────────────────────────────────────

function setupInstallButton(): void {
	const btn = document.getElementById("install-btn");
	if (!btn) return;
	btn.addEventListener("click", () => {
		const code = btn.querySelector("code");
		const text = code?.textContent?.trim() ?? "";
		navigator.clipboard.writeText(text).then(() => {
			btn.classList.add("copied");
			setTimeout(() => btn.classList.remove("copied"), 1500);
		});
	});
}

// ── Bento spotlight ────────────────────────────────────────────────────

function setupBentoSpotlight(): void {
	const bento = document.getElementById("bento");
	if (!bento) return;
	bento.addEventListener("pointermove", (e: PointerEvent) => {
		const rect = bento.getBoundingClientRect();
		bento.style.setProperty("--mx", `${e.clientX - rect.left}px`);
		bento.style.setProperty("--my", `${e.clientY - rect.top}px`);
	});
}

// ── "See it in action" animation ───────────────────────────────────────

type AnimStage = {
	lines: string[];
	xml: string | null;
};

type AnimExample = {
	filename: string;
	stages: AnimStage[];
};

function buildAnimExamples(): AnimExample[] {
	// ── Example 1: Order Validation (linear) ─────────────────────────────
	const e1s1 = Bpmn.export(
		Bpmn.createProcess("order-validation")
			.name("Order Validation")
			.startEvent("start", { name: "Order Received" })
			.serviceTask("validate", { name: "Validate Order", taskType: "validate-order" })
			.withAutoLayout()
			.build(),
	);
	const e1s2 = Bpmn.export(
		Bpmn.createProcess("order-validation")
			.name("Order Validation")
			.startEvent("start", { name: "Order Received" })
			.serviceTask("validate", { name: "Validate Order", taskType: "validate-order" })
			.serviceTask("notify", { name: "Send Confirmation", taskType: "send-email" })
			.endEvent("end", { name: "Done" })
			.withAutoLayout()
			.build(),
	);

	// ── Example 2: Approval Workflow (exclusive gateway) ─────────────────
	const e2s1 = Bpmn.export(
		Bpmn.createProcess("approval-flow")
			.name("Approval Flow")
			.startEvent("start", { name: "Request Submitted" })
			.userTask("review", { name: "Review Request" })
			.exclusiveGateway("gw", { name: "Approved?" })
			.withAutoLayout()
			.build(),
	);
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
	);

	// ── Example 3: AI Support Agent (ad-hoc subprocess) ──────────────────
	const e3s1 = Bpmn.export(
		Bpmn.createProcess("ai-support-agent")
			.name("AI Support Agent")
			.startEvent("start", { name: "Ticket Received" })
			.serviceTask("classify", { name: "Classify Issue", taskType: "llm-classify" })
			.withAutoLayout()
			.build(),
	);
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
	);

	// ── Example 4: Order Fulfillment (parallel gateway) ──────────────────
	const e4s1 = Bpmn.export(
		Bpmn.createProcess("order-fulfillment")
			.name("Order Fulfillment")
			.startEvent("start", { name: "Order Confirmed" })
			.parallelGateway("split", { name: "Parallel Split" })
			.withAutoLayout()
			.build(),
	);
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
	);

	// ── Example 5: Payment Processing (linear with user task) ────────────
	const e5s1 = Bpmn.export(
		Bpmn.createProcess("payment-processing")
			.name("Payment Processing")
			.startEvent("start", { name: "Checkout" })
			.serviceTask("validate-card", { name: "Validate Card", taskType: "payment-validate" })
			.serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
			.withAutoLayout()
			.build(),
	);
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
	);

	return [
		{
			filename: "order-validation.ts",
			stages: [
				{
					lines: [
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;`,
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
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;`,
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
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;`,
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
						`  .<span class="fn">adHocSubProcess</span>(<span class="str">"agent-loop"</span>,`,
						`    { name: <span class="str">"Agent Loop"</span> }, sub =>`,
						`    sub.<span class="fn">serviceTask</span>(<span class="str">"think"</span>, { taskType: <span class="str">"llm-think"</span> })`,
						`       .<span class="fn">serviceTask</span>(<span class="str">"act"</span>, { taskType: <span class="str">"tool-call"</span> })`,
						`       .<span class="fn">serviceTask</span>(<span class="str">"observe"</span>, { taskType: <span class="str">"tool-result"</span> }))`,
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
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;`,
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
						`<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;`,
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
	];
}

let animCanvas: BpmnCanvas | null = null;
let animActive = false;

// Persistent cursor element moved between lines
const animCursor = document.createElement("span");
animCursor.className = "anim-cursor";
animCursor.setAttribute("aria-hidden", "true");

function appendAnimLine(container: HTMLElement, html: string): void {
	// Detach cursor from previous line before appending new one
	animCursor.remove();

	const line = document.createElement("div");
	line.className = "anim-line anim-line-entering";

	if (html === "") {
		line.innerHTML = "\u00a0"; // non-breaking space keeps line height
		line.classList.add("anim-line--empty");
	} else {
		line.innerHTML = html;
		line.appendChild(animCursor);
	}

	container.appendChild(line);

	// Double-RAF ensures the entering class is removed after the browser has painted,
	// triggering the CSS transition from the "entering" state to the final state.
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			line.classList.remove("anim-line-entering");
		});
	});
}

async function updateAnimDiagram(xml: string): Promise<void> {
	const container = document.getElementById("anim-diagram");
	if (!container) return;

	// Fade out old canvas
	container.style.transition = "opacity 0.25s ease";
	container.style.opacity = "0";
	await delay(280);

	animCanvas?.destroy();
	animCanvas = null;
	container.innerHTML = "";
	container.style.transition = "";
	container.style.opacity = "1";

	// Neon plugin handles the fade-in after diagram:load.
	// maxZoom: 1.4 keeps compact diagrams from over-filling the canvas.
	animCanvas = new BpmnCanvas({
		container,
		xml,
		theme: "dark",
		fit: "contain",
		plugins: [createNeonThemePlugin({ maxZoom: 1.4 })],
	});
}

async function runAnimCycle(
	linesContainer: HTMLElement,
	filenameEl: HTMLElement,
	example: AnimExample,
): Promise<void> {
	// Update filename in code topbar
	filenameEl.textContent = example.filename;
	linesContainer.innerHTML = "";
	animCursor.remove();

	for (const stage of example.stages) {
		for (const line of stage.lines) {
			appendAnimLine(linesContainer, line);
			await delay(115);
		}

		if (stage.xml !== null) {
			await delay(420);
			await updateAnimDiagram(stage.xml);
			await delay(800);
		} else {
			await delay(300);
		}
	}

	// Hold on the completed diagram before switching to next example
	await delay(2000);

	// Fade out code lines
	linesContainer.style.transition = "opacity 0.45s ease";
	linesContainer.style.opacity = "0";
	await delay(480);
	linesContainer.style.transition = "";
	linesContainer.style.opacity = "1";
}

async function runAnimLoop(
	linesContainer: HTMLElement,
	filenameEl: HTMLElement,
	examples: AnimExample[],
): Promise<void> {
	let i = 0;
	while (animActive) {
		const example = examples[i % examples.length];
		if (example) {
			await runAnimCycle(linesContainer, filenameEl, example);
		}
		i += 1;
	}
}

function setupAnimation(): void {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const demo = document.getElementById("anim-demo");
	const linesContainer = document.getElementById("anim-code-lines");
	const filenameEl = document.getElementById("anim-filename");
	if (!demo || !linesContainer || !filenameEl) return;

	const examples = buildAnimExamples();

	// Start the animation the first time the section scrolls into view
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && !animActive) {
					animActive = true;
					observer.disconnect();
					void runAnimLoop(linesContainer, filenameEl, examples);
				}
			}
		},
		{ threshold: 0.2 },
	);

	observer.observe(demo);
}

// ── Init ───────────────────────────────────────────────────────────────

setupHeroDiagram();
setupCopyButtons();
setupPkgTabs();
setupInstallButton();
setupBentoSpotlight();
setupAnimation();

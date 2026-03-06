function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Terminal HTML builders ─────────────────────────────────────────────────────

const tl = (content = "") => `<div class="tl">${content}</div>`;
const tli = (content: string) => `<div class="tl ti">${content}</div>`;
const tb = (s: string) => `<span class="tb">${s}</span>`;
const td = (s: string) => `<span class="td">${s}</span>`;
const tc = (s: string) => `<span class="tc">${s}</span>`;

const SEP = td("─".repeat(54));
const NAV_MAIN = `  ${td("↑↓")} navigate  ${tc("enter")} open  ${tc("q")} quit`;
const NAV_CMD = `  ${td("↑↓")} navigate  ${tc("enter")} select  ${tc("esc")} back  ${tc("q")} quit`;
const NAV_INPUT = `  ${td("↑↓")} navigate  ${tc("enter")} run  ${tc("esc")} back  ${tc("q")} quit`;
const NAV_RESULTS = `  ${td("↑↓")} navigate  ${tc("enter")} detail  ${tc("m")} main  ${tc("q")} quit`;

type CliFrame = {
	html: string;
	key?: string;
	holdMs: number;
	/** 'instant' = just swap cursor row, no fade. 'fade' = full content crossfade. */
	transition?: "fade" | "instant";
};

// ── Frame builders ─────────────────────────────────────────────────────────────

function frameShell(): string {
	return [
		tl(),
		tl(`  ${td("~/projects")} <span class="tp">$</span> ${tb("casen")}<span class="tcur">▊</span>`),
		tl(),
	].join("");
}

function frameMain(cursor: number): string {
	const groups: [string, string][] = [
		["profile", "Manage connection profiles"],
		["process", "Process definitions and instances"],
		["job", "Job workers and activatable jobs"],
		["incident", "Incidents and resolution"],
		["decision", "DMN decision evaluation"],
		["variable", "Process and scope variables"],
		["message", "Message correlation"],
	];
	return [
		tl(),
		tl(`  ${tb("casen")}`),
		tl(`  ${SEP}`),
		tl(),
		...groups.map(([name, desc], i) => {
			const marker = i === cursor ? tc("▶") : " ";
			const nameStr = i === cursor ? tc(name.padEnd(11)) : name.padEnd(11);
			const content = `  ${marker} ${nameStr}  ${td(desc)}`;
			return i === cursor ? tli(content) : tl(content);
		}),
		tl(),
		tl(NAV_MAIN),
	].join("");
}

function frameCommands(cursor: number): string {
	const cmds: [string, string][] = [
		["list", "List deployed process definitions"],
		["get", "Get a specific process definition"],
		["start", "Start a new process instance"],
		["cancel", "Cancel a running process instance"],
		["migrate", "Migrate instances to a new version"],
	];
	return [
		tl(),
		tl(`  ${tb("process")}`),
		tl(`  ${SEP}`),
		tl(`  ${td("Process definitions and instances")}`),
		tl(),
		...cmds.map(([name, desc], i) => {
			const marker = i === cursor ? tc("▶") : " ";
			const nameStr = i === cursor ? tc(name.padEnd(11)) : name.padEnd(11);
			const content = `  ${marker} ${nameStr}  ${td(desc)}`;
			return i === cursor ? tli(content) : tl(content);
		}),
		tl(),
		tl(NAV_CMD),
	].join("");
}

function frameInput(): string {
	return [
		tl(),
		tl(`  ${tb("process")} ${td("›")} ${tc("list")}`),
		tl(`  ${SEP}`),
		tl(`  ${td("List deployed process definitions")}`),
		tl(),
		tl(`    ${td("--limit      ")}  ${td("20")}    ${td("number  optional")}`),
		tl(`    ${td("--state      ")}         ${td("string  optional")}`),
		tl(`    ${td("--process-id ")}         ${td("string  optional")}`),
		tl(),
		tli(`  ${tc("▶")} ${tc("[ Run ]")}`),
		tl(),
		tl(NAV_INPUT),
	].join("");
}

function frameResults(): string {
	const rows: [string, string, string][] = [
		["order-validation", "Order Validation", "1"],
		["payment-processing", "Payment Processing", "2"],
		["ai-support-agent", "AI Support Agent", "1"],
		["approval-flow", "Approval Flow", "3"],
	];
	return [
		tl(),
		tl(`  ${tb("process")} ${td("›")} ${tc("list")}`),
		tl(`  ${SEP}`),
		tl(`  ${td("4 items")}`),
		tl(),
		tl(`  ${td("bpmnProcessId".padEnd(24))} ${td("name".padEnd(22))} ${td("ver")}`),
		tl(`  ${td("─".repeat(54))}`),
		...rows.map(([id, name, ver], i) => {
			const marker = i === 0 ? tc("▶") : " ";
			const idStr = id.padEnd(24);
			const nameStr = name.padEnd(22);
			const content = `${marker} ${idStr} ${nameStr} ${ver}`;
			return i === 0 ? tli(`  ${content}`) : tl(`  ${content}`);
		}),
		tl(),
		tl(NAV_RESULTS),
	].join("");
}

// ── Animation state ────────────────────────────────────────────────────────────

let cliAnimActive = false;

const FRAMES: CliFrame[] = [
	{ html: frameShell(), holdMs: 1000 },
	{ html: frameMain(0), key: "enter", holdMs: 1000 },
	// ↓ moves cursor: instant swap, no fade — only the highlighted row changes
	{ html: frameMain(1), key: "↓", holdMs: 600, transition: "instant" },
	{ html: frameCommands(0), key: "enter", holdMs: 1300 },
	{ html: frameInput(), key: "enter", holdMs: 900 },
	{ html: frameResults(), key: "enter", holdMs: 2800 },
];

async function runCliLoop(content: HTMLElement, badge: HTMLElement): Promise<void> {
	let idx = 0;
	while (cliAnimActive) {
		const frame = FRAMES[idx % FRAMES.length];
		if (!frame) {
			idx++;
			continue;
		}

		if (frame.key) {
			badge.textContent = frame.key;
			badge.classList.add("cli-key-visible");

			if (frame.key === "enter") {
				// Brief pause so user sees the key badge, then flash the selected row
				await delay(180);
				if (!cliAnimActive) break;
				const selected = content.querySelector<HTMLElement>(".ti");
				if (selected) {
					selected.classList.add("cli-row-pressed");
					await delay(150);
					if (!cliAnimActive) break;
					selected.classList.remove("cli-row-pressed");
					await delay(80);
				} else {
					await delay(200);
				}
			} else {
				// Arrow key: hold badge briefly, then update
				await delay(320);
				if (!cliAnimActive) break;
			}
		}

		if (frame.transition === "instant") {
			// No crossfade — just swap cursor row (visual diff is minimal)
			content.innerHTML = frame.html;
		} else {
			content.classList.add("cli-fading");
			await delay(200);
			if (!cliAnimActive) break;
			content.innerHTML = frame.html;
			content.classList.remove("cli-fading");
		}

		if (frame.key) {
			await delay(220);
			badge.classList.remove("cli-key-visible");
		}

		await delay(frame.holdMs);
		if (!cliAnimActive) break;

		idx++;
	}
}

export function setupCliAnimation(): void {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const terminal = document.getElementById("cli-terminal");
	const badge = document.getElementById("cli-key-badge");
	if (!terminal || !badge) return;

	const content = terminal.querySelector<HTMLElement>(".cli-content");
	if (!content) return;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && !cliAnimActive) {
					cliAnimActive = true;
					observer.disconnect();
					void runCliLoop(content, badge);
				}
			}
		},
		{ threshold: 0.25 },
	);

	observer.observe(terminal);
}

setupCliAnimation();

import { deleteProfile, getActiveName, listProfiles, useProfile } from "./profile.js";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const CSI = "\x1b[";

const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const ALT_ON = `${CSI}?1049h`;
const ALT_OFF = `${CSI}?1049l`;
const CLEAR = `${CSI}2J${CSI}H`;

function inv(s: string): string {
	return `${CSI}7m${s}${CSI}m`;
}
function bold(s: string): string {
	return `${CSI}1m${s}${CSI}m`;
}
function dim(s: string): string {
	return `${CSI}2m${s}${CSI}m`;
}
function green(s: string): string {
	return `${CSI}32m${s}${CSI}m`;
}
function red(s: string): string {
	return `${CSI}31m${s}${CSI}m`;
}
function cyan(s: string): string {
	return `${CSI}36m${s}${CSI}m`;
}

/** Strip ANSI codes to get visible length. */
function vlen(s: string): number {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: needed for ANSI stripping
	return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Truncate and pad to exactly n visible characters. */
function fit(s: string, n: number): string {
	if (s.length > n) return `${s.slice(0, n - 1)}…`;
	return s.padEnd(n);
}

// ─── State ────────────────────────────────────────────────────────────────────

interface Row {
	name: string;
	url: string;
	authType: string;
	createdAt: string;
}

interface State {
	rows: Row[];
	activeName: string | null;
	cursor: number;
	selected: Set<number>;
	message: string;
	confirmDelete: boolean;
}

function loadRows(): { rows: Row[]; activeName: string | null } {
	const profiles = listProfiles();
	const activeName = getActiveName();
	const rows = profiles.map((p) => ({
		name: p.name,
		url: (p.config.baseUrl ?? "") as string,
		authType: (p.config.auth as { type?: string } | undefined)?.type ?? "—",
		createdAt: p.createdAt ? p.createdAt.slice(0, 10) : "—",
	}));
	return { rows, activeName };
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(state: State): void {
	const { rows, activeName, cursor, selected, message, confirmDelete } = state;

	const termCols = process.stdout.columns ?? 80;
	// Fixed cols: 2 indent + 3 chk + 1 sp + 1 active + 1 sp + 16 name + 1 sp + 8 auth + 1 sp + 10 date = 44
	const urlWidth = Math.max(16, termCols - 46);

	const out: string[] = [];

	out.push("");
	out.push(
		`  ${bold("casen — Profile Manager")}  ${dim(`${rows.length} profile${rows.length !== 1 ? "s" : ""}`)}`,
	);
	out.push("");

	if (rows.length === 0) {
		out.push(dim("  No profiles yet."));
		out.push(dim("  Create one with: casen profile create <name> ..."));
		out.push("");
	} else {
		// Header
		const hdr =
			`  ${dim("   ")} ${dim(" ")} ${dim(fit("NAME", 16))} ` +
			`${dim(fit("BASE URL", urlWidth))} ${dim(fit("AUTH", 8))} ${dim("CREATED")}`;
		out.push(hdr);
		out.push(dim(`  ${"─".repeat(termCols - 4)}`));

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;
			const isCursor = i === cursor;
			const isSel = selected.has(i);
			const isActive = row.name === activeName;

			const chk = isSel ? green("[✓]") : dim("[ ]");
			const act = isActive ? green("●") : " ";
			const name = fit(row.name, 16);
			const url = fit(row.url, urlWidth);
			const auth = fit(row.authType, 8);
			const date = row.createdAt;

			// Build the line without leading spaces so inverse spans full width
			const content = `  ${chk} ${act} ${name} ${url} ${auth} ${date}`;

			// Pad to terminal width so inverse video fills the row
			const visible = vlen(content);
			const padded = content + " ".repeat(Math.max(0, termCols - visible - 1));

			out.push(isCursor ? inv(padded) : padded);
		}
		out.push("");
	}

	// Status / help bar
	if (confirmDelete) {
		const n = selected.size;
		out.push(red(`  Delete ${n} profile${n !== 1 ? "s" : ""}? [y/N] `));
	} else if (message) {
		out.push(`  ${message}`);
	} else {
		out.push(
			`${dim("  ")}${dim("↑↓")} navigate  ${dim("space")} select  ${cyan("d")} delete  ${cyan("u")} activate  ${cyan("q")} quit`,
		);
	}

	process.stdout.write(`${CLEAR}${out.join("\n")}\n`);
}

// ─── Key handling ─────────────────────────────────────────────────────────────

function handleKey(key: string, state: State, done: () => void): void {
	// Confirmation prompt
	if (state.confirmDelete) {
		if (key === "y" || key === "Y") {
			const names = [...state.selected]
				.map((i) => state.rows[i]?.name)
				.filter((n) => n !== undefined);
			for (const name of names) deleteProfile(name);
			const { rows, activeName } = loadRows();
			state.rows = rows;
			state.activeName = activeName;
			state.selected.clear();
			state.cursor = Math.min(state.cursor, Math.max(0, rows.length - 1));
			state.message = green(`✓ Deleted: ${names.join(", ")}`);
			state.confirmDelete = false;
		} else {
			state.confirmDelete = false;
			state.message = "";
		}
		render(state);
		return;
	}

	state.message = "";

	switch (key) {
		case "\x1b[A": // up arrow
			if (state.rows.length > 0)
				state.cursor = (state.cursor - 1 + state.rows.length) % state.rows.length;
			break;

		case "\x1b[B": // down arrow
			if (state.rows.length > 0) state.cursor = (state.cursor + 1) % state.rows.length;
			break;

		case " ": // toggle selection
			if (state.rows.length > 0) {
				if (state.selected.has(state.cursor)) state.selected.delete(state.cursor);
				else state.selected.add(state.cursor);
			}
			break;

		case "d":
		case "D": {
			// If nothing selected, select current row
			if (state.selected.size === 0 && state.rows.length > 0) {
				state.selected.add(state.cursor);
			}
			if (state.selected.size > 0) state.confirmDelete = true;
			break;
		}

		case "u":
		case "U":
		case "\r":
		case "\n": {
			const row = state.rows[state.cursor];
			if (row) {
				useProfile(row.name);
				state.activeName = row.name;
				state.message = green(`✓ Now using "${row.name}"`);
			}
			break;
		}

		case "q":
		case "Q":
		case "\x03": // Ctrl+C
		case "\x1b": // ESC
			done();
			return;
	}

	render(state);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runProfileManager(): Promise<void> {
	// Non-interactive fallback (piped / no TTY)
	if (!process.stdout.isTTY || !process.stdin.isTTY) {
		const profiles = listProfiles();
		const activeName = getActiveName();
		if (profiles.length === 0) {
			process.stdout.write("No profiles. Create one with: casen profile create <name> ...\n");
			return;
		}
		for (const p of profiles) {
			const active = p.name === activeName ? " (active)" : "";
			const date = p.createdAt ? `  ${p.createdAt.slice(0, 10)}` : "";
			process.stdout.write(`${p.name}${active}${date}\n`);
		}
		return;
	}

	process.stdout.write(ALT_ON + HIDE_CURSOR);

	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		process.stdout.write(ALT_OFF + SHOW_CURSOR);
		if (process.stdin.isTTY) process.stdin.setRawMode(false);
		process.stdin.pause();
	};

	process.on("exit", cleanup);

	const { rows, activeName } = loadRows();
	const state: State = {
		rows,
		activeName,
		cursor: 0,
		selected: new Set(),
		message: "",
		confirmDelete: false,
	};

	render(state);

	await new Promise<void>((resolve) => {
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (key: string) => handleKey(key, state, resolve));
	});

	cleanup();
	process.removeListener("exit", cleanup);
}

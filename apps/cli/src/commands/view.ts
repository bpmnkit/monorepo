import { spawn } from "node:child_process"
import { readFile, readdir, stat } from "node:fs/promises"
import { createServer } from "node:http"
import { basename, extname, join } from "node:path"
import { renderDmnAscii, renderFormAscii } from "@bpmnkit/ascii"
import { Bpmn, exportSvg } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

// ── Types ─────────────────────────────────────────────────────────────────────

type PanelType = "bpmn" | "dmn" | "form"

interface Panel {
	label: string
	type: PanelType
	content: string // SVG string for bpmn; ASCII text for dmn/form
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function openBrowser(url: string): void {
	const [cmd, args]: [string, string[]] =
		process.platform === "darwin"
			? ["open", [url]]
			: process.platform === "win32"
				? ["cmd", ["/c", "start", "", url]]
				: ["xdg-open", [url]]
	const child = spawn(cmd, args, { detached: true, stdio: "ignore" })
	// No opener installed (a bare container, say) is not an error: every caller
	// prints the URL as well.
	child.on("error", () => {})
	child.unref()
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

/** Expand paths: directories are scanned (top-level) for matching extensions. */
async function resolvePaths(paths: string[], extensions: string[]): Promise<string[]> {
	const result: string[] = []
	for (const p of paths) {
		const s = await stat(p).catch(() => null)
		if (!s) throw new Error(`Path not found: ${p}`)
		if (s.isDirectory()) {
			const entries = await readdir(p, { withFileTypes: true })
			const matched = entries
				.filter((e) => e.isFile() && extensions.includes(extname(e.name).toLowerCase()))
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((e) => join(p, e.name))
			if (matched.length === 0) {
				throw new Error(`No ${extensions.join("/")} files found in directory: ${p}`)
			}
			result.push(...matched)
		} else {
			result.push(p)
		}
	}
	return result
}

// ── Panel builders ────────────────────────────────────────────────────────────

async function buildBpmnPanel(file: string, theme: "light" | "dark"): Promise<Panel> {
	const xml = await readFile(file, "utf-8")
	const defs = Bpmn.parse(xml)
	return { label: basename(file), type: "bpmn", content: exportSvg(defs, { theme }) }
}

async function buildDmnPanel(file: string): Promise<Panel> {
	const xml = await readFile(file, "utf-8")
	return { label: basename(file), type: "dmn", content: renderDmnAscii(xml) }
}

async function buildFormPanel(file: string): Promise<Panel> {
	const json = await readFile(file, "utf-8")
	return { label: basename(file), type: "form", content: renderFormAscii(json) }
}

async function panelFromFile(file: string, theme: "light" | "dark"): Promise<Panel> {
	const ext = extname(file).toLowerCase()
	if (ext === ".bpmn") return buildBpmnPanel(file, theme)
	if (ext === ".dmn") return buildDmnPanel(file)
	if (ext === ".form") return buildFormPanel(file)
	throw new Error(`Unsupported file extension: ${file}. Use .bpmn, .dmn, or .form`)
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(panels: Panel[], theme: "light" | "dark"): string {
	const tabs = panels
		.map(
			(p, i) =>
				`<button class="tab${i === 0 ? " active" : ""}" data-idx="${i}" data-type="${p.type}">${escapeHtml(p.label)}</button>`,
		)
		.join("\n    ")

	const panelHtml = panels
		.map((p, i) => {
			const cls = `panel${i === 0 ? " active" : ""}`
			if (p.type === "bpmn") {
				return `<div class="${cls}" data-idx="${i}" data-type="bpmn">${p.content}</div>`
			}
			return `<div class="${cls}" data-idx="${i}" data-type="${p.type}"><pre>${escapeHtml(p.content)}</pre></div>`
		})
		.join("\n  ")

	return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BPMN Kit Viewer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
    :root {
      --bg: #f4f4f8; --surface: #ffffff; --border: #d0d0e8;
      --fg: #1a1a2e; --fg-muted: #6666a0; --accent: #1a56db;
      --mono: ui-monospace, "Cascadia Code", "JetBrains Mono", monospace;
    }
    [data-theme="dark"] {
      --bg: #0d0d16; --surface: #161626; --border: #2a2a42;
      --fg: #cdd6f4; --fg-muted: #8888a8; --accent: #6b9df7;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--fg);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 2px;
      overflow-x: auto;
      flex-shrink: 0;
      height: 44px;
    }
    .brand {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--fg-muted);
      margin-right: 12px;
      white-space: nowrap;
    }
    .tab {
      padding: 6px 14px;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--fg-muted);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      border-radius: 4px 4px 0 0;
      white-space: nowrap;
      transition: color 0.1s;
    }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 500; }
    .tab:hover:not(.active) { color: var(--fg); }
    .tab-type {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.6;
      margin-left: 5px;
      vertical-align: middle;
    }
    main {
      flex: 1;
      overflow: auto;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .panel { display: none; width: 100%; }
    .panel.active { display: block; }
    .panel[data-type="bpmn"] svg {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.1);
    }
    .panel[data-type="dmn"] pre,
    .panel[data-type="form"] pre {
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.5;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      overflow-x: auto;
      white-space: pre;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    footer {
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 6px 16px;
      font-size: 11px;
      color: var(--fg-muted);
      flex-shrink: 0;
    }
    kbd {
      background: var(--border);
      border-radius: 3px;
      padding: 1px 4px;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <header>
    <span class="brand">BPMN Kit</span>
    ${tabs}
  </header>
  <main>
  ${panelHtml}
  </main>
  <footer>
    Use <kbd>Ctrl+Scroll</kbd> or browser zoom to zoom &mdash;
    Press <kbd>Ctrl+C</kbd> in terminal to stop the server
  </footer>
  <script>
    const tabs = document.querySelectorAll('.tab')
    const panels = document.querySelectorAll('.panel')
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const idx = tab.dataset.idx
        tabs.forEach(t => t.classList.toggle('active', t.dataset.idx === idx))
        panels.forEach(p => p.classList.toggle('active', p.dataset.idx === idx))
      })
    })
  </script>
</body>
</html>`
}

// ── Server ────────────────────────────────────────────────────────────────────

async function serve(
	panels: Panel[],
	port: number,
	theme: "light" | "dark",
	noOpen: boolean,
	ctx: Parameters<Command["run"]>[0],
): Promise<void> {
	const html = buildHtml(panels, theme)
	const server = createServer((_req, res) => {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
		res.end(html)
	})
	await new Promise<void>((resolve, reject) => {
		server.listen(port, "127.0.0.1", () => resolve())
		server.on("error", reject)
	})
	const url = `http://localhost:${port}`
	ctx.output.info(`Serving ${panels.length} file${panels.length === 1 ? "" : "s"} at ${url}`)
	if (!noOpen) openBrowser(url)
	ctx.output.info("Press Ctrl+C to stop")
	await new Promise<void>((resolve) => {
		process.once("SIGINT", resolve)
		process.once("SIGTERM", resolve)
	})
	server.close()
}

// ── Shared flags ──────────────────────────────────────────────────────────────

const PORT_FLAG = {
	name: "port",
	description: "Port for the local server (default: 3044)",
	type: "number" as const,
	default: 3044,
}
const THEME_FLAG = {
	name: "theme",
	description: "Color theme: light (default) or dark",
	type: "string" as const,
	default: "light",
	enum: ["light", "dark"],
}
const NO_OPEN_FLAG = {
	name: "no-open",
	description: "Do not open the browser automatically",
	type: "boolean" as const,
}

// ── Commands ──────────────────────────────────────────────────────────────────

const viewBpmnCmd: Command = {
	name: "bpmn",
	description: "View BPMN files or a folder of .bpmn files in the browser",
	args: [
		{ name: "path", description: "File(s) or folder(s) containing .bpmn files", required: true },
	],
	flags: [PORT_FLAG, THEME_FLAG, NO_OPEN_FLAG],
	examples: [
		{ description: "View a single file", command: "casen view bpmn process.bpmn" },
		{ description: "View all files in a folder", command: "casen view bpmn ./processes/" },
		{ description: "View multiple files", command: "casen view bpmn order.bpmn payment.bpmn" },
		{
			description: "Dark theme on custom port",
			command: "casen view bpmn process.bpmn --theme dark --port 8080",
		},
	],
	async run(ctx) {
		if (ctx.positional.length === 0) throw new Error("Provide at least one file or folder path")
		const port = (ctx.flags.port as number | undefined) ?? 3044
		const theme: "light" | "dark" = ctx.flags.theme === "dark" ? "dark" : "light"
		const files = await resolvePaths(ctx.positional, [".bpmn"])
		const panels = await Promise.all(files.map((f) => buildBpmnPanel(f, theme)))
		await serve(panels, port, theme, ctx.flags["no-open"] === true, ctx)
	},
}

const viewDmnCmd: Command = {
	name: "dmn",
	description: "View DMN files or a folder of .dmn files in the browser",
	args: [
		{ name: "path", description: "File(s) or folder(s) containing .dmn files", required: true },
	],
	flags: [PORT_FLAG, THEME_FLAG, NO_OPEN_FLAG],
	examples: [
		{ description: "View a single DMN file", command: "casen view dmn decision.dmn" },
		{ description: "View all DMN files in a folder", command: "casen view dmn ./decisions/" },
	],
	async run(ctx) {
		if (ctx.positional.length === 0) throw new Error("Provide at least one file or folder path")
		const port = (ctx.flags.port as number | undefined) ?? 3044
		const theme: "light" | "dark" = ctx.flags.theme === "dark" ? "dark" : "light"
		const files = await resolvePaths(ctx.positional, [".dmn"])
		const panels = await Promise.all(files.map((f) => buildDmnPanel(f)))
		await serve(panels, port, theme, ctx.flags["no-open"] === true, ctx)
	},
}

const viewFormCmd: Command = {
	name: "form",
	description: "View Camunda form files or a folder of .form files in the browser",
	args: [
		{ name: "path", description: "File(s) or folder(s) containing .form files", required: true },
	],
	flags: [PORT_FLAG, THEME_FLAG, NO_OPEN_FLAG],
	examples: [
		{ description: "View a single form file", command: "casen view form my-form.form" },
		{ description: "View all forms in a folder", command: "casen view form ./forms/" },
	],
	async run(ctx) {
		if (ctx.positional.length === 0) throw new Error("Provide at least one file or folder path")
		const port = (ctx.flags.port as number | undefined) ?? 3044
		const theme: "light" | "dark" = ctx.flags.theme === "dark" ? "dark" : "light"
		const files = await resolvePaths(ctx.positional, [".form"])
		const panels = await Promise.all(files.map((f) => buildFormPanel(f)))
		await serve(panels, port, theme, ctx.flags["no-open"] === true, ctx)
	},
}

const viewOpenCmd: Command = {
	name: "open",
	description: "View any mix of .bpmn, .dmn, and .form files or folders in the browser",
	args: [
		{
			name: "path",
			description: "File(s) or folder(s) — .bpmn, .dmn, and .form auto-detected",
			required: true,
		},
	],
	flags: [PORT_FLAG, THEME_FLAG, NO_OPEN_FLAG],
	examples: [
		{
			description: "Open any supported file",
			command: "casen view open process.bpmn decision.dmn",
		},
		{ description: "Open a folder (all supported types)", command: "casen view open ./project/" },
		{
			description: "Mix files and folders",
			command: "casen view open ./processes/ extra.dmn review.form",
		},
	],
	async run(ctx) {
		if (ctx.positional.length === 0) throw new Error("Provide at least one file or folder path")
		const port = (ctx.flags.port as number | undefined) ?? 3044
		const theme: "light" | "dark" = ctx.flags.theme === "dark" ? "dark" : "light"
		const files = await resolvePaths(ctx.positional, [".bpmn", ".dmn", ".form"])
		const panels = await Promise.all(files.map((f) => panelFromFile(f, theme)))
		await serve(panels, port, theme, ctx.flags["no-open"] === true, ctx)
	},
}

// ── Group ─────────────────────────────────────────────────────────────────────

export const viewGroup: CommandGroup = {
	name: "view",
	description: "View BPMN, DMN, and form files in the browser via a local server",
	commands: [viewOpenCmd, viewBpmnCmd, viewDmnCmd, viewFormCmd],
}

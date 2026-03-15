#!/usr/bin/env node
// Usage: node scripts/generate-readmes.mjs
// Generates README.md for all published packages from a single source of truth.

import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const LOGO_URL =
	"https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg"
const GITHUB = "https://github.com/bpmnkit/monorepo"
const DOCS = "https://bpmn-sdk-docs.pages.dev"

// ── Shared header / footer ────────────────────────────────────────────────────

function header({ name, description, extra = "" }) {
	const pkg = name.replace("@bpmnkit/", "")
	return `<div align="center">
  <img src="${LOGO_URL}" width="72" height="72" alt="BPMN SDK logo">
  <h1>${name}</h1>
  <p>${description}</p>

  [![npm](https://img.shields.io/npm/v/${name}?style=flat-square&color=6244d7)](https://www.npmjs.com/package/${name})
  [![license](https://img.shields.io/npm/l/${name}?style=flat-square)](${GITHUB}/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](${GITHUB})

  [Documentation](${DOCS}) · [GitHub](${GITHUB}) · [Changelog](${GITHUB}/blob/main/packages/${pkg}/CHANGELOG.md)
</div>

---
${extra}`
}

function footer(currentPkg) {
	const packages = [
		{ name: "@bpmnkit/core", desc: "BPMN/DMN/Form parser, builder, layout engine" },
		{ name: "@bpmnkit/canvas", desc: "Zero-dependency SVG BPMN viewer" },
		{ name: "@bpmnkit/editor", desc: "Full-featured interactive BPMN editor" },
		{ name: "@bpmnkit/engine", desc: "Lightweight BPMN process execution engine" },
		{ name: "@bpmnkit/feel", desc: "FEEL expression language parser & evaluator" },
		{ name: "@bpmnkit/plugins", desc: "22 composable canvas plugins" },
		{ name: "@bpmnkit/api", desc: "Camunda 8 REST API TypeScript client" },
		{ name: "@bpmnkit/ascii", desc: "Render BPMN diagrams as Unicode ASCII art" },
		{
			name: "@bpmnkit/profiles",
			desc: "Shared auth, profile storage, and client factories for CLI & proxy",
		},
		{ name: "@bpmnkit/operate", desc: "Monitoring & operations frontend for Camunda clusters" },
	].filter((p) => p.name !== currentPkg)

	const rows = packages
		.map((p) => `| [\`${p.name}\`](https://www.npmjs.com/package/${p.name}) | ${p.desc} |`)
		.join("\n")

	return `---

## Related Packages

| Package | Description |
|---------|-------------|
${rows}

## License

[MIT](${GITHUB}/blob/main/LICENSE) © bpmn-sdk
`
}

// ── Package READMEs ──────────────────────────────────────────────────────────

const packages = {
	// ── core ──────────────────────────────────────────────────────────────────
	"packages/core": {
		name: "@bpmnkit/core",
		description: "TypeScript-first BPMN 2.0 SDK — parse, build, layout, and optimize diagrams",
		content: `## Overview

\`@bpmnkit/core\` is the foundation of the BPMN SDK. It gives you everything to work with BPMN 2.0, DMN 1.3, and Camunda Form definitions in pure TypeScript — no XML wrestling, no runtime dependencies.

\`\`\`
Parse → Modify → Validate → Export
\`\`\`

## Features

- **BPMN 2.0** — parse, create, and export process diagrams with full Zeebe/Camunda 8 extension support
- **Fluent Builder API** — construct valid processes programmatically, never touch raw XML
- **Sugiyama Layout Engine** — auto-position elements with clean orthogonal edge routing
- **DMN 1.3** — decision tables, including FEEL expression support
- **Camunda Form Definitions** — type-safe form schema builder
- **Optimizer** — built-in rule engine to detect and auto-fix anti-patterns
- **Compact Format** — 70% smaller token-efficient JSON representation for AI/LLM workflows
- **Zero Dependencies** — runs in browsers, Node.js, Deno, Bun, and edge runtimes

## Installation

\`\`\`sh
npm install @bpmnkit/core
pnpm add @bpmnkit/core
\`\`\`

## Quick Start

### Build a process from code

\`\`\`typescript
import { Bpmn } from "@bpmnkit/core"

const process = Bpmn.createProcess("order-flow", "Order Flow")
  .startEvent("start", "Order Received")
  .serviceTask("validate", "Validate Order", {
    type: "order-validator",
    inputs: [{ source: "=order", target: "order" }],
    outputs: [{ source: "=valid", target: "isValid" }],
  })
  .exclusiveGateway("check", "Order Valid?")
  .sequenceFlow("check", "fulfill", "=isValid = true")
  .serviceTask("fulfill", "Fulfill Order", { type: "fulfillment-service" })
  .endEvent("end", "Order Complete")
  .sequenceFlow("check", "reject", "=isValid = false")
  .endEvent("reject-end", "Order Rejected")
  .build()

const xml = Bpmn.export(process)
\`\`\`

### Parse and modify existing BPMN

\`\`\`typescript
import { Bpmn } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const process = defs.processes[0]

// Access flow elements
for (const el of process.flowElements) {
  console.log(el.type, el.id, el.name)
}

// Serialize back to XML
const updated = Bpmn.export(defs)
\`\`\`

### Auto-layout a process

\`\`\`typescript
import { Bpmn, layoutProcess } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const result = layoutProcess(defs.processes[0])
// result.defs now has updated DI coordinates
const laid = Bpmn.export(result.defs)
\`\`\`

### Optimize a diagram

\`\`\`typescript
import { Bpmn, optimize } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const report = optimize(defs)

console.log(\`\${report.summary.total} findings\`)

for (const finding of report.findings) {
  console.log(\`[\${finding.severity}] \${finding.message}\`)
  if (finding.applyFix) {
    const { description } = finding.applyFix(defs)
    console.log("Fixed:", description)
  }
}
\`\`\`

### Compact format for AI/LLM workflows

\`\`\`typescript
import { Bpmn, compactify, expand } from "@bpmnkit/core"

// Shrink for AI prompt
const defs = Bpmn.parse(xml)
const compact = compactify(defs)          // ~70% smaller JSON
const json = JSON.stringify(compact)      // send to LLM

// Restore full BPMN from AI response
const restored = expand(JSON.parse(json))
const outXml = Bpmn.export(restored)
\`\`\`

## API Reference

### BPMN

| Export | Description |
|--------|-------------|
| \`Bpmn.parse(xml)\` | Parse BPMN XML → \`BpmnDefinitions\` |
| \`Bpmn.export(defs)\` | Serialize \`BpmnDefinitions\` → XML |
| \`Bpmn.createProcess(id, name?)\` | Start a \`ProcessBuilder\` |
| \`Bpmn.makeEmpty(processId?, name?)\` | Minimal BPMN XML with one start event |
| \`Bpmn.SAMPLE_XML\` | 3-node sample diagram string |

### DMN

| Export | Description |
|--------|-------------|
| \`Dmn.parse(xml)\` | Parse DMN XML → \`DmnDefinitions\` |
| \`Dmn.export(defs)\` | Serialize → XML |
| \`Dmn.createDecisionTable(id, name?)\` | Start a \`DecisionTableBuilder\` |
| \`Dmn.makeEmpty()\` | Minimal DMN with one empty decision table |

### Form

| Export | Description |
|--------|-------------|
| \`Form.create()\` | Start a \`FormBuilder\` |
| \`Form.parse(json)\` | Parse a form schema |
| \`Form.export(schema)\` | Serialize → JSON string |

### Layout & Optimization

| Export | Description |
|--------|-------------|
| \`layoutProcess(process)\` | Auto-layout all elements; returns \`LayoutResult\` |
| \`optimize(defs)\` | Run all optimization rules; returns \`OptimizeReport\` |
| \`compactify(defs)\` | Convert to compact \`CompactDiagram\` |
| \`expand(compact)\` | Restore full \`BpmnDefinitions\` |
| \`generateId(prefix)\` | Generate a unique short ID |
`,
	},

	// ── canvas ────────────────────────────────────────────────────────────────
	"packages/canvas": {
		name: "@bpmnkit/canvas",
		description: "Zero-dependency SVG BPMN viewer with pan/zoom, theming, and a plugin API",
		content: `## Overview

\`@bpmnkit/canvas\` renders BPMN 2.0 diagrams as interactive SVG. It has zero runtime dependencies, works in any framework (or none), and exposes a plugin API for extending its behaviour.

## Features

- **SVG rendering** — crisp diagrams at any zoom level, all element types
- **Pan & zoom** — mouse drag, scroll wheel, touch/pinch, keyboard shortcuts
- **Theming** — light / dark / system-auto, fully overridable via CSS custom properties
- **Plugin API** — install composable \`CanvasPlugin\` add-ons without touching core code
- **Event system** — subscribe to element clicks, selection changes, diagram load, viewport updates
- **Keyboard navigation** — arrow keys, fit-to-screen, zoom shortcuts
- **Zero dependencies** — runs in browsers, bundlers, and SSR

## Installation

\`\`\`sh
npm install @bpmnkit/canvas
\`\`\`

## Quick Start

\`\`\`typescript
import { BpmnCanvas } from "@bpmnkit/canvas"

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas")!,
  theme: "dark",          // "light" | "dark" | "auto"
  grid: true,             // dot-grid background
  plugins: [],            // CanvasPlugin[]
})

// Load a diagram
canvas.loadXML(bpmnXml)

// Respond to element clicks
canvas.on("element:click", (id, event) => {
  console.log("Clicked:", id)
})

// Fit diagram to container
canvas.fit()
\`\`\`

## API Reference

### Constructor Options

\`\`\`typescript
interface CanvasOptions {
  container: HTMLElement
  theme?: "light" | "dark" | "auto"   // default: "auto"
  grid?: boolean                       // default: false
  fit?: boolean                        // auto-fit on load, default: true
  plugins?: CanvasPlugin[]
}
\`\`\`

### CanvasApi Methods

| Method | Description |
|--------|-------------|
| \`loadXML(xml)\` | Parse and render a BPMN XML string |
| \`fit()\` | Fit the diagram to the container |
| \`zoom(factor)\` | Set zoom level (1 = 100%) |
| \`getShapes()\` | All rendered \`RenderedShape\` objects |
| \`getEdges()\` | All rendered \`RenderedEdge\` objects |
| \`setTheme(theme)\` | Switch theme at runtime |
| \`destroy()\` | Remove canvas and clean up |
| \`on(event, handler)\` | Subscribe to a canvas event |
| \`off(event, handler)\` | Unsubscribe |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| \`diagram:load\` | \`BpmnDefinitions\` | Fired when a new diagram loads |
| \`element:click\` | \`(id, PointerEvent)\` | An element was clicked |
| \`editor:select\` | \`string[]\` | Selection changed (element IDs) |
| \`viewport:change\` | \`ViewportState\` | Pan or zoom occurred |

### Plugin API

\`\`\`typescript
import type { CanvasPlugin, CanvasApi } from "@bpmnkit/canvas"

const myPlugin: CanvasPlugin = {
  name: "my-plugin",
  install(api: CanvasApi) {
    api.on("element:click", (id) => console.log("clicked", id))
  },
  uninstall() {},
}
\`\`\`
`,
	},

	// ── editor ────────────────────────────────────────────────────────────────
	"packages/editor": {
		name: "@bpmnkit/editor",
		description: "Full-featured interactive BPMN editor with undo/redo, HUD, and side-dock UI",
		content: `## Overview

\`@bpmnkit/editor\` turns the \`@bpmnkit/canvas\` viewer into a fully interactive editor. Drag to connect elements, inline-edit labels, resize shapes, attach boundary events, and integrate AI-assisted design — all through a composable API.

## Features

- **40+ element types** — all BPMN 2.0 tasks, events, gateways, sub-processes
- **Drag-to-connect** — draw sequence flows with automatic waypoint routing
- **Resize & move** — multi-select, group move, constrained resize
- **Label editing** — inline text editor with multi-line support
- **Undo/redo** — full command history with keyboard shortcuts
- **Copy/paste** — multi-element clipboard with offset paste
- **Boundary events** — attach and detach boundary events interactively
- **HUD toolbar** — customisable palette with shape categories
- **Side dock** — resizable right sidebar with Properties, AI chat, and Docs tabs
- **Theme persistence** — auto read/write \`localStorage\` with \`persistTheme\`

## Installation

\`\`\`sh
npm install @bpmnkit/editor @bpmnkit/canvas
\`\`\`

## Quick Start

\`\`\`typescript
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmnkit/editor"

// Full editor (viewer + editing interactions)
const editor = new BpmnEditor({
  container: document.getElementById("editor")!,
  theme: "dark",
  persistTheme: true,
  plugins: [],
})

// Toolbar HUD (palette, zoom controls, etc.)
initEditorHud(editor, {
  container: document.getElementById("hud")!,
})

// Sidebar with Properties + AI tabs
const dock = createSideDock(document.body)
editor.loadXML(bpmnXml)
\`\`\`

## API Reference

### \`BpmnEditor\`

Extends \`BpmnCanvas\`. Adds all editing interactions.

\`\`\`typescript
interface EditorOptions extends CanvasOptions {
  persistTheme?: boolean  // auto-save theme to localStorage
}
\`\`\`

### \`initEditorHud(editor, options)\`

Mounts the toolbar HUD into a container.

\`\`\`typescript
interface HudOptions {
  container: HTMLElement
  optimizeButton?: HTMLElement  // inject into action bar
  aiButton?: HTMLElement        // inject into action bar
}
\`\`\`

### \`createSideDock(container)\` → \`SideDock\`

Creates the right-side collapsible dock.

\`\`\`typescript
interface SideDock {
  el: HTMLElement
  propertiesPane: HTMLDivElement
  aiPane: HTMLDivElement
  docsPane: HTMLDivElement
  switchTab(tab: "properties" | "ai" | "docs" | "history" | "play"): void
  expand(): void
  collapse(): void
  collapsed: boolean
  setDiagramInfo(processName: string, fileName: string): void
}
\`\`\`
`,
	},

	// ── engine ────────────────────────────────────────────────────────────────
	"packages/engine": {
		name: "@bpmnkit/engine",
		description:
			"Lightweight BPMN 2.0 process execution engine for browsers and Node.js — zero dependencies",
		content: `## Overview

\`@bpmnkit/engine\` simulates BPMN 2.0 process execution. Deploy a diagram, start instances, track active elements, evaluate DMN decisions, and step through execution — all without a Camunda cluster.

Perfect for: workflow testing, visual debugging, interactive demos, offline simulation, and process-driven UI flows.

## Features

- **Full control flow** — exclusive, parallel, inclusive, event-based, complex gateways
- **Variable scopes** — hierarchical scope chain; FEEL expression evaluation for conditions/mappings
- **All event types** — message, signal, timer (ISO 8601 duration/date/cycle), error, escalation, compensation
- **Boundary events** — interrupting and non-interrupting error, timer, compensation
- **Sub-processes** — embedded, call activity (process invocation by ID)
- **DMN decisions** — inline decision table evaluation via \`@bpmnkit/feel\`
- **Job workers** — register handlers for service tasks by job type
- **Step-by-step** — \`beforeComplete\` hook pauses between elements for debugging UIs
- **Zero dependencies** — browser + Node.js, no server required

## Installation

\`\`\`sh
npm install @bpmnkit/engine
\`\`\`

## Quick Start

\`\`\`typescript
import { Engine } from "@bpmnkit/engine"

const engine = new Engine()

// Deploy a BPMN process
engine.deploy({ bpmn: xml })

// Register job workers
engine.registerJobWorker("payment-service", async (job) => {
  const result = await processPayment(job.variables)
  return { success: result.ok }
})

// Start an instance
const instance = engine.start("order-process", {
  orderId: "ORD-001",
  amount: 99.99,
})

// Track execution
instance.onChange((state) => {
  console.log("Active:", state.activeElements)
  console.log("Vars:", state.variables_snapshot)
})

// Wait for completion
await new Promise((resolve) => {
  instance.onChange((state) => {
    if (state.state === "completed" || state.state === "terminated") resolve(undefined)
  })
})
\`\`\`

## Step-by-step execution

\`\`\`typescript
const steps: Array<() => void> = []

const instance = engine.start("my-process", {}, {
  beforeComplete: (elementId) =>
    new Promise((resolve) => {
      console.log("Paused at:", elementId)
      steps.push(resolve)  // advance by calling steps.pop()()
    }),
})
\`\`\`

## API Reference

### \`Engine\`

| Method | Description |
|--------|-------------|
| \`deploy({ bpmn, forms?, decisions? })\` | Register BPMN (+ optional DMN/form assets) |
| \`start(processId, variables?, options?)\` | Start a new instance; returns \`ProcessInstance\` |
| \`registerJobWorker(type, handler)\` | Handle service tasks with a given job type |
| \`getDeployedProcesses()\` | List all deployed process IDs |

### \`ProcessInstance\`

| Member | Description |
|--------|-------------|
| \`state\` | \`"running" \\| "completed" \\| "terminated" \\| "failed"\` |
| \`activeElements\` | IDs of currently active flow nodes |
| \`variables_snapshot\` | Flat snapshot of current variable scope |
| \`onChange(cb)\` | Subscribe to state changes |
| \`cancel()\` | Terminate the instance |
| \`deliverMessage(name, variables?)\` | Correlate a message catch event |
| \`beforeComplete?\` | Optional step hook (set after \`start()\`) |
`,
	},

	// ── feel ──────────────────────────────────────────────────────────────────
	"packages/feel": {
		name: "@bpmnkit/feel",
		description:
			"Complete FEEL (Friendly Enough Expression Language) implementation — parser, evaluator, and highlighter",
		content: `## Overview

\`@bpmnkit/feel\` is a complete implementation of the FEEL expression language used in DMN decision tables and BPMN condition expressions. It includes a tokenizer, recursive-descent parser, AST evaluator, formatter, and syntax highlighter.

## Features

- **Full FEEL grammar** — arithmetic, comparisons, logic, function calls, paths, filters
- **Temporal types** — date, time, datetime, duration (ISO 8601, full spec compliance)
- **Unary tests** — DMN input expression syntax (\`> 5\`, \`"gold", "silver"\`, \`[1..10]\`)
- **Built-in functions** — 50+ standard FEEL functions (string, list, numeric, date, context)
- **Range expressions** — \`[1..10]\`, \`(0..1)\`, \`[today..end]\`
- **Context literals** — \`{ key: value, nested: { x: 1 } }\`
- **Syntax highlighting** — semantic token classification for editors
- **Zero dependencies**

## Installation

\`\`\`sh
npm install @bpmnkit/feel
\`\`\`

## Quick Start

### Evaluate an expression

\`\`\`typescript
import { parseExpression, evaluate } from "@bpmnkit/feel"

const parsed = parseExpression("amount * 1.2 + fee")
if (!parsed.errors.length) {
  const result = evaluate(parsed.ast!, { amount: 100, fee: 5 })
  console.log(result) // 125
}
\`\`\`

### Evaluate unary tests (DMN input expressions)

\`\`\`typescript
import { parseUnaryTests, evaluateUnaryTests } from "@bpmnkit/feel"

// Does input value match any listed condition?
const parsed = parseUnaryTests('"gold","silver"')
const matches = evaluateUnaryTests(parsed.ast!, "gold", { /* context */ })
console.log(matches) // true
\`\`\`

### Syntax highlighting

\`\`\`typescript
import { highlightFeel } from "@bpmnkit/feel"

const tokens = highlightFeel('if x > 10 then "high" else "low"')
for (const token of tokens) {
  console.log(token.type, token.value) // keyword, number, string, ...
}
\`\`\`

## API Reference

| Export | Description |
|--------|-------------|
| \`parseExpression(src)\` | Parse a FEEL expression → \`ParseResult\` |
| \`parseUnaryTests(src)\` | Parse unary tests → \`ParseResult\` |
| \`evaluate(ast, ctx)\` | Evaluate a parsed expression |
| \`evaluateUnaryTests(ast, input, ctx)\` | Test input against unary tests |
| \`formatFeel(src)\` | Pretty-print a FEEL expression |
| \`highlightFeel(src)\` | Tokenize with semantic types for highlighting |
| \`tokenize(src)\` | Raw token stream |
| \`annotate(src)\` | Full AST with position metadata |

### ParseResult

\`\`\`typescript
interface ParseResult {
  ast: FeelNode | null
  errors: ParseError[]   // { message, position }
}
\`\`\`
`,
	},

	// ── plugins ───────────────────────────────────────────────────────────────
	"packages/plugins": {
		name: "@bpmnkit/plugins",
		description:
			"22 composable canvas plugins — minimap, AI chat, process simulation, storage, and more",
		content: `## Overview

\`@bpmnkit/plugins\` is a single package containing 22 ready-made \`CanvasPlugin\` add-ons for \`@bpmnkit/canvas\` and \`@bpmnkit/editor\`. Each plugin is imported individually via subpath exports so you only bundle what you use.

## Installation

\`\`\`sh
npm install @bpmnkit/plugins
\`\`\`

## Plugins

### Visualization

| Subpath | Factory | Description |
|---------|---------|-------------|
| \`/minimap\` | \`createMinimapPlugin()\` | Thumbnail navigation minimap |
| \`/watermark\` | \`createWatermarkPlugin(text)\` | Corner watermark overlay |
| \`/ascii-view\` | \`createAsciiViewPlugin()\` | Toggle ASCII art rendering |
| \`/zoom-controls\` | \`createZoomControlsPlugin()\` | On-canvas +/− zoom buttons |

### File Management

| Subpath | Factory | Description |
|---------|---------|-------------|
| \`/tabs\` | \`createTabsPlugin(options)\` | Multi-file tab bar with welcome screen |
| \`/storage\` | \`createStoragePlugin(options)\` | IndexedDB workspaces/projects/files with auto-save |
| \`/storage-tabs-bridge\` | \`createStorageTabsBridge(options)\` | Wire tabs + storage + main menu together |

### Editing

| Subpath | Factory | Description |
|---------|---------|-------------|
| \`/command-palette\` | \`createCommandPalettePlugin()\` | ⌘K command palette |
| \`/command-palette-editor\` | \`createCommandPaletteEditorPlugin()\` | Editor-specific commands |
| \`/history\` | \`createHistoryPlugin()\` | Visual undo/redo history panel |
| \`/config-panel\` | \`createConfigPanelPlugin(options)\` | Properties panel for selected elements |
| \`/config-panel-bpmn\` | \`createConfigPanelBpmnPlugin(options)\` | BPMN-specific properties panel |

### DMN & Forms

| Subpath | Factory | Description |
|---------|---------|-------------|
| \`/dmn-editor\` | — | Embedded DMN decision table editor |
| \`/dmn-viewer\` | — | Read-only DMN viewer |
| \`/form-editor\` | — | Camunda Form schema editor |
| \`/form-viewer\` | — | Read-only form renderer |
| \`/feel-playground\` | — | Interactive FEEL expression tester |

### Process Simulation

| Subpath | Factory | Description |
|---------|---------|-------------|
| \`/process-runner\` | \`createProcessRunnerPlugin(options)\` | Run BPMN instances with play/step/stop UI |
| \`/token-highlight\` | \`createTokenHighlightPlugin()\` | Highlight active/visited elements during execution |
| \`/optimize\` | \`createOptimizePlugin()\` | Show optimizer findings overlay |

### AI & Navigation

| Subpath | Factory | Description |
|---------|---------|-------------|
| \`/ai-bridge\` | \`createAiBridgePlugin(options)\` | AI chat panel with diagram apply/checkpoint |
| \`/element-docs\` | \`createElementDocsPlugin(options)\` | Built-in BPMN element reference docs |
| \`/main-menu\` | \`createMainMenuPlugin(options)\` | File/Edit top-level menu |

## Usage Examples

### Minimap

\`\`\`typescript
import { BpmnCanvas } from "@bpmnkit/canvas"
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap"

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas")!,
  plugins: [createMinimapPlugin()],
})
\`\`\`

### Storage + Tabs

\`\`\`typescript
import { createStoragePlugin } from "@bpmnkit/plugins/storage"
import { createTabsPlugin } from "@bpmnkit/plugins/tabs"
import { createStorageTabsBridge } from "@bpmnkit/plugins/storage-tabs-bridge"

const storage = createStoragePlugin({ editor })
const tabs = createTabsPlugin({ editor })
const bridge = createStorageTabsBridge({ storage, tabs, mainMenu })
\`\`\`

### Process Simulation

\`\`\`typescript
import { Engine } from "@bpmnkit/engine"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"

const engine = new Engine()
const tokenHighlight = createTokenHighlightPlugin()
const processRunner = createProcessRunnerPlugin({ engine, tokenHighlight })

const canvas = new BpmnCanvas({
  container,
  plugins: [tokenHighlight, processRunner],
})
\`\`\`

### AI Chat Panel

\`\`\`typescript
import { createAiBridgePlugin } from "@bpmnkit/plugins/ai-bridge"

const ai = createAiBridgePlugin({
  serverUrl: "http://localhost:3033",
  container: dock.aiPane,
  onOpen: () => dock.expand(),
})
\`\`\`
`,
	},

	// ── api ───────────────────────────────────────────────────────────────────
	"packages/api": {
		name: "@bpmnkit/api",
		description:
			"TypeScript client for the Camunda 8 REST API — 180 typed operations, OAuth2, retries, and caching",
		content: `## Overview

\`@bpmnkit/api\` is a fully typed TypeScript SDK for the [Camunda 8 Orchestration Cluster REST API v2](https://docs.camunda.io/docs/apis-tools/camunda-api-rest/camunda-api-rest-overview/). Every endpoint, request body, and response shape is typed end-to-end.

## Features

- **180 typed operations** across 30+ resource namespaces
- **502 TypeScript types** generated from the official OpenAPI spec
- **Authentication** — Bearer token, OAuth2 (auto-refresh), HTTP Basic
- **Retries** — configurable exponential backoff with jitter
- **Caching** — in-memory LRU + TTL cache for read operations
- **Events** — subscribe to request, response, error, retry, and cache events
- **Structured logging** — pluggable logger with configurable levels
- **Config resolution** — constructor → YAML file → environment variables
- **Token persistence** — disk cache for OAuth2 access tokens
- **Zero runtime dependencies**

## Installation

\`\`\`sh
npm install @bpmnkit/api
\`\`\`

## Quick Start

\`\`\`typescript
import { CamundaClient } from "@bpmnkit/api"

const client = new CamundaClient({
  baseUrl: "https://cluster.camunda.io",
  auth: {
    type: "oauth2",
    clientId: process.env.CAMUNDA_CLIENT_ID!,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET!,
    tokenUrl: "https://login.cloud.camunda.io/oauth/token",
    audience: "zeebe.camunda.io",
  },
})

// Deploy a process
await client.deployment.create({
  resources: [{ name: "order.bpmn", content: bpmnXml }],
})

// Start a process instance
const instance = await client.processInstance.create({
  processDefinitionId: "order-process",
  variables: { orderId: "ORD-001", amount: 99.99 },
})

// Complete a user task
const tasks = await client.userTask.search({
  filter: { processInstanceKey: instance.processInstanceKey },
})
await client.userTask.complete(tasks.items[0].userTaskKey, {
  variables: { approved: true },
})
\`\`\`

## Authentication

\`\`\`typescript
// OAuth2 (recommended for Camunda Cloud)
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "oauth2", clientId: "...", clientSecret: "...", tokenUrl: "...", audience: "..." },
})

// Bearer token (static)
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "bearer", token: "..." },
})

// HTTP Basic
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "basic", username: "...", password: "..." },
})
\`\`\`

## Resource Namespaces

| Namespace | Description |
|-----------|-------------|
| \`client.processInstance\` | CRUD + cancel + variables |
| \`client.processDefinition\` | Definitions, XML, start forms |
| \`client.deployment\` | Create, list, delete deployments |
| \`client.job\` | Activate, complete, fail, update |
| \`client.userTask\` | Search, complete, assign, update |
| \`client.decisionDefinition\` | List, XML, evaluate |
| \`client.decisionInstance\` | Search, get |
| \`client.message\` | Publish, correlate |
| \`client.signal\` | Broadcast |
| \`client.incident\` | Search, resolve |
| \`client.variable\` | Search, get |
| \`client.flowNodeInstance\` | Search, get |
| \`client.user\` | Search, create, update |
| \`client.role\` | Search, create, assign |
| \`client.group\` | Search, create, assign |
| \`client.authorization\` | Manage permissions |
| \`client.tenant\` | Multi-tenant management |
| \`client.clock\` | Time manipulation (testing) |

## Error Handling

\`\`\`typescript
import { CamundaNotFoundError, CamundaRateLimitError } from "@bpmnkit/api"

try {
  await client.processInstance.get(key)
} catch (err) {
  if (err instanceof CamundaNotFoundError) console.log("Not found")
  if (err instanceof CamundaRateLimitError) console.log("Rate limited")
}
\`\`\`
`,
	},

	// ── ascii ─────────────────────────────────────────────────────────────────
	"packages/ascii": {
		name: "@bpmnkit/ascii",
		description:
			"Render BPMN diagrams as Unicode box-drawing ASCII art — perfect for terminals and docs",
		content: `## Overview

\`@bpmnkit/ascii\` converts BPMN 2.0 diagrams into Unicode box-drawing text art. It uses the same Sugiyama layout engine as the visual renderer, so the spatial flow of the diagram is preserved.

Useful for: CLI output, plain-text documentation, terminal UIs, test snapshots, and LLM prompts where visual BPMN isn't available.

## Features

- **Unicode box-drawing** — \`┌─┐\`, \`│\`, \`└─┘\`, \`→\` for clean terminal output
- **Automatic layout** — uses \`@bpmnkit/core\`'s layout engine
- **All element types** — tasks, events, gateways, sub-processes
- **Configurable output** — optional title, element type labels
- **Zero additional dependencies** — only requires \`@bpmnkit/core\` (already bundled)

## Installation

\`\`\`sh
npm install @bpmnkit/ascii
\`\`\`

## Quick Start

\`\`\`typescript
import { renderBpmnAscii } from "@bpmnkit/ascii"
import { readFileSync } from "node:fs"

const xml = readFileSync("my-process.bpmn", "utf8")
const art = renderBpmnAscii(xml, { title: true, showTypes: true })
console.log(art)
\`\`\`

### Example output

\`\`\`
Order Flow
══════════════════════════════════════════════
  ╭──────────╮     ╭───────────────╮     ╭╮
  │  Order   │────▶│ Validate Order│────▶││
  │ Received │     │ (ServiceTask) │     │◇│
  ╰──────────╯     ╰───────────────╯     ╰╯
                                          │
                         ╭───────────────╯│╰───────────────╮
                         ▼                                  ▼
                   ╭───────────╮                    ╭──────────────╮
                   │  Fulfill  │                    │    Reject    │
                   │   Order   │                    │    Order     │
                   ╰───────────╯                    ╰──────────────╯
\`\`\`

## API Reference

\`\`\`typescript
function renderBpmnAscii(xml: string, options?: RenderOptions): string

interface RenderOptions {
  title?: boolean     // Show process name as header. Default: false
  showTypes?: boolean // Include element type in boxes. Default: false
}
\`\`\`
`,
	},

	// ── profiles ──────────────────────────────────────────────────────────────
	"packages/profiles": {
		name: "@bpmnkit/profiles",
		description:
			"Shared auth, profile storage, and client factories for the BPMN SDK CLI and proxy server",
		content: `## Overview

\`@bpmnkit/profiles\` is the shared layer that connects the \`casen\` CLI with the local proxy server. It handles profile CRUD (read/write to \`~/.config/casen/config.json\`), creates typed \`CamundaClient\` instances from stored profiles, and resolves Authorization headers for any supported auth type.

You do not need this package if you are connecting directly to Camunda using \`@bpmnkit/api\`. It is intended for tooling that needs to share authentication state with the CLI.

## Features

- **Profile CRUD** — list, get, save, delete, and activate named profiles stored in \`~/.config/casen/config.json\`
- **Client factory** — \`createClientFromProfile(name?)\` creates a ready-to-use \`CamundaClient\` from the active or named profile
- **Auth header resolution** — \`getAuthHeader(config)\` returns the correct \`Authorization\` header string for Bearer, Basic, and OAuth2 auth types
- **OAuth2 token caching** — tokens are cached in memory and refreshed 60 seconds before expiry; no extra files written
- **XDG-aware** — profile file path resolves to the correct platform directory (Linux XDG, macOS, Windows AppData)
- **Zero UI dependencies** — no TUI or CLI dependencies; plain Node.js

## Installation

\`\`\`sh
npm install @bpmnkit/profiles
\`\`\`

## Quick Start

### Create a \`CamundaClient\` from the active profile

\`\`\`typescript
import { createClientFromProfile } from "@bpmnkit/profiles"

// Uses the currently active profile from ~/.config/casen/config.json
const client = createClientFromProfile()

const instances = await client.processInstance.searchProcessInstances({})
console.log(instances.page.totalItems)
\`\`\`

### Use a named profile

\`\`\`typescript
const client = createClientFromProfile("production")
\`\`\`

### Resolve an auth header directly

\`\`\`typescript
import { getActiveProfile, getAuthHeader } from "@bpmnkit/profiles"

const profile = getActiveProfile()
if (profile) {
  const header = await getAuthHeader(profile.config)
  // "Bearer eyJ..." or "Basic dXNlcjpwYXNz" or ""
}
\`\`\`

### Manage profiles programmatically

\`\`\`typescript
import { listProfiles, saveProfile, useProfile, deleteProfile } from "@bpmnkit/profiles"

// List all profiles
const profiles = listProfiles()

// Save a new profile
saveProfile({
  name: "local",
  apiType: "self-managed",
  config: {
    baseUrl: "http://localhost:8080/v2",
    auth: { type: "basic", username: "admin", password: "admin" },
  },
})

// Activate a profile
useProfile("local")

// Delete a profile
deleteProfile("old-profile")
\`\`\`

## API Reference

### Profile Management

| Export | Description |
|--------|-------------|
| \`listProfiles()\` | Returns all stored profiles |
| \`getProfile(name)\` | Returns a profile by name, or \`undefined\` |
| \`getActiveProfile()\` | Returns the currently active profile |
| \`getActiveName()\` | Returns the active profile name |
| \`saveProfile(profile)\` | Create or update a profile |
| \`deleteProfile(name)\` | Remove a profile |
| \`useProfile(name)\` | Set the active profile |
| \`getConfigFilePath()\` | Returns the full path to the config file |

### Client Factories

| Export | Description |
|--------|-------------|
| \`createClientFromProfile(name?)\` | \`CamundaClient\` from the active or named profile |
| \`createAdminClientFromProfile(name?)\` | \`AdminApiClient\` from the active or named profile |

### Auth

| Export | Description |
|--------|-------------|
| \`getAuthHeader(config)\` | Resolves an \`Authorization\` header string for any auth type |
`,
	},

	// ── operate ───────────────────────────────────────────────────────────────
	"packages/operate": {
		name: "@bpmnkit/operate",
		description:
			"Monitoring and operations frontend for Camunda 8 clusters — real-time SSE, zero dependencies",
		content: `## Overview

\`@bpmnkit/operate\` is a zero-dependency monitoring and operations frontend for Camunda 8. Mount it into any HTML element to get a full process monitoring UI — live dashboard, instance browser, incident management, job queue, and user tasks.

It pairs with the \`@bpmnkit/proxy\` local server, which polls the Camunda REST API server-side and pushes updates via **Server-Sent Events**. The frontend stays clean with no polling timers.

A **mock mode** (\`mock: true\`) ships fixture data without any running proxy or cluster — useful for demos and local development.

## Features

- **Dashboard** — real-time stats: active instances, open incidents, active jobs, pending tasks
- **Process Definitions** — deployed process list with name, version, and tenant
- **Process Instances** — paginated list with state filter (Active / Completed / Terminated)
- **Instance Detail** — BPMN canvas via \`@bpmnkit/canvas\` with live token-highlight overlay; active elements glow amber, visited elements show green tint
- **Incidents** — error type, message, process, and resolution state
- **Jobs** — job type, worker, retries, state, error message
- **User Tasks** — name, assignee, state, due date, priority
- **Profile switcher** — header dropdown populated from the proxy \`/profiles\` endpoint; switches reconnect all SSE streams
- **Mock/demo mode** — fully self-contained fixture data, no cluster required
- **SSE architecture** — proxy polls server-side; frontend opens one \`EventSource\` per view, gets pushed updates
- **Hash router** — \`#/\`, \`#/instances\`, \`#/instances/:key\`, \`#/definitions\`, etc.
- **Themeable** — light / dark / auto via CSS custom properties; \`--op-*\` variables

## Installation

\`\`\`sh
npm install @bpmnkit/operate @bpmnkit/proxy
\`\`\`

## Quick Start

### Demo mode (no cluster needed)

\`\`\`typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  mock: true,
  theme: "auto",
})
\`\`\`

### Connected to a real Camunda cluster via proxy

\`\`\`typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  proxyUrl: "http://localhost:3033",   // default
  profile: "production",               // optional, uses active profile if omitted
  pollInterval: 15_000,                // ms between server-side polls (default: 30 000)
  theme: "dark",
})
\`\`\`

The proxy must be running (\`pnpm proxy\`) and have at least one profile configured via the \`casen\` CLI.

## How it works

\`\`\`
Browser  ──── EventSource ────▶  @bpmnkit/proxy  ──── CamundaClient ────▶  Camunda cluster
         ◀─── SSE events ──────  (polls on interval, pushes results)
\`\`\`

1. Each view opens an SSE connection to \`/operate/stream?topic=<view>&interval=<ms>\`.
2. The proxy creates a \`CamundaClient\` using the configured profile's auth credentials.
3. On each polling tick, the proxy fetches the relevant Camunda data and emits a \`{ type: "data", payload }\` SSE event.
4. The store updates and the view re-renders.

## API Reference

### \`createOperate(options)\`

\`\`\`typescript
interface OperateOptions {
  container: HTMLElement
  proxyUrl?: string        // default: "http://localhost:3033"
  profile?: string         // profile name; uses active profile if omitted
  theme?: "light" | "dark" | "auto"  // default: "auto"
  pollInterval?: number    // ms between polls; default: 30 000
  mock?: boolean           // use built-in fixture data; default: false
}
\`\`\`

Returns an \`OperateApi\`:

\`\`\`typescript
interface OperateApi {
  el: HTMLElement
  setProfile(name: string | null): void
  setTheme(theme: "light" | "dark" | "auto"): void
  navigate(path: string): void  // e.g. "/instances/123456789"
  destroy(): void
}
\`\`\`
`,
	},
}

// ── Write READMEs ────────────────────────────────────────────────────────────

for (const [pkgPath, { name, description, content }] of Object.entries(packages)) {
	const fullContent = [header({ name, description }), content, footer(name)].join("\n")

	const outputPath = resolve(ROOT, pkgPath, "README.md")
	writeFileSync(outputPath, fullContent, "utf8")
	console.log(`✓  ${outputPath}`)
}

console.log(`\nGenerated ${Object.keys(packages).length} READMEs.`)

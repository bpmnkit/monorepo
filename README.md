<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="80" height="80" alt="BPMN Kit logo"></a>
  <h1>BPMN Kit</h1>
  <p>The complete TypeScript toolkit for Camunda 8 process automation</p>

  [![license](https://img.shields.io/github/license/bpmnkit/monorepo?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
  [![turborepo](https://img.shields.io/badge/Turborepo-monorepo-ef4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [npm](https://www.npmjs.com/org/bpmnkit) · [GitHub](https://github.com/bpmnkit/monorepo)
</div>

---

## What is BPMN Kit?

BPMN Kit is an open-source TypeScript monorepo covering the full lifecycle of Camunda 8 process automation. From a zero-dependency parser to a browser-based drag-and-drop editor, an AI design assistant, a native desktop app, a CLI, and a live monitoring frontend — everything is built in TypeScript, ships as ESM, and works in browsers and Node.js.

## Highlights

- **Full-stack BPMN tooling** — parse, build, validate, auto-layout, and export BPMN 2.0 / DMN 1.3 / Camunda Forms with a fluent TypeScript API
- **Interactive browser editor** — drag-and-drop BPMN editor with 40+ element types, undo/redo, multi-file tabs, AI chat, and in-browser process simulation
- **22 composable plugins** — minimap, command palette, AI bridge, token highlight, storage, history, connector catalog, optimizer, and more
- **100+ OpenAPI connectors** — generate Camunda REST connector templates from 100 built-in API specs (18,000+ endpoints: GitHub, Stripe, Slack, Jira, and more)
- **`casen` CLI** — deploy, monitor, and manage Camunda 8 processes from the terminal; extend via a typed plugin SDK
- **AI-assisted design** — local proxy connects Claude, Copilot, and Gemini to edit diagrams via natural language or MCP tool calls
- **Native desktop app** — 3–5 MB Tauri installer for Windows, macOS, and Linux
- **Zero-dependency execution** — lightweight BPMN simulation engine for offline testing and step-through debugging

## Packages

### Core Libraries

| Package | Version | Description |
|---------|---------|-------------|
| [`@bpmnkit/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@bpmnkit/core?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine, optimizer |
| [`@bpmnkit/canvas`](packages/canvas) | [![npm](https://img.shields.io/npm/v/@bpmnkit/canvas?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer with pan/zoom and plugin API |
| [`@bpmnkit/editor`](packages/editor) | [![npm](https://img.shields.io/npm/v/@bpmnkit/editor?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](packages/engine) | [![npm](https://img.shields.io/npm/v/@bpmnkit/engine?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight zero-dependency BPMN execution engine |
| [`@bpmnkit/feel`](packages/feel) | [![npm](https://img.shields.io/npm/v/@bpmnkit/feel?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/feel) | Complete FEEL expression language — parser, evaluator, highlighter |
| [`@bpmnkit/plugins`](packages/plugins) | [![npm](https://img.shields.io/npm/v/@bpmnkit/plugins?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/ascii`](packages/ascii) | [![npm](https://img.shields.io/npm/v/@bpmnkit/ascii?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |

### Camunda Integration

| Package | Version | Description |
|---------|---------|-------------|
| [`@bpmnkit/api`](packages/api) | [![npm](https://img.shields.io/npm/v/@bpmnkit/api?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API client — 180 typed operations, OAuth2, retries |
| [`@bpmnkit/connector-gen`](packages/connector-gen) | [![npm](https://img.shields.io/npm/v/@bpmnkit/connector-gen?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs (100 built-in) |
| [`@bpmnkit/profiles`](packages/profiles) | [![npm](https://img.shields.io/npm/v/@bpmnkit/profiles?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/profiles) | Auth & profile storage shared between CLI and proxy |

### Apps & CLI

| Package | Version | Description |
|---------|---------|-------------|
| [`@bpmnkit/cli`](apps/cli) | [![npm](https://img.shields.io/npm/v/@bpmnkit/cli?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/cli) | `casen` — Camunda 8 command-line interface |
| [`@bpmnkit/proxy`](apps/proxy) | [![npm](https://img.shields.io/npm/v/@bpmnkit/proxy?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/operate`](packages/operate) | [![npm](https://img.shields.io/npm/v/@bpmnkit/operate?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/cli-sdk`](packages/cli-sdk) | [![npm](https://img.shields.io/npm/v/@bpmnkit/cli-sdk?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for `casen` |
| [`@bpmnkit/create-casen-plugin`](packages/create-casen-plugin) | [![npm](https://img.shields.io/npm/v/@bpmnkit/create-casen-plugin?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new `casen` CLI plugin in seconds |

### CLI Plugins

| Package | Version | Description |
|---------|---------|-------------|
| [`@bpmnkit/casen-report`](plugins-cli/casen-report) | [![npm](https://img.shields.io/npm/v/@bpmnkit/casen-report?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda incident and SLA data |
| [`@bpmnkit/casen-worker-http`](plugins-cli/casen-worker-http) | [![npm](https://img.shields.io/npm/v/@bpmnkit/casen-worker-http?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker — complete jobs with live API data |
| [`@bpmnkit/casen-worker-ai`](plugins-cli/casen-worker-ai) | [![npm](https://img.shields.io/npm/v/@bpmnkit/casen-worker-ai?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, decide via Claude |

### Design System & Shared

| Package | Description |
|---------|-------------|
| [`@bpmnkit/ui`](packages/ui) | Shared design tokens and CSS theme system (`--bpmnkit-*` variables) |
| [`@bpmnkit/astro-shared`](packages/astro-shared) | Shared CSS tokens and metadata for Astro apps |

## Quick Start

### SDK — parse and build BPMN in TypeScript

```sh
npm install @bpmnkit/core
```

```typescript
import { Bpmn } from "@bpmnkit/core"

// Build a process programmatically
const xml = Bpmn.export(
  Bpmn.createProcess("order-flow")
    .startEvent("start")
    .serviceTask("validate", { name: "Validate Order", type: "order-validator" })
    .exclusiveGateway("check", { name: "Valid?" })
      .branch("yes", (b) => b.condition("= valid").serviceTask("fulfill", { type: "fulfillment-service" }).endEvent("done"))
      .branch("no",  (b) => b.defaultFlow().endEvent("rejected"))
    .build()
)

// Parse existing BPMN
const defs = Bpmn.parse(xml)
console.log(defs.processes[0].flowElements.length, "elements")
```

See the full [`@bpmnkit/core` README](packages/core/README.md) for the complete API reference.

### Browser Editor — embed a BPMN editor in your app

```sh
npm install @bpmnkit/editor @bpmnkit/canvas @bpmnkit/plugins
```

```typescript
import { BpmnEditor, createSideDock, initEditorHud } from "@bpmnkit/editor"
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap"
import { createAiBridgePlugin } from "@bpmnkit/plugins/ai-bridge"

const dock  = createSideDock()
document.body.appendChild(dock.el)

const editor = new BpmnEditor({
  container: document.getElementById("editor")!,
  theme: "dark",
  persistTheme: true,
  plugins: [
    createMinimapPlugin(),
    createAiBridgePlugin({ container: dock.aiPane, serverUrl: "http://localhost:3033" }),
  ],
})

initEditorHud(editor)
editor.loadXML(bpmnXml)
```

See the [`@bpmnkit/editor`](packages/editor/README.md) and [`@bpmnkit/plugins`](packages/plugins/README.md) READMEs for all options.

### CLI — manage Camunda 8 from the terminal

```sh
npm install -g @bpmnkit/cli

# Connect to your Camunda cluster
casen profile add production

# Deploy a process
casen deploy order-process.bpmn

# Monitor running instances
casen instances list --state active

# Generate connector templates from any OpenAPI spec
casen connector generate https://api.example.com/openapi.json --out ./templates/

# Start the local AI bridge and API proxy
casen proxy start
```

See the full [`@bpmnkit/cli` README](apps/cli/README.md) for all commands.

### Monitoring — embed the operations frontend

```typescript
import { createOperate } from "@bpmnkit/operate"

// Demo mode — no cluster required
createOperate({ container: document.getElementById("app")!, mock: true })

// Live mode via proxy
createOperate({
  container: document.getElementById("app")!,
  proxyUrl: "http://localhost:3033",
  profile: "production",
})
```

## Repository Structure

```
bpmnkit/monorepo
├── packages/           # Published npm packages
│   ├── core/           # @bpmnkit/core    — BPMN/DMN/Form SDK
│   ├── canvas/         # @bpmnkit/canvas  — SVG viewer
│   ├── editor/         # @bpmnkit/editor  — Interactive editor
│   ├── engine/         # @bpmnkit/engine  — Process execution engine
│   ├── feel/           # @bpmnkit/feel    — FEEL expression language
│   ├── plugins/        # @bpmnkit/plugins — 22 canvas plugins
│   ├── api/            # @bpmnkit/api     — Camunda 8 REST client
│   ├── connector-gen/  # @bpmnkit/connector-gen — OpenAPI → connectors
│   ├── operate/        # @bpmnkit/operate — Monitoring frontend
│   ├── profiles/       # @bpmnkit/profiles — Auth & profile storage
│   ├── cli-sdk/        # @bpmnkit/cli-sdk — Plugin authoring SDK
│   ├── ascii/          # @bpmnkit/ascii   — ASCII art renderer
│   ├── ui/             # @bpmnkit/ui      — Design tokens
│   └── astro-shared/   # Shared Astro CSS/metadata
├── apps/               # Non-published applications
│   ├── cli/            # casen CLI tool
│   ├── proxy/          # Local AI + API proxy server
│   ├── desktop/        # Tauri native desktop app
│   ├── landing/        # bpmnkit.com (Astro)
│   ├── docs/           # docs.bpmnkit.com (Astro Starlight)
│   ├── learn/          # Interactive learning center (Astro)
│   └── examples/       # Runnable BPMN workflow examples
├── plugins-cli/        # Official casen CLI plugins
│   ├── casen-report/        # HTML incident & SLA reports
│   ├── casen-worker-http/   # Example HTTP worker plugin
│   └── casen-worker-ai/      # AI task worker (Claude)
├── scripts/            # Build utilities (readme gen, stats, etc.)
├── turbo.json          # Turborepo pipeline
└── pnpm-workspace.yaml # pnpm workspace config
```

## Development

### Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | 18+ (latest LTS recommended) |
| [pnpm](https://pnpm.io/) | 10+ |

### Setup

```sh
git clone https://github.com/bpmnkit/monorepo.git
cd monorepo
pnpm install
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (Turborepo, incremental) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm check` | Lint and format check (Biome) |
| `pnpm typecheck` | TypeScript strict type check |
| `pnpm verify` | Full CI check — build + typecheck + check + test |
| `pnpm docs:dev` | Start docs site dev server |
| `pnpm proxy` | Start local AI bridge and API proxy (port 3033) |
| `pnpm desktop:dev` | Start Tauri desktop app in dev mode |

### Releasing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```sh
pnpm changeset          # Describe your change (interactive)
pnpm version-packages   # Apply changesets and bump versions
pnpm release            # Build and publish all changed packages to npm
```

Every PR that changes a published package **must** include a changeset. Use `patch` for bug fixes, `minor` for new features, `major` for breaking changes.

## Contributing

Contributions are welcome — bug reports, feature requests, documentation improvements, and pull requests.

1. Fork the repository and create a feature branch
2. `pnpm install` to set up the workspace
3. Make your changes and add tests where appropriate
4. Run `pnpm verify` — all checks must pass
5. Add a changeset: `pnpm changeset`
6. Open a pull request

### Code Standards

- **TypeScript strict mode** — zero type errors required
- **Biome** for formatting and linting — `pnpm check` must pass
- **Vitest** for tests — all existing tests must pass
- No new external dependencies without discussion

## License

[MIT](./LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>

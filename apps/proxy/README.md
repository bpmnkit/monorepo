<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/proxy</h1>
  <p>Local proxy server for BPMN Kit — AI bridge (SSE/MCP) and Camunda API proxy using stored CLI profiles</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/proxy?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/proxy)
  [![license](https://img.shields.io/npm/l/@bpmnkit/proxy?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/apps/proxy/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/proxy` is a local Node.js server that bridges the BPMN Kit editor with AI services and your Camunda cluster. It runs on port 3033 and provides:

- **AI chat bridge** — SSE streaming endpoint for AI-assisted diagram editing; connects to any OpenAI-compatible LLM API
- **MCP server** — Model Context Protocol server for AI agent integrations (`stdio` transport)
- **Camunda API proxy** — transparent HTTP proxy that injects auth from your `casen` CLI profiles

The proxy reads authentication from profiles stored by the `@bpmnkit/cli` (`~/.config/casen/config.json`), so you don't need to configure credentials separately.

## Installation

```sh
npm install -g @bpmnkit/proxy
# or run from the monorepo:
pnpm proxy
```

## Quick Start

```sh
# Start the proxy server (port 3033)
bpmn-ai-server

# Or start the MCP server (stdio)
bpmn-mcp
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Health check; returns server version and active profile |
| `POST` | `/chat` | AI chat — SSE stream; sends `data: { type, content }` events |
| `GET` | `/profiles` | List all configured `casen` profiles |
| `ALL` | `/api/*` | Transparent proxy to your Camunda cluster (adds auth header) |
| `GET` | `/operate/stream` | SSE stream for the `@bpmnkit/operate` monitoring frontend |

## Configuration

The proxy reads from the active `casen` CLI profile. Set an `AI_API_KEY` environment variable for the AI bridge:

```sh
AI_API_KEY=sk-... bpmn-ai-server
```

Or use the `X-Profile` request header to target a specific profile on the `/api/*` proxy:

```sh
curl -H "X-Profile: production" http://localhost:3033/api/v2/process-definitions
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

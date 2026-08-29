# Installation — SVG Canvas Viewer

To embed an interactive BPMN diagram viewer in a web page:

```sh
pnpm add @bpmnkit/canvas
```


## Full Editor

The editor bundles the canvas, a properties panel, and an AI bridge:

```sh
pnpm add @bpmnkit/editor
```


## CLI

The `casen` CLI is a standalone tool — install it globally:

```sh
pnpm add -g @bpmnkit/cli
```

With the CLI installed, you can use the AI-first workflow to implement processes from natural
language using Claude Code:

```sh
casen skills install   # install /implement, /review, /test, /deploy slash commands
casen proxy            # start the AI bridge
casen reebe            # start local workflow engine
```

Then in Claude Code: `/implement an invoice approval process`

See [AI-Driven Implementation](/docs/guides/ai-implement) for a full walkthrough.

---
Source: https://bpmnkit.com/docs/getting-started/installation

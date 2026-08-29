# AGENTS.md

Guidance for AI coding agents working in this repository.
Full contributor and style rules live in [`CLAUDE.md`](CLAUDE.md) — read it too.

## Search the documentation before answering from memory

This repo ships its own documentation as an offline, searchable package:
**`@bpmnkit/docspack`** (`packages/docspack`). It follows the
[docspack format](https://docspack.dev/spec) and needs no server, no network access and
no MCP configuration.

```sh
npx bpmnkit-docs ask "how do I deploy a process to Camunda 8"
npx bpmnkit-docs search "exclusive gateway condition"
npx bpmnkit-docs list
```

- **Ask a question, not a package name.** Answers cap at 3 chunks / 3,000 tokens, so
  prefer several narrow questions over one broad one.
- **A returned chunk beats recalled knowledge.** It describes the version installed
  here; your memory describes some earlier release. If the two disagree, the chunk is
  right. Do not blend them into one answer.
- Each answer is headed with `<package>@<version>/<chunk-id>`, so you can cite exactly
  what you used.

Working in a project that only *consumes* BPMN Kit? Install the pack there and get the
same command:

```sh
npm i -D @bpmnkit/docspack
```

## Repository basics

- pnpm workspaces + Turborepo; TypeScript strict; Biome for lint and format; Vitest.
- Verify with `pnpm turbo build typecheck check test`.
- After editing `apps/landing/src/content/docs/`, rebuild the docs pack:
  `pnpm --filter @bpmnkit/docspack build`.

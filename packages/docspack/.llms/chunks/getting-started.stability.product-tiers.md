# Stability and Versioning — Product tiers

Every product BPMN Kit ships is in one of three tiers. The tier says how much you can rely
on it. Each README and each package page on this site shows it.

| Tier | What it promises |
|---|---|
| **Core** | The promises on this page, from 1.0: nothing breaks without a major release. Core is exactly the twelve packages at 1.0. |
| **Tools** | Maintained: bugs are fixed and releases continue. Versions are 0.x, so a minor release can break. Pin a version. |
| **Experimental** | May change a lot or be discontinued. Not for production. Always below 1.0. |

- **Core:** `@bpmnkit/core`, `@bpmnkit/canvas`, `@bpmnkit/editor`, `@bpmnkit/plugins`,
  `@bpmnkit/engine`, `@bpmnkit/feel`, `@bpmnkit/api`, `@bpmnkit/ascii`, `@bpmnkit/docspack`,
  `@bpmnkit/connector-gen`, `@bpmnkit/connectors`, `@bpmnkit/cli`.
- **Tools:** BPMN Kit for VS Code, Drop, `@bpmnkit/proxy` (the MCP server, `casen proxy mcp`),
  `@bpmnkit/markdown`, `@bpmnkit/camunda-docspack`, `@bpmnkit/patterns`,
  `@bpmnkit/worker-client`, `@bpmnkit/cli-sdk`, `@bpmnkit/create-casen-plugin`,
  `@bpmnkit/casen-report`, `@bpmnkit/casen-worker-http`, `@bpmnkit/casen-worker-ai`, and the
  shared plumbing `@bpmnkit/ui`, `@bpmnkit/profiles` and `@bpmnkit/astro-shared`.
- **Experimental:** Reebe, `@bpmnkit/reebe-wasm`, `@bpmnkit/operate`, `@bpmnkit/user-tasks`,
  Studio, the Desktop app and proxy-rs.

Reebe is a dev/test engine: use it on your machine and in CI, not in production. The
`@bpmnkit/engine/wasm-runner` entry point is part of a Core package, so its API is covered,
but the Reebe engine it runs is Experimental and its behaviour can change in any release.

The tiers live in `TIER` and `APPS` in
[`scripts/published-packages.mjs`](https://github.com/bpmnkit/monorepo/blob/main/scripts/published-packages.mjs).
The repo's checks fail if a published package has no tier, if Core differs from the packages
at 1.0, or if an Experimental product reaches 1.0.

---
Source: https://bpmnkit.com/docs/getting-started/stability

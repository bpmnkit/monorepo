---
"@bpmnkit/feel": patch
"@bpmnkit/engine": patch
"@bpmnkit/plugins": patch
"@bpmnkit/cli": patch
"@bpmnkit/astro-shared": patch
"@bpmnkit/desktop": patch
"bpmnkit": patch
---

Descriptions and READMEs now say what each package does, with the numbers that back it.

- `@bpmnkit/feel` states its conformance — 1,939 of the DMN TCK's 2,053 FEEL cases (94.4%) —
  instead of calling itself complete.
- `@bpmnkit/engine` is described as a simulator for tests and demos, and its README lists the
  elements it executes and the ones it completes without their semantics.
- `@bpmnkit/plugins` counts its 34 plugins and documents the seven the README left out.
- `@bpmnkit/cli` declares `mcpName`, so `casen proxy mcp` can be listed in the MCP Registry.
- `@bpmnkit/astro-shared`'s `Seo` component loads Cloudflare Web Analytics when a build sets
  `PUBLIC_CF_WEB_ANALYTICS_TOKEN`, and nothing otherwise.
- The desktop app is named BPMN Kit, ships icons for every platform, finds its bundled AI
  server on Windows, and builds again: the proxy-rs build script still filtered on the
  pre-rename `@bpmn-sdk/proxy` package. Installers are attached to GitHub Releases.
- The VS Code extension is packaged on every release and attached to GitHub Releases, and
  published to the Visual Studio Marketplace and Open VSX once their tokens are configured.

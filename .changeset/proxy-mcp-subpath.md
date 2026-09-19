---
"@bpmnkit/proxy": minor
"@bpmnkit/cli": patch
---

Rename the MCP entry point from `@bpmnkit/proxy/dist/aikit-mcp.js` to
`@bpmnkit/proxy/aikit-mcp`.

The old spelling named a build path as public API, on the same day the stability policy
started saying that deep `dist/` paths are not. `@bpmnkit/proxy` is still 0.x and makes no
compatibility promise, so this is the free moment to fix it — once it reaches 1.0 the
contradiction would be frozen in, and the choice would be between breaking it later or
publishing a policy the package's own manifest contradicts.

`casen proxy mcp` resolves the new subpath. Nothing about the command changes.

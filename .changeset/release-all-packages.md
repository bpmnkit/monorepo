---
"@bpmnkit/cli": patch
"@bpmnkit/proxy": patch
"@bpmnkit/reebe-wasm": patch
"@bpmnkit/api": patch
"@bpmnkit/ascii": patch
"@bpmnkit/astro-shared": patch
"@bpmnkit/canvas": patch
"@bpmnkit/cli-sdk": patch
"@bpmnkit/connector-gen": patch
"@bpmnkit/connectors": patch
"@bpmnkit/core": patch
"@bpmnkit/create-casen-plugin": patch
"@bpmnkit/docspack": patch
"@bpmnkit/editor": patch
"@bpmnkit/engine": patch
"@bpmnkit/feel": patch
"@bpmnkit/operate": patch
"@bpmnkit/patterns": patch
"@bpmnkit/plugins": patch
"@bpmnkit/profiles": patch
"@bpmnkit/ui": patch
"@bpmnkit/user-tasks": patch
"@bpmnkit/worker-client": patch
"@bpmnkit/casen-report": patch
"@bpmnkit/casen-worker-ai": patch
"@bpmnkit/casen-worker-http": patch
---

Coordinated release of every published package

`@bpmnkit/core` carries fixes that have been on `main` since the last release but never
shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
API (#150) among them, which is still reported as reproducing because the newest artifact
on npm predates the fix. Bumping every publishable package releases the workspace as one
set, so no consumer resolves a core that a sibling package was never built against.

Nothing here changes behaviour beyond what each package's own changesets describe.

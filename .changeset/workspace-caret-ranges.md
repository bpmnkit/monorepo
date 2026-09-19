---
"@bpmnkit/camunda-docspack": patch
"@bpmnkit/casen-worker-http": patch
"@bpmnkit/casen-worker-ai": patch
"@bpmnkit/astro-shared": patch
"@bpmnkit/casen-report": patch
"@bpmnkit/connectors": patch
"@bpmnkit/user-tasks": patch
"@bpmnkit/profiles": patch
"@bpmnkit/operate": patch
"@bpmnkit/plugins": patch
"@bpmnkit/canvas": patch
"@bpmnkit/editor": patch
"@bpmnkit/engine": patch
"@bpmnkit/ascii": patch
"@bpmnkit/proxy": patch
"@bpmnkit/core": patch
"@bpmnkit/cli": patch
---

Depend on sibling packages by caret range instead of an exact version.

Every internal dependency was `workspace:*`, which publishes as an **exact** pin —
`@bpmnkit/plugins` depended on `@bpmnkit/core` at exactly `0.4.0`, not `^0.4.0`. In a
lockstep 0.x that is invisible. It stops being invisible the moment two BPMN Kit
packages in one dependency tree disagree about which version of a third they want: npm
and pnpm both satisfy that by installing **two copies**, and a second copy of
`@bpmnkit/core` is not a duplicate of the first. Class identity, `instanceof`, module-level
registries and TypeScript's structural-but-nominal-at-the-boundary types all quietly stop
matching across the seam.

`workspace:^` publishes `^0.4.0`, so a consumer resolves one copy. The change has to land
before 1.0.0 rather than with it: widening a published range is itself a change to every
manifest, and doing it as part of the 1.0 tag would mean the first stable release is also
the one that moves everyone's dependency graph.

The private apps in the workspace keep `workspace:*`. They are never published, so the
range has no consumer to reach.

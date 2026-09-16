# @bpmnkit/docspack

## 0.0.5

### Patch Changes

- 677e58a: Add `@bpmnkit/camunda-docspack`: the Camunda 8.10 documentation — best practices, the BPMN and FEEL references, engine concepts and 227 Orchestration Cluster API operations — as an offline docspack pack, searchable with `bpmnkit-docs ask`. Embedded BPMN diagrams are rendered as text flow descriptions rather than dropped, and links are rewritten to absolute `docs.camunda.io` URLs. Licensed CC BY-SA 3.0, as ShareAlike requires for an adaptation of camunda-docs.

  `@bpmnkit/docspack`: a chunk's heading trail no longer keeps an empty level when a short preamble is merged into the section after it (`Title —  — Section`).

## 0.0.4

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.0.3

### Patch Changes

- f990c94: Documentation moved from `docs.bpmnkit.com` to `bpmnkit.com/docs`.
  - `astro-shared`: `SITE.docsUrl` is now `https://bpmnkit.com/docs`.
  - `docspack`: the pack is built from `apps/landing/src/content/docs` with
    `siteUrl: https://bpmnkit.com/docs`, and each chunk's `Source:` link no longer ends in a
    trailing slash — the site serves extensionless URLs without one.
  - `plugins`: the command palette's default `docsBaseUrl` and its doc paths follow the new URLs.

- 00a65f5: Rebuilt the pack against the corrected round-trip documentation.

  The docs claimed "the parser preserves all attributes, extensions, and vendor-specific
  elements", which 11 of 12 measured blueprints contradicted, and the parsing example used
  `definitions.rootElements` rather than `definitions.processes`. `concepts.md`, `guides/ai.md`
  and `packages/core.md` now state what survives and what is dropped, and the chunks agents
  retrieve say the same.

## 0.0.2

### Patch Changes

- 1c5e32d: New `@bpmnkit/docspack` package: the BPMN Kit documentation shipped as an offline, version-locked [docspack](https://docspack.dev/spec) package, with a `bpmnkit-docs` CLI so an AI agent can search it without a server or a network call.

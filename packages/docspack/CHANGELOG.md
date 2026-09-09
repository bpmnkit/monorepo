# @bpmnkit/docspack

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

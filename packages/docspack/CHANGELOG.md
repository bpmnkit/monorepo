# @bpmnkit/docspack

## 0.0.3

### Patch Changes

- f990c94: Documentation moved from `docs.bpmnkit.com` to `bpmnkit.com/docs`.
  - `astro-shared`: `SITE.docsUrl` is now `https://bpmnkit.com/docs`.
  - `docspack`: the pack is built from `apps/landing/src/content/docs` with
    `siteUrl: https://bpmnkit.com/docs`, and each chunk's `Source:` link no longer ends in a
    trailing slash — the site serves extensionless URLs without one.
  - `plugins`: the command palette's default `docsBaseUrl` and its doc paths follow the new URLs.

## 0.0.2

### Patch Changes

- 1c5e32d: New `@bpmnkit/docspack` package: the BPMN Kit documentation shipped as an offline, version-locked [docspack](https://docspack.dev/spec) package, with a `bpmnkit-docs` CLI so an AI agent can search it without a server or a network call.

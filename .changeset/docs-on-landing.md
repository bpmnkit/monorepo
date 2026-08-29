---
"@bpmnkit/astro-shared": patch
"@bpmnkit/docspack": patch
"@bpmnkit/plugins": patch
---

Documentation moved from `docs.bpmnkit.com` to `bpmnkit.com/docs`.

- `astro-shared`: `SITE.docsUrl` is now `https://bpmnkit.com/docs`.
- `docspack`: the pack is built from `apps/landing/src/content/docs` with
  `siteUrl: https://bpmnkit.com/docs`, and each chunk's `Source:` link no longer ends in a
  trailing slash — the site serves extensionless URLs without one.
- `plugins`: the command palette's default `docsBaseUrl` and its doc paths follow the new URLs.

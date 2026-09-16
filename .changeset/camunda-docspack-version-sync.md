---
"@bpmnkit/camunda-docspack": patch
---

Keep the published `.llms/` payload's version in step with `package.json`. This pack's payload is committed rather than rebuilt at release — the rebuild needs a `camunda-docs` checkout only the weekly workflow has — so `changeset version` moved `package.json` while `.llms/manifest.json` and `llms.txt` kept the version of the last rebuild. `0.1.0` shipped a manifest claiming `0.0.0`, which fails `docspack doctor` and is reported to every consumer by `docspack list`. `build` now syncs the version before publish; nothing else in the payload is touched.

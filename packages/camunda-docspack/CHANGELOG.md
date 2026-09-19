# @bpmnkit/camunda-docspack

## 0.1.2

### Patch Changes

- 191d4d2: Keep the published `.llms/` payload's version in step with `package.json`. This pack's payload is committed rather than rebuilt at release — the rebuild needs a `camunda-docs` checkout only the weekly workflow has — so `changeset version` moved `package.json` while `.llms/manifest.json` and `llms.txt` kept the version of the last rebuild. `0.1.0` shipped a manifest claiming `0.0.0`, which fails `docspack doctor` and is reported to every consumer by `docspack list`. `build` now syncs the version before publish; nothing else in the payload is touched.
- Updated dependencies [191d4d2]
- Updated dependencies [191d4d2]
  - @bpmnkit/core@0.8.0
  - @bpmnkit/docspack@0.0.6

## 0.1.1

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/core@0.7.1

## 0.1.0

### Minor Changes

- 677e58a: Add `@bpmnkit/camunda-docspack`: the Camunda 8.10 documentation — best practices, the BPMN and FEEL references, engine concepts and 227 Orchestration Cluster API operations — as an offline docspack pack, searchable with `bpmnkit-docs ask`. Embedded BPMN diagrams are rendered as text flow descriptions rather than dropped, and links are rewritten to absolute `docs.camunda.io` URLs. Licensed CC BY-SA 3.0, as ShareAlike requires for an adaptation of camunda-docs.

  `@bpmnkit/docspack`: a chunk's heading trail no longer keeps an empty level when a short preamble is merged into the section after it (`Title —  — Section`).

### Patch Changes

- Updated dependencies [677e58a]
  - @bpmnkit/docspack@0.0.5

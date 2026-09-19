# @bpmnkit/camunda-docspack

## 0.1.3

### Patch Changes

- 0ba6ef6: Depend on sibling packages by caret range instead of an exact version.

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

- Updated dependencies [0ba6ef6]
- Updated dependencies [0ba6ef6]
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/docspack@1.0.0
  - @bpmnkit/core@1.0.0

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

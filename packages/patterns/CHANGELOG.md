# @bpmnkit/patterns

## 0.1.0

### Minor Changes

- 56ad670: - `@bpmnkit/patterns/templates` (new export): 25 runnable Camunda 8 process templates — order
  to cash, approvals, onboarding, incidents, documents, SLAs, sagas, human-in-the-loop and seven
  AI agent patterns — each with DMN/forms where used and a `.bpmn.tests.json` scenario set that
  passes on `@bpmnkit/engine`'s `runScenario`. `ALL_TEMPLATES`, `TEMPLATE_CATEGORIES`,
  `getTemplate`, `templatesInCategory`, `templateFiles`, `listJobTypes`. The package now
  depends on `@bpmnkit/core`.
  - `casen template list [--category]` and `casen template use <id> [dir] [--force]` write a
    template's files into a project.
  - Core: `receiveTask(..., { correlationKey })` now writes the `zeebe:subscription` it
    documented; it was silently dropped, so the task failed `deploy/message-catch-no-correlation`.

### Patch Changes

- 56ad670: Each README now shows the package's product tier (Core, Tools or Experimental) and what that tier promises. The `@bpmnkit/reebe-wasm` README and description say that Reebe is a dev/test engine, not for production: a clean-room implementation of the Zeebe API, not affiliated with Camunda.
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
  - @bpmnkit/core@1.1.0

## 0.0.6

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.0.5

### Patch Changes

- 9cd1942: Improvements around AI integration

## 0.0.4

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations

## 0.0.3

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

## 0.0.2

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

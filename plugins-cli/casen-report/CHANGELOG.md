# @bpmnkit/casen-report

## 0.1.11

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
  - @bpmnkit/api@1.0.0

## 0.1.10

### Patch Changes

- 88642f8: The three casen plugins ship their `dist/`, and stop shipping their sources

  None of them declared `files`, so packing fell back to the ignore rules — and the root
  `.gitignore` ignores `dist`. npm always includes the file named in `main` whatever the
  ignores say, so `dist/index.js` was packed and the rest of the build was not: no
  `dist/index.d.ts` for the `exports["."].types` each manifest declares, and for
  `casen-report` no `dist/report.js` or `dist/commands/*.js` either, which is every module
  its entry point imports. `src/` and `tsconfig.json` were packed in their place.

  Each now lists `"files": ["LICENSE", "README.md", "dist/**/*.js", "dist/**/*.d.ts"]`, the
  same line every other published package in the workspace carries.

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

- Updated dependencies [9d412da]
  - @bpmnkit/api@0.0.21
  - @bpmnkit/cli-sdk@0.0.10

## 0.1.9

### Patch Changes

- 00a65f5: Four packaging bugs found by opening the published tarballs and installing them.
  - `proxy`: declared `exports["."].types` while `files` listed only `dist/**/*.js`, so the
    declarations were built and never packed. It now ships its `.d.ts` files.
  - `plugins`: `dist/token-highlight/index.js` imported `./css` without an extension, which Node
    ESM does not resolve — `@bpmnkit/plugins/token-highlight` threw on import, and
    `@bpmnkit/operate` threw with it.
  - `casen-worker-http` and `casen-worker-ai`: import `@bpmnkit/cli-sdk` and declared no
    dependencies at all, so npm never installed it and importing them failed.
  - `casen-report`: the same undeclared `@bpmnkit/cli-sdk` in its `.d.ts`, plus an undeclared
    `@bpmnkit/api`, so its published types did not resolve.

## 0.1.8

### Patch Changes

- 9cd1942: Improvements around AI integration

## 0.1.7

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations

## 0.1.6

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

## 0.1.5

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.1.4

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

## 0.1.3

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.1.2

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

## 0.1.1

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

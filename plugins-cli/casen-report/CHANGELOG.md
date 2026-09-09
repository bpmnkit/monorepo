# @bpmnkit/casen-report

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

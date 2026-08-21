# @bpmnkit/core

## 0.1.2

### Patch Changes

- 9cd1942: Improvements around AI integration
- Updated dependencies [9cd1942]
  - @bpmnkit/feel@0.0.20

## 0.1.1

### Patch Changes

- c8f04ae: Improved rendering

## 0.1.0

### Minor Changes

- b90111f: Replaced the Sugiyama/block-tree auto-layout pipeline with a grid-based layout engine.
  - **New grid layout engine**: `applyAutoLayout`/`Bpmn.autoLayout()` now place flow nodes on a fixed-cell grid (150×140) instead of layered Sugiyama columns, with a Manhattan-style router for orthogonal edges. Output geometry changes for existing diagrams, but the public API (`Bpmn.autoLayout(xml)`, `applyAutoLayout(defs)`) is unchanged.
  - **Message-flow routing** (new capability): `applyAutoLayout` now emits DI for `messageFlow` elements in collaborations, docking on the nearest edge between source/target shapes (flow nodes or pools) with a straight or orthogonal 4-point route.
  - **DI completeness checker** (new capability): `checkDiCompleteness(defs)` is now exported — walks a `BpmnDefinitions` tree and reports any flow node, sequence flow, text annotation, association, participant, or message flow missing a corresponding DI shape/edge.
  - **Text-annotation packing improvements**: annotations are now packed above/below the content bounding box with overlap and crossing avoidance, replacing the previous local-bounds heuristic.
  - **Export removals**: `buildBlockTree`, `applyBlockLayout`, `routeEdgeAstar`, and `assignGridRows` are no longer exported from `@bpmnkit/core` — they were internals of the removed Sugiyama/block-tree pipeline with no external replacement (the grid engine's equivalents are not part of the public API).
  - **Fix**: `exportSvg` rendered pool/lane background rectangles after (on top of) their child shapes, making collaboration diagrams render with blank pool interiors. Pool/lane backgrounds now render first.

### Patch Changes

- b90111f: Improved Layouting

## 0.0.27

### Patch Changes

- 5ea5318: Improved Layouting

## 0.0.26

### Patch Changes

- c93b45d: Minor fixes
- c93b45d: Several improvements and bugfixes.

## 0.0.25

### Patch Changes

- 7916980: Fix illegal BPMN

## 0.0.24

### Patch Changes

- e9ac598: SDK improvements
- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations
- Updated dependencies [dcf850a]
- Updated dependencies [d6d1860]
  - @bpmnkit/feel@0.0.19

## 0.0.23

### Patch Changes

- [#97](https://github.com/bpmnkit/monorepo/pull/97) [`c9aa98d`](https://github.com/bpmnkit/monorepo/commit/c9aa98d6430ec2022278631dae7c281aae9ae499) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improved Autolayout

- [#95](https://github.com/bpmnkit/monorepo/pull/95) [`5897d0f`](https://github.com/bpmnkit/monorepo/commit/5897d0f77a9d29dc7e88c5123f467686ff6e1960) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improve auto-layout

## 0.0.22

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

- Updated dependencies [[`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c)]:
  - @bpmnkit/feel@0.0.18

## 0.0.21

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40)]:
  - @bpmnkit/feel@0.0.17

## 0.0.20

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

- Updated dependencies [[`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2)]:
  - @bpmnkit/feel@0.0.16

## 0.0.19

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af)]:
  - @bpmnkit/feel@0.0.15

## 0.0.18

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

- Updated dependencies [[`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08)]:
  - @bpmnkit/feel@0.0.14

## 0.0.17

### Patch Changes

- [#70](https://github.com/bpmnkit/monorepo/pull/70) [`3f3b8f7`](https://github.com/bpmnkit/monorepo/commit/3f3b8f777cfb192582452757d86dc53b3de8059d) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Input Validation

## 0.0.16

### Patch Changes

- [#66](https://github.com/bpmnkit/monorepo/pull/66) [`270078c`](https://github.com/bpmnkit/monorepo/commit/270078c52fce2c2a567fa1b4b9d6de8001c6f18e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improved AI capabilities.

## 0.0.15

### Patch Changes

- [#58](https://github.com/bpmnkit/monorepo/pull/58) [`4953231`](https://github.com/bpmnkit/monorepo/commit/49532315a01c884d2a50375e6ea0148d6e294034) Thanks [@urbanisierung](https://github.com/urbanisierung)! - UX improvements

## 0.0.14

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

## 0.0.13

### Patch Changes

- [#49](https://github.com/bpmnkit/monorepo/pull/49) [`7918d12`](https://github.com/bpmnkit/monorepo/commit/7918d120740b85a2c4a363ff7dd9605d4f0f8a0d) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI in CLI, improved AI search in Operate, improved ASCII rendering

## 0.0.12

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

## 0.0.11

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

## 0.0.10

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

## 0.0.9

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

## 0.0.8

### Patch Changes

- [#34](https://github.com/bpmnkit/monorepo/pull/34) [`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design changes

## 0.0.7

### Patch Changes

- [#32](https://github.com/bpmnkit/monorepo/pull/32) [`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate and CLI improvements

## 0.0.6

### Patch Changes

- [#30](https://github.com/bpmnkit/monorepo/pull/30) [`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate, CLI, api

## 0.0.5

### Patch Changes

- [#28](https://github.com/bpmnkit/monorepo/pull/28) [`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec) Thanks [@urbanisierung](https://github.com/urbanisierung)! - SDK improvements, operate, editor UX improvements

## 0.0.4

### Patch Changes

- [#26](https://github.com/bpmnkit/monorepo/pull/26) [`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Docs, Logo, AI improvements

## 0.0.3

### Patch Changes

- [`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Fix package.json

## 0.0.2

### Patch Changes

- [#22](https://github.com/bpmnkit/monorepo/pull/22) [`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072) Thanks [@urbanisierung](https://github.com/urbanisierung)! - First ready features.

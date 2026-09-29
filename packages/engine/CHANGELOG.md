# @bpmnkit/engine

## 1.1.0

### Minor Changes

- 56ad670: AI agents can be put under deterministic tests.
  - The simulator runs an ad-hoc sub-process that has a job worker, such as Camunda's AI Agent
    Sub-process connector, when a worker is registered for its job type. The job carries
    `adHocSubProcessElements` (the tools, their documentation and their `fromAi()` parameters).
    The worker completes it with an `adHocSubProcess` job result:
    `job.complete(variables, { type: "adHocSubProcess", activateElements, isCompletionConditionFulfilled, isCancelRemainingInstances })`.
    Each activated element runs in its own scope with its variables. When it ends,
    `outputElement` is appended to `outputCollection` and the worker gets a new job. A
    completion without a job result completes the sub-process as before, so existing mocks
    keep working. New types: `JobResult`, `AdHocSubProcessJobResult`, `AdHocActivateElement`,
    `AdHocSubProcessElement` and `AdHocToolParameter`. The `job:created` event now names its
    `elementId`.
  - `ProcessTest.mockAiAgent(elementId, turns | cassette | handler)` plays the connector. Each
    model call takes the next turn: `{ toolCalls: [{ name, arguments }] }` activates those tools
    with a `toolCall` variable, and `{ responseText, responseJson }` ends the agent with its
    `agent` response. An unknown tool, arguments that do not match the tool's `fromAi()`
    parameters, a script that runs out and the connector's `maxModelCalls` each fail the run
    with a message that says so. The handle records `toolCalls` and `requests`, and the
    `toHaveCalledTools([...])` matcher checks the calls in order, arguments included.
  - Record and replay: `AgentCassette` is a versioned JSON format for an agent transcript.
    `parseAgentCassette`, `readAgentCassette` and `writeAgentCassette` validate it, and
    `handle.cassette()` records the turns that a handler of your own returned. No model or
    network is called.
  - `coverage().tools` and `formatCoverage` report which tools of AI agents the runs called.

- 56ad670: The TypeScript simulator now executes the BPMN semantics it used to skip:
  - **Boundary events.** A non-interrupting boundary event no longer ends its activity: the
    activity keeps running and the boundary path starts, once per repetition for a timer cycle.
    Message and signal boundary events, interrupting or not, are new. An error a job worker
    throws with `job.throwError(code, message)` is caught by an error boundary event or error
    event sub-process like an error end event; uncaught, it still fails the instance.
  - **Event-based gateway**: arms the message, timer and signal catch events (and receive
    tasks) after it; the first to fire wins and the others are cancelled.
  - **Call activities** run a process deployed in the same engine as a child instance, with
    Zeebe's variable propagation (`propagateAllParentVariables`, `propagateAllChildVariables`,
    input and output mappings). Errors and escalations the child does not catch reach the call
    activity; a failed job in the child fails the caller. A process that is not deployed still
    completes the call activity, now with an `element:warning` event.
  - **Event sub-processes** with message, timer, signal, error and escalation start events,
    interrupting or not, in a process or a sub-process.
  - **Signals** (throw, end, catch, start, boundary) broadcast to every instance of the engine;
    new `engine.broadcastSignal(name, variables?)` and `instance.deliverSignal(name, variables?)`.
    **Escalations** propagate through scopes and call activities like errors, and do not fail
    the instance when nobody catches them.
  - **Multi-instance** tasks and sub-processes, parallel and sequential: `inputCollection`,
    `inputElement`, `outputCollection`, `outputElement`, `loopCardinality` and
    `completionCondition`.
  - **Link events**, **compensation** (handlers of completed activities, in reverse order;
    `activityRef`), and the **complex gateway** splitting like an inclusive one.
  - **Messages**: `deliverMessage(name, variables?, correlationKey?)` matches the message name
    as well as its id, merges the variables, honours `zeebe:subscription` correlation keys on
    the event or its message, reaches waiting call-activity children, and returns whether
    anything received it.
  - **Variables** follow Zeebe's propagation: input mappings are local to their element, a
    result updates the nearest scope that defines the variable or else the process scope, and
    with output mappings only the mapped variables leave the element. New
    `VariableStore.propagate`.
  - New `element:terminated` and `element:warning` events. `engine.start` runs only the none
    start events when a process also has event start events.
  - Fixed: a split whose first branch ended at once finished the scope before its other
    branches ran; a job result arriving after an interrupting event moved the token on.

  `@bpmnkit/plugins`: token highlighting clears an element that an interrupting event
  terminated.

- 56ad670: New `@bpmnkit/engine/testing` entry point for unit-testing BPMN processes in Vitest or Jest,
  with no Docker and no cluster:
  - `createProcessTest({ bpmn, dmn?, forms?, startTime? })` deploys models (parsed, XML, a path
    or a `file:` URL) into an in-process engine.
  - `mockJob(type, …)` completes, fails or throws a BPMN error for a job type, or computes the
    result in a handler; `calls` records what it handled. Job types without a mock wait, and
    `run.completeJob / failJob / throwError(elementIdOrType, …)` drive them — Camunda user
    tasks included.
  - `mockConnector(type, { response })` maps a fake connector response through the task's
    `resultVariable` and `resultExpression`.
  - `run.publishMessage(name)` correlates a message and throws when nothing waits for it.
  - A virtual clock: `advanceTime("P1D")` fires due timers in order without real waiting.
  - Matchers — `toHaveCompleted`, `toHaveFailed`, `toBeWaitingAt`, `toHavePassed`,
    `toHavePassedInOrder`, `toHaveNotPassed`, `toHaveVariables` — registered by importing
    `@bpmnkit/engine/testing/vitest` (typed for Vitest's `Assertion`), or with
    `expect.extend(bpmnMatchers)` in Jest.
  - `coverage()` and `formatCoverage()` report the flow nodes and sequence flows the runs
    reached.

  `vitest` is an optional peer dependency, needed only for `@bpmnkit/engine/testing/vitest`.

- 56ad670: `runScenarioWasm` (and so `casen test`) now runs scenarios that the TypeScript `runScenario` runs. It completes native user tasks with the `userTask` mock, and it delivers the message a waiting receive task expects, with the subscription's correlation key, as the simulator passes a receive task. A `userTask` mock with `error` is reported as an error, and the task stays open. Expected variables are compared structurally, so the key order of an object no longer matters. The `.bpmn.tests.json` format is unchanged.

  **Behaviour change:** a scenario whose path ends in an error end event that nothing catches now reports the `UNHANDLED_ERROR_EVENT` incident as an error and fails, as the same model would stop with an incident on Camunda 8. Before, the error end event ended the instance silently. Catch the error (an error boundary event or an error event sub-process), or model the outcome as a plain end event.

### Patch Changes

- 56ad670: `adHocSubProcessElements` now has Zeebe's shape, as Zeebe's `AdHocSubProcessElementsVariableTest` defines it. A `fromAi()` parameter is named by its whole reference: `toolCall.orderId`, not `orderId`. A `fromAi()` call on any reference is listed (`fromAi(b)` gives `b`), and the arguments of a `fromAi()` call are not searched for more calls. A description or type must be a string literal, and a schema or options must be a context of literals. A field that is null or empty is left out, so an element without `zeebe:properties` has no `properties` key. An empty property value is `null`. `AdHocSubProcessElement`'s `elementName`, `documentation`, `properties` and `parameters` are optional, and `properties` values are `string | null`.

  `mockAiAgent` arguments keep the names a model sends: `{ orderId: "1042" }` for a `fromAi(toolCall.orderId)` parameter, as the AI Agent connector offers `toolCall.<name>` to the model as `<name>`. A tool call to a tool with a parameter the connector cannot offer (outside the `toolCall.` namespace, or nested) fails with the connector's message.

  This is a patch. `AdHocSubProcessElement`, `AdHocToolParameter`, `mockAiAgent` and the job worker's `adHocSubProcessElements` were added after 1.0.0, in the unreleased minor change "AI agents can be put under deterministic tests". No released version has the old shape. The fix makes the new API match its documentation, which describes the variable Zeebe creates. The release that ships both is a minor.

- 56ad670: A `fromAi()` call that Zeebe rejects at deployment now fails `Engine.deploy` with Zeebe's message, and nothing is deployed. Before, the call or its argument was left out of `adHocSubProcessElements`. The rules are those of Zeebe's `FromAiTaggedParameterExtractor`: the value must be a reference, the description and type must be string literals (`null` too is rejected), and the schema and options must be contexts of literals. The message is `Failed to extract ad-hoc activity parameters for element '<id>'. Expected fromAi() parameter 'description' to be a string, but received '10'.`, as Zeebe's `AdHocSubProcessTransformer` builds it. Reebe rejects the same calls with the same message.

  `buildAiAgentSubProcess` wrote `null` as the schema of an optional tool parameter without a schema (`fromAi(toolCall.urgent, "…", "boolean", null, { required: false })`). Zeebe rejects that deployment. It now writes an empty context, `{}`, which Zeebe accepts and leaves out of the tool's parameters.

  Both are patches: they fix output that Zeebe does not accept. `Engine.deploy` throws only for models that Zeebe would not deploy.

- 56ad670: `runScenarioWasm` fills in a business rule task's result variable from its own DMN evaluation also when Reebe left the variable `null`, not only when Reebe left it out. Reebe now applies a business rule task's output mappings, including the one the runner adds for the result variable, so a decision Reebe could not evaluate gives `null` instead of no variable. This is a patch: scenario results stay as they were.
- 56ad670: Descriptions and READMEs now say what each package does, with the numbers that back it.
  - `@bpmnkit/feel` states its conformance — 1,939 of the DMN TCK's 2,053 FEEL cases (94.4%) —
    instead of calling itself complete.
  - `@bpmnkit/engine` is described as a simulator for tests and demos, and its README lists the
    elements it executes and the ones it completes without their semantics.
  - `@bpmnkit/plugins` counts its 34 plugins and documents the seven the README left out.
  - `@bpmnkit/cli` declares `mcpName`, so `casen proxy mcp` can be listed in the MCP Registry.
  - `@bpmnkit/astro-shared`'s `Seo` component loads Cloudflare Web Analytics when a build sets
    `PUBLIC_CF_WEB_ANALYTICS_TOKEN`, and nothing otherwise.
  - The desktop app is named BPMN Kit, ships icons for every platform, finds its bundled AI
    server on Windows, and builds again: the proxy-rs build script still filtered on the
    pre-rename `@bpmn-sdk/proxy` package. Installers are attached to GitHub Releases.
  - The VS Code extension is packaged on every release and attached to GitHub Releases, and
    published to the Visual Studio Marketplace and Open VSX once their tokens are configured.

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
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
  - @bpmnkit/core@1.1.0
  - @bpmnkit/feel@1.1.0

## 1.0.0

### Major Changes

- 0ba6ef6: **1.0.0.** These twelve packages now carry the stability promise at
  https://bpmnkit.com/docs/getting-started/stability.

  A 1.0.0 is not a rewrite, it is a commitment: from here, `^1` means an upgrade will not move
  your code, and anything that would — a removed export, a narrowed return type, a generated
  document whose `semanticHash` shifts for the same input — waits for a 2.0.

  The bar was three things: a test suite that would catch the package's own breakage, a
  documentation page, and an API worth defending for a year. Twelve of the twenty-six published
  packages clear it. The other fourteen stay on 0.x deliberately — most are short of the first
  two conditions, and the rest are worked examples, scaffolders or generated builds with no API
  of their own to freeze. Joining later costs nothing, since 0.x → 1.0 breaks no one, so the bar
  was applied strictly rather than generously.

  Membership is not only prose: it lives in `STABLE` in `scripts/published-packages.mjs`, and
  `check-packages.mjs` enforces both directions — nothing on the list may lack tests or a
  documentation page, and nothing at 1.0.0 or above may be missing from the list. `api-surface.json`
  records every export of every package in the set, and CI fails a pull request that removes or
  renames one without saying so.

  ### Breaking
  - **`@bpmnkit/core`** — `BuildOptions.strict` is removed. It had been a deprecated alias for
    `explicitJoins` since that option was renamed; rename the call and the behaviour is
    identical. Deliberately taken now rather than carried into 1.0, where it would have been
    stuck until a 2.0. (`applyBpmnOperations`' unrelated `strict` option is untouched.)

  ### Fixed
  - **`@bpmnkit/core`** — parse failures now throw `ParseError`, as the package has always
    documented. They threw a bare `Error` at 35 of the 36 throw sites across the BPMN, DMN and
    Form parsers, so the `if (err instanceof ParseError)` branch `errors.ts` tells callers to
    write never ran. Additive: `ParseError extends BpmnSdkError extends Error`, so code that
    caught `Error` is unaffected and the documented check starts working.
  - **`@bpmnkit/feel`** — the README's Quick Start could not run. `evaluate` takes an
    `EvalContext` (`{ vars }`), not a bare object; `highlightFeel` returns an HTML string rather
    than tokens to iterate; `formatFeel` takes a parsed node, not source text; `annotate` returns
    classified tokens, not an AST; and `ParseError` is `{ message, start, end }`. Four of eight
    rows in its API table were wrong.

  ### Added
  - **`@bpmnkit/feel`** — `builtinNames()` and `getBuiltin()` are exported, so an editor can
    enumerate the 88 built-in functions without reaching into `dist/`.
  - Documentation pages for `@bpmnkit/plugins`, `@bpmnkit/feel`, `@bpmnkit/connectors` and
    `@bpmnkit/ascii`, which had none.
  - `engines.node` on every package in the set; only two declared one before.

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
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/core@1.0.0
  - @bpmnkit/feel@1.0.0

## 0.1.38

### Patch Changes

- Updated dependencies [191d4d2]
  - @bpmnkit/core@0.8.0

## 0.1.37

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/feel@0.1.0
  - @bpmnkit/core@0.7.1

## 0.1.36

### Patch Changes

- Updated dependencies [e096585]
  - @bpmnkit/core@0.7.0

## 0.1.35

### Patch Changes

- Updated dependencies [780e39d]
  - @bpmnkit/core@0.6.0

## 0.1.34

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

- Updated dependencies [53a9e25]
- Updated dependencies [9d412da]
- Updated dependencies [9d412da]
  - @bpmnkit/core@0.5.0
  - @bpmnkit/feel@0.0.21

## 0.1.33

### Patch Changes

- Updated dependencies [8fdc6d4]
  - @bpmnkit/core@0.4.0

## 0.1.32

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0

## 0.1.31

### Patch Changes

- Updated dependencies [00a65f5]
  - @bpmnkit/core@0.2.0

## 0.1.30

### Patch Changes

- 9cd1942: Improvements around AI integration
- Updated dependencies [9cd1942]
  - @bpmnkit/core@0.1.2
  - @bpmnkit/feel@0.0.20

## 0.1.29

### Patch Changes

- Updated dependencies [c8f04ae]
  - @bpmnkit/core@0.1.1

## 0.1.28

### Patch Changes

- Updated dependencies [b90111f]
- Updated dependencies [b90111f]
  - @bpmnkit/core@0.1.0

## 0.1.27

### Patch Changes

- Updated dependencies [5ea5318]
  - @bpmnkit/core@0.0.27

## 0.1.26

### Patch Changes

- Updated dependencies [c93b45d]
- Updated dependencies [c93b45d]
  - @bpmnkit/core@0.0.26

## 0.1.25

### Patch Changes

- Updated dependencies [7916980]
  - @bpmnkit/core@0.0.25

## 0.1.24

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations
- Updated dependencies [e9ac598]
- Updated dependencies [dcf850a]
- Updated dependencies [d6d1860]
  - @bpmnkit/core@0.0.24
  - @bpmnkit/feel@0.0.19

## 0.1.23

### Patch Changes

- Updated dependencies [[`c9aa98d`](https://github.com/bpmnkit/monorepo/commit/c9aa98d6430ec2022278631dae7c281aae9ae499), [`5897d0f`](https://github.com/bpmnkit/monorepo/commit/5897d0f77a9d29dc7e88c5123f467686ff6e1960)]:
  - @bpmnkit/core@0.0.23

## 0.1.22

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

- Updated dependencies [[`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c)]:
  - @bpmnkit/core@0.0.22
  - @bpmnkit/feel@0.0.18

## 0.1.21

### Patch Changes

- [#87](https://github.com/bpmnkit/monorepo/pull/87) [`6b3748a`](https://github.com/bpmnkit/monorepo/commit/6b3748a8a6b5dfde418c06873ec4412c5db6cec2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AIKit extensions

## 0.1.20

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40)]:
  - @bpmnkit/core@0.0.21
  - @bpmnkit/feel@0.0.17

## 0.1.19

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

- Updated dependencies [[`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2)]:
  - @bpmnkit/reebe-wasm@0.1.2
  - @bpmnkit/core@0.0.20
  - @bpmnkit/feel@0.0.16

## 0.1.18

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af)]:
  - @bpmnkit/core@0.0.19
  - @bpmnkit/feel@0.0.15

## 0.1.17

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

- Updated dependencies [[`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08)]:
  - @bpmnkit/reebe-wasm@0.1.1
  - @bpmnkit/core@0.0.18
  - @bpmnkit/feel@0.0.14

## 0.1.16

### Patch Changes

- Updated dependencies [[`3f3b8f7`](https://github.com/bpmnkit/monorepo/commit/3f3b8f777cfb192582452757d86dc53b3de8059d)]:
  - @bpmnkit/core@0.0.17

## 0.1.15

### Patch Changes

- Updated dependencies [[`270078c`](https://github.com/bpmnkit/monorepo/commit/270078c52fce2c2a567fa1b4b9d6de8001c6f18e)]:
  - @bpmnkit/core@0.0.16

## 0.1.14

### Patch Changes

- [#58](https://github.com/bpmnkit/monorepo/pull/58) [`4953231`](https://github.com/bpmnkit/monorepo/commit/49532315a01c884d2a50375e6ea0148d6e294034) Thanks [@urbanisierung](https://github.com/urbanisierung)! - UX improvements

- Updated dependencies [[`4953231`](https://github.com/bpmnkit/monorepo/commit/49532315a01c884d2a50375e6ea0148d6e294034)]:
  - @bpmnkit/core@0.0.15

## 0.1.13

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

- Updated dependencies [[`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db)]:
  - @bpmnkit/core@0.0.14
  - @bpmnkit/feel@0.0.13

## 0.1.12

### Patch Changes

- Updated dependencies [[`7918d12`](https://github.com/bpmnkit/monorepo/commit/7918d120740b85a2c4a363ff7dd9605d4f0f8a0d)]:
  - @bpmnkit/core@0.0.13

## 0.1.11

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

- Updated dependencies [[`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283)]:
  - @bpmnkit/core@0.0.12
  - @bpmnkit/feel@0.0.12

## 0.1.10

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

- Updated dependencies [[`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b)]:
  - @bpmnkit/core@0.0.11
  - @bpmnkit/feel@0.0.11

## 0.1.9

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

- Updated dependencies [[`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837)]:
  - @bpmnkit/core@0.0.10
  - @bpmnkit/feel@0.0.10

## 0.1.8

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

- Updated dependencies [[`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a)]:
  - @bpmnkit/core@0.0.9
  - @bpmnkit/feel@0.0.9

## 0.1.7

### Patch Changes

- [#34](https://github.com/bpmnkit/monorepo/pull/34) [`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design changes

- Updated dependencies [[`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19)]:
  - @bpmnkit/core@0.0.8
  - @bpmnkit/feel@0.0.8

## 0.1.6

### Patch Changes

- [#32](https://github.com/bpmnkit/monorepo/pull/32) [`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate and CLI improvements

- Updated dependencies [[`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64)]:
  - @bpmnkit/core@0.0.7
  - @bpmnkit/feel@0.0.7

## 0.1.5

### Patch Changes

- [#30](https://github.com/bpmnkit/monorepo/pull/30) [`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate, CLI, api

- Updated dependencies [[`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e)]:
  - @bpmnkit/core@0.0.6
  - @bpmnkit/feel@0.0.6

## 0.1.4

### Patch Changes

- [#28](https://github.com/bpmnkit/monorepo/pull/28) [`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec) Thanks [@urbanisierung](https://github.com/urbanisierung)! - SDK improvements, operate, editor UX improvements

- Updated dependencies [[`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec)]:
  - @bpmnkit/core@0.0.5
  - @bpmnkit/feel@0.0.5

## 0.1.3

### Patch Changes

- [#26](https://github.com/bpmnkit/monorepo/pull/26) [`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Docs, Logo, AI improvements

- Updated dependencies [[`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156)]:
  - @bpmnkit/core@0.0.4
  - @bpmnkit/feel@0.0.4

## 0.1.2

### Patch Changes

- [`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Fix package.json

- Updated dependencies [[`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a)]:
  - @bpmnkit/core@0.0.3
  - @bpmnkit/feel@0.0.3

## 0.1.1

### Patch Changes

- [#22](https://github.com/bpmnkit/monorepo/pull/22) [`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072) Thanks [@urbanisierung](https://github.com/urbanisierung)! - First ready features.

- Updated dependencies [[`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072)]:
  - @bpmnkit/core@0.0.2
  - @bpmnkit/feel@0.0.2

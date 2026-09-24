---
title: Testing Processes
description: Unit-test BPMN processes in Vitest or Jest with @bpmnkit/engine/testing — job and connector mocks, manual job completion, a virtual clock for timers, BPMN matchers and path coverage. No Docker, no cluster.
sidebar:
  order: 15
---

Camunda's own process-testing library, Camunda Process Test, is written for Java, and its
JavaScript port starts a Zeebe container. `@bpmnkit/engine/testing` gives TypeScript teams
the same style of test without either. It runs your BPMN on the in-process
[simulator](/docs/guides/simulation), so a test file is ordinary Vitest or Jest and a whole
suite finishes in milliseconds.

It gives you:

- **Job mocks** by job type, with fixed results, failures, BPMN errors or a handler.
- **Manual job completion** for tasks you want to drive step by step, user tasks included.
- **Connector mocks** that map a fake response through the task's `resultVariable` and
  `resultExpression`, the same way the connector runtime does.
- **A virtual clock.** `advanceTime("P1D")` fires timers at once, with no real waiting.
- **Matchers** such as `toHaveCompleted()`, `toHavePassed([...])` and
  `toHaveVariables({...})`.
- **Path coverage** of the flow nodes and sequence flows your runs reached.

The simulator is not Zeebe. Before you rely on a test, read
[what the simulator does not execute](#what-the-simulator-does-not-execute).

## Install

```sh
npm install --save-dev @bpmnkit/engine vitest
```

`vitest` is an optional peer dependency. It is needed only for the
`@bpmnkit/engine/testing/vitest` entry point. Jest users do not need it.

## A complete Vitest example

```typescript
// order-process.test.ts
import { afterAll, beforeAll, expect, it } from "vitest"
import "@bpmnkit/engine/testing/vitest"
import { createProcessTest, formatCoverage } from "@bpmnkit/engine/testing"
import type { ProcessTest } from "@bpmnkit/engine/testing"

let t: ProcessTest

beforeAll(async () => {
  t = await createProcessTest({
    bpmn: new URL("./order-process.bpmn", import.meta.url),
    dmn: new URL("./discount.dmn", import.meta.url), // optional
  })
})

afterAll(() => {
  console.log(formatCoverage(t.coverage()))
  t.dispose()
})

it("ships a paid order", async () => {
  t.mockJob("payment", { result: { paid: true } })

  const run = await t.start("order-process", { amount: 10 })
  expect(run).toBeWaitingAt("ship") // "ship" has no mock, so its job waits

  await run.completeJob("ship", { trackingId: "1Z999" })

  expect(run).toHaveCompleted()
  expect(run).toHavePassedInOrder(["payment", "ship"])
  expect(run).toHaveVariables({ paid: true, trackingId: expect.any(String) })
})

it("cancels an unpaid order", async () => {
  t.mockJob("payment", { result: { paid: false } })

  const run = await t.start("order-process", { amount: 10 })

  expect(run).toHaveCompleted()
  expect(run).toHaveNotPassed(["ship"])
})
```

`createProcessTest` accepts parsed definitions, XML text, a file path or a `file:` URL for
`bpmn`, `dmn` and `forms`. Each can also be an array. A relative path resolves against the
working directory, so `new URL("./x.bpmn", import.meta.url)` is the reliable choice.

`start()` and every action on a run (`completeJob`, `publishMessage`, `advanceTime` and the
others) return after the process has run as far as it can without more input. You never
need to add a wait or a poll.

### Vitest setup

Import `@bpmnkit/engine/testing/vitest` once. This registers the matchers and adds their
types to Vitest's `Assertion`. To register them for every file, use a setup file:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { setupFiles: ["@bpmnkit/engine/testing/vitest"] },
})
```

If you use a setup file, add `import "@bpmnkit/engine/testing/vitest"` to a `.d.ts` file
in your project too, so that TypeScript sees the matcher types.

### Jest setup

The matchers are plain `expect.extend` matchers. Register them in a setup file and add
their types to Jest's `Matchers`:

```typescript
// jest.setup.ts  (add to "setupFilesAfterEnv" in jest.config)
import { expect } from "@jest/globals"
import { bpmnMatchers } from "@bpmnkit/engine/testing"
import type { BpmnMatchers } from "@bpmnkit/engine/testing"

expect.extend(bpmnMatchers)

declare module "expect" {
  interface Matchers<R> extends BpmnMatchers<R> {}
}
```

If you use `@types/jest` globals, declare the types with
`declare global { namespace jest { interface Matchers<R> extends BpmnMatchers<R> {} } }`.
The package ships ES modules, so run Jest in its ESM mode or through a transformer that
handles ESM.

## Jobs

Each job type in the deployed BPMN gets a worker. What the worker does depends on whether
the type has a mock:

- **Mocked**: the mock handles the job.
- **Not mocked**: the job waits. You complete it with `run.completeJob(...)`, as Zeebe
  would wait for a worker.

```typescript
t.mockJob("payment", { result: { paid: true } })                   // complete with variables
t.mockJob("payment", { fail: "card declined" })                    // fail the job
t.mockJob("payment", { throwError: { code: "DECLINED" } })         // throw a BPMN error
t.mockJob("payment", (job) => ({ paid: job.variables.amount < 100 })) // compute; throw to fail

const payment = t.mockJob("payment", { result: { paid: true } })
payment.calls           // every job the mock handled: elementId, variables, headers, ...
payment.restore()       // later jobs of this type wait for completeJob again
```

To drive a waiting job, name its element id or its job type:

```typescript
run.jobs                                   // [{ elementId: "ship", type: "ship", ... }]
await run.completeJob("ship", { trackingId: "1Z999" })
await run.failJob("ship", "carrier down")
await run.throwError("ship", "NO_STOCK", "Out of stock")
```

A Camunda user task (`zeebe:userTask`, no job type) is a job of type `userTask`. Complete
it by its element id: `await run.completeJob("review", { approved: true })`. If no job is
waiting at the id, the error lists the jobs and elements that are waiting.

## Connectors

An outbound connector is a job whose type is the connector's id. Use `mockConnector` with
the response the connector would return. The element's `resultVariable` and
`resultExpression` headers map that response into variables:

```typescript
t.mockConnector("io.camunda:http-json:1", {
  response: { status: 200, body: { main: { temp: 21.5 } } },
})
// resultVariable "weather"          → weather = the whole response
// resultExpression "={temp: body.main.temp}" → temp = 21.5
```

The response's fields are in scope in `resultExpression`, and `response` is too. The
expression must produce a context. A `null` result maps nothing. A handler
`(job) => response` and the `{ fail }` and `{ throwError }` forms also work.
`mapConnectorResponse(response, headers)` is exported if you want the mapping on its own.
`errorExpression` is not evaluated.

## AI agents

An [AI Agent sub-process](/docs/guides/ai-agents) runs as a job of type
`io.camunda.agenticai:aiagent-job-worker:1`. Mock it as a black box with the output you
want the agent to produce:

```typescript
t.mockJob("io.camunda.agenticai:aiagent-job-worker:1", {
  result: { agent: { responseText: "Refund approved" } },
})
```

**Gap:** the simulator does not run the tool elements inside an ad-hoc sub-process. For
that reason, you cannot mock which tools the agent selects, and coverage reports the tools
as not reached.

## Messages

```typescript
const run = await t.start("order-process")
await run.publishMessage("payment-confirmed") // the bpmn:message name, or its id
```

A message goes to the run you publish it on. If nothing in that run waits for the message,
`publishMessage` throws. **Gaps:** a message cannot carry variables, and correlation keys
are not evaluated. To set the variables a message would carry, complete an earlier job
with them.

## The virtual clock

A `ProcessTest` puts engine timers on a virtual clock. A timer fires only when you advance
the clock:

```typescript
const t = await createProcessTest({ bpmn, startTime: "2026-06-01T00:00:00Z" })
const run = await t.start("reminder-process")
expect(run).toBeWaitingAt("wait_one_day")

await t.advanceTime("PT23H")   // ISO 8601 duration, or milliseconds
expect(run).toBeWaitingAt("wait_one_day")

await t.advanceTime("PT1H")
expect(run).toHaveCompleted()
t.now()                        // 2026-06-02T00:00:00.000Z
```

`advanceTime` fires the timers that fall due in order. After each timer, the processes run
before the next timer fires. Thus a boundary timer that interrupts a task has an effect
before a later timer fires. `run.advanceTime(...)` is the same call. `startTime` sets where
the clock starts. The default is the real time when the test is created. Set it when a
timer uses an absolute `timeDate`.

The test helpers do not use fake timers, so `vi.useFakeTimers()` is not necessary. It also
does not block them if your own code uses it. Call `dispose()` in `afterAll`: it returns
engine timers to the real clock and cancels the runs that are still active.

## Coverage

`t.coverage()` counts the flow nodes that the file's runs entered and the sequence flows
they took:

```typescript
const report = t.coverage()
report.elements        // { total: 14, covered: 12, percent: 85.7, uncovered: ["end_cancel", ...] }
report.flows           // the same, for sequence flows
report.processes       // one entry per deployed process

console.log(formatCoverage(report))
// BPMN coverage
//   order-process  elements 12/14 (85.7%)  flows 13/15 (86.7%)
//     elements not reached: end_cancel, notify_customer
//     flows not taken: Flow_unpaid, Flow_notify
```

The simulator's events name elements but not flows. For this reason, the taken flows are
inferred: a parallel join counts all its incoming flows, and any other element counts the
incoming flow from the source that completed most recently. For sequential paths the result
is exact. Elements inside sub-processes are counted, and data objects are not.

## Matchers

| Matcher | Passes when |
|---|---|
| `toHaveCompleted()` | The instance ended normally |
| `toHaveFailed(error?)` | The instance failed. `error` is a substring or a `RegExp` |
| `toBeWaitingAt(ids)` | Each listed element holds a token now |
| `toHavePassed(ids)` | Each listed element completed at least once, in any order |
| `toHavePassedInOrder(ids)` | The elements completed in this order. Other elements can come between them |
| `toHaveNotPassed(ids)` | None of the listed elements completed |
| `toHaveVariables(vars)` | Each listed variable is equal. Asymmetric matchers such as `expect.any(Number)` work |

Every matcher works with `.not`. When a matcher fails, the message gives the run's state,
its error, the elements that wait and the elements that completed.

## What the simulator does not execute

The tests are only as good as the simulator's coverage of your model. Read
[Conformance](/docs/getting-started/conformance) for the element-by-element list. The gaps
most likely to affect a test are:

- Some elements complete without their semantics, or are not modelled. See the conformance
  table for which elements are affected.
- A BPMN error thrown from a job (`{ throwError }` or `run.throwError`) fails the instance.
  An error boundary event on the task does not catch it.
- A variable that is first written inside an embedded sub-process stays local to that
  sub-process and is lost when it completes. Zeebe propagates it to the process. To keep
  such a variable, pass it as a start variable.
- Message variables and correlation keys (see [Messages](#messages)).
- Tools inside an ad-hoc sub-process (see [AI agents](#ai-agents)).

Engine timers are module-level, so the `ProcessTest` created last drives them until it is
disposed. Use one `ProcessTest` for each test file. This is the `beforeAll` pattern above.
Vitest runs each file in isolation.

### Zeebe semantics (future)

`@bpmnkit/engine/wasm-runner` runs `.bpmn.tests.json` scenarios on Reebe, which has more
of Zeebe's semantics. A `mode: "wasm"` option for `createProcessTest` is planned but not
yet available. The runner drives a scenario from start to end in one call. Also, the
current Reebe build does not open message subscriptions and does not record job variables
in the way that step-by-step testing needs.

## See also

- [Simulation](/docs/guides/simulation): the `Engine` API under these helpers.
- `casen test`: runs the `.bpmn.tests.json` scenario sidecars that `casen synth` writes,
  without a test runner.

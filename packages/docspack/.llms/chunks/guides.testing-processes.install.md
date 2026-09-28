# Testing Processes — Install

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

---
Source: https://bpmnkit.com/docs/guides/testing-processes

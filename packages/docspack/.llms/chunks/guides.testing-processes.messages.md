# Testing Processes — Messages

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

---
Source: https://bpmnkit.com/docs/guides/testing-processes

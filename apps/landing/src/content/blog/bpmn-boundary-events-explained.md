---
title: "BPMN boundary events, explained with code"
description: "What a boundary event actually models, interrupting vs. non-interrupting, and how @bpmnkit/core's withBoundary() attaches an error path without losing the main flow."
pubDate: 2026-07-03
author: "BPMN Kit"
tags: ["bpmn", "boundary-events", "core"]
---

Boundary events are one of the more confusing BPMN elements to read — and, by hand, one
of the more error-prone to author — because they attach to the *border* of a task rather
than sitting inline in the sequence flow. Here's what they model, and how to build them
without losing track of the main path.

See also: [Boundary Event in the BPMN glossary](https://learn.bpmnkit.com/glossary/boundary-event)
for the visual diagram version of this concept.

## What a boundary event models

A boundary event sits on the edge of a task or sub-process and catches something —
an error, a timeout, a message — *while that task is active*. If the event fires, the
token diverts onto whatever path is attached to the boundary event, instead of
continuing normally out of the task.

The two flavors that matter most:

- **Interrupting** (solid-circle boundary) — firing the event cancels the task it's
  attached to. Used for genuine failures: a payment that errors out shouldn't keep
  "running" after you've already routed to a failure path.
- **Non-interrupting** (dashed-circle boundary) — the task keeps running alongside the
  new path. Used for things like an escalation notification: you want to alert someone
  *and* let the original task still complete normally.

## The authoring problem

Hand-writing this in raw BPMN XML — or even in a naive builder API — is easy to get
subtly wrong: after attaching the boundary event's error path, you have to remember to
move the "current element" cursor back to the *task*, not the end of the error path, so
the next `.serviceTask(...)` call you make continues the main flow instead of extending
the error branch.

`@bpmnkit/core`'s `withBoundary()` handles that bookkeeping for you:

```typescript
import { Bpmn } from "@bpmnkit/core";

const xml = Bpmn.export(
  Bpmn.createProcess("payment-flow")
    .startEvent("start")
    .serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
    .withBoundary("on-fail", { errorCode: "PAYMENT_FAILED" }, (p) =>
      p.serviceTask("notify", { taskType: "send-email" }).endEvent("end-failed"),
    )
    // the cursor is back on "charge" here — this continues the MAIN flow,
    // not the error path
    .serviceTask("fulfill", { name: "Fulfill Order", taskType: "warehouse-pick" })
    .endEvent("end-ok")
    .withAutoLayout()
    .build()
);
```

The callback passed to `withBoundary()` is scoped to the error path — everything inside
it builds the "what happens if this fails" branch — and once that callback returns, the
outer chain is back on the task the boundary is attached to.

## Testing the error path

Because the error path is just another sequence of tasks, it's testable the same way as
any other branch — [simulate the process](/blog/simulate-bpmn-process-without-camunda)
and have the mocked `payment-charge` job worker reject, then assert the token reaches
`end-failed` rather than `end-ok`.

## Where to go next

- [Boundary Event glossary entry](https://learn.bpmnkit.com/glossary/boundary-event) — the visual reference
- [Generate BPMN 2.0 diagrams programmatically](/blog/generate-bpmn-diagrams-programmatically-typescript)
- [Simulate a BPMN process without Camunda](/blog/simulate-bpmn-process-without-camunda)

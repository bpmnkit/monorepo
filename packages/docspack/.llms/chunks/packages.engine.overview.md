# @bpmnkit/engine — Overview

`@bpmnkit/engine` is a lightweight BPMN 2.0 process *simulator* that runs entirely in the
JavaScript runtime — no external services required. It is built for tests, demos and
step-through debugging, not for running production processes.

**What the TypeScript simulator executes:**
- Service and user tasks (dispatched to registered job workers), script tasks (FEEL),
  business rule tasks (DMN); manual, send, receive and plain tasks pass straight through
- Exclusive (with default flow), parallel and inclusive gateways
- None start events; none, terminate and error end events
- Intermediate catch events: timer (ISO 8601 duration, date and cycle) and message
- Boundary events: interrupting timer, and error
- Embedded sub-processes and transactions, with child variable scopes
- Zeebe IO mappings, and DMN decisions through `@bpmnkit/feel`

**What it does not execute.** Call activities, event sub-processes, event-based and complex
gateways, and ad-hoc sub-processes without a task definition are *completed without their
semantics* — the token moves on. Signal, escalation, compensation, conditional and link
events, multi-instance, message boundary events and non-interrupting boundary events are not
modelled. For Zeebe semantics, `@bpmnkit/engine/wasm-runner` runs the same scenarios on the
Reebe engine compiled to WebAssembly (experimental).

Zero runtime dependencies. ESM-only.

---
Source: https://bpmnkit.com/docs/packages/engine

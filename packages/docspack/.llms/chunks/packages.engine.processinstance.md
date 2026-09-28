# @bpmnkit/engine — ProcessInstance

| Property | Type | Description |
|---|---|---|
| `state` | `"active" \| "completed" \| "terminated" \| "failed"` | Current lifecycle state |
| `activeElements` | `string[]` | IDs of currently active elements |
| `variables_snapshot` | `Record<string, unknown>` | Current variable state |
| `beforeComplete` | `(id: string) => Promise<void>` | Override step hook |

| Method | Description |
|---|---|
| `instance.onChange(cb)` | Subscribe to state changes |
| `instance.cancel()` | Cancel the running instance |
| `instance.deliverMessage(name, vars?, correlationKey?)` | Correlate a message to the oldest waiting subscription — catch event, boundary event, event-based gateway branch or event sub-process. `name` matches the message's name or id. With a `correlationKey`, only a subscription whose `zeebe:subscription` correlation key (on the event or its message, evaluated when the subscription opened) equals it matches. Falls through to running call-activity children. Returns whether anything received it |
| `instance.deliverSignal(name, vars?)` | Deliver a signal to this instance only |

Besides `element:entering` / `entered` / `leaving` / `left`, `variable:set`, `job:created`,
`feel:evaluated` and the `process:*` events, `onChange` reports `element:terminated` when an
interrupting event, a terminate end event or a multi-instance completion condition cancels
an element, and `element:warning` when the simulator skips something it cannot run.

---
Source: https://bpmnkit.com/docs/packages/engine

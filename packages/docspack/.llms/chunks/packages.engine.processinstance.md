# @bpmnkit/engine — ProcessInstance

| Property | Type | Description |
|---|---|---|
| `state` | `"running" \| "completed" \| "cancelled"` | Current lifecycle state |
| `activeElements` | `Set<string>` | IDs of currently active elements |
| `variables_snapshot` | `Record<string, unknown>` | Current variable state |
| `beforeComplete` | `(id: string) => Promise<void>` | Override step hook |

| Method | Description |
|---|---|
| `instance.onChange(cb)` | Subscribe to state changes |
| `instance.cancel()` | Cancel the running instance |
| `instance.deliverMessage(name, vars?)` | Correlate a message to a waiting event |

---
Source: https://docs.bpmnkit.com/packages/engine/

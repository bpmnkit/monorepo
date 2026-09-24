---
"@bpmnkit/reebe-wasm": patch
---

Messages now correlate and job results reach the process. `publish_message` sends the field the engine reads (`messageName`), a `zeebe:subscription` correlation key is evaluated with FEEL when the subscription opens (on the event or on its root `<message>`, receive tasks included), a correlated message's variables are merged into the process, and a completed job's variables are merged when the task has no output mappings — as Zeebe does.

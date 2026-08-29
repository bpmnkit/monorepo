# @bpmnkit/engine — Overview

`@bpmnkit/engine` is a lightweight BPMN 2.0 process engine that runs entirely in the
JavaScript runtime — no external services required.

**Supported BPMN elements:**
- Service tasks, user tasks, script tasks, manual tasks
- Exclusive, parallel, inclusive, and event-based gateways
- Timer events (ISO 8601 duration, date, and cycle)
- Message correlation (intermediate catch events, message start)
- DMN decision evaluation (requires `@bpmnkit/core`)
- Boundary events (timer, error, message)
- Call activities (inline subprocess invocation)
- IO variable mappings (Zeebe `zeebe:ioMapping` extension)

Zero runtime dependencies. ESM-only.

---
Source: https://bpmnkit.com/docs/packages/engine

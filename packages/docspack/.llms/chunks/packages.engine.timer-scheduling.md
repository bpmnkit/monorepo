# @bpmnkit/engine — Timer Scheduling

Timers use `setTimeout` internally and support ISO 8601 formats:

```
PT30S       → 30 seconds
PT1H30M     → 1.5 hours
P2D         → 2 days
R3/PT1H     → repeat 3 times, every hour
2026-12-01T09:00:00Z  → fire at absolute date
```

Call `parseDurationMs(str)` from `@bpmnkit/engine` to convert duration strings
to milliseconds in your own code.

---
Source: https://bpmnkit.com/docs/packages/engine

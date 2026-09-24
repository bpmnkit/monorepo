# Testing Processes — Coverage

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

---
Source: https://bpmnkit.com/docs/guides/testing-processes

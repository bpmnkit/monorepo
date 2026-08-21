# Building Processes with AI — Extending an existing process

```
/bpmnkit:extend invoice-approval.bpmn add a timeout boundary event to the approval task
```

This lifts the process back into plan form (`casen plan extract`), writes a small delta plan touching only the changed step, and merges it in (`casen synth --merge`) — the diff is reported at the element level, not as an XML diff.

---
Source: https://docs.bpmnkit.com/guides/ai-implement/

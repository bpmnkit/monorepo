# Testing AI Agents — Tool coverage

The tools are elements, so `coverage().elements` counts them. `coverage().tools` counts only
the tools, which are the elements that an AI agent can activate:

```typescript
t.coverage().tools   // { total: 3, covered: 2, percent: 66.7, uncovered: ["create-ticket"] }

console.log(formatCoverage(t.coverage()))
// BPMN coverage
//   ai-agent-tool-loop  elements 7/13 (53.8%)  flows 4/8 (50.0%)  tools 2/3 (66.7%)
//     elements not reached: create-ticket, agent-failed, queue-for-human, ...
//     flows not taken: ...
//     tools never called: create-ticket
```

A tool that no test calls is a path that no test covers.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents

# @bpmnkit/core — Installation — Ad-hoc sub-processes: children are a set, not a chain

Sequential calls in a builder chain auto-connect with sequence flows. Inside
`.adHocSubProcess()` they do not: BPMN defines an ad-hoc sub-process's children as an unordered
set of independently-invocable activities, and Camunda 8's agentic AI runtime reads that
structurally — a child *without* an incoming flow is an LLM-invocable tool, a child *with* one
is part of an internal sub-flow and not a tool at all.

```typescript
.adHocSubProcess("agent", (s) => {
  s.serviceTask("listUsers",  { taskType: "io.camunda:http-json:1" });
  s.serviceTask("loadUser",   { taskType: "io.camunda:http-json:1" });
  s.serviceTask("createUser", { taskType: "io.camunda:http-json:1" });
}, { name: "Handle request" })
// → three tools, no sequence flows, no <bpmndi:BPMNEdge> between them
```

Auto-chaining them produced a file that lints clean and deploys, while the agent saw one tool
and a two-step sub-flow — so the default is off rather than opt-out.

An internal sub-flow inside the container stays expressible: say so with `.connectTo()`, which
still creates a flow from the cursor.

```typescript
.adHocSubProcess("agent", (s) => {
  s.serviceTask("listUsers", { taskType: "io.camunda:http-json:1" });   // a tool
  s.serviceTask("step1", { taskType: "work" }).connectTo("step2");      // an internal sub-flow
  s.serviceTask("step2", { taskType: "work" });
})
```

Each child's LLM-facing description is its `documentation`, which every builder method accepts:

```typescript
s.serviceTask("listUsers", {
  taskType: "io.camunda:http-json:1",
  documentation: "Call this to retrieve all users. Returns id, name, email.",
});
```

---
Source: https://bpmnkit.com/docs/packages/core

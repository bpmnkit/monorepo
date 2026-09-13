---
"@bpmnkit/core": minor
---

Ad-hoc sub-process children are a set, not a chain — and documentation survives the operations API

Two silent failures, both hit while authoring a Camunda 8 agentic-AI process through
the SDK.

- **`.adHocSubProcess()` no longer auto-connects its children.** It used to chain them
  like any other builder chain. BPMN defines an ad-hoc sub-process's children as an
  unordered set of independently-invocable activities, and Camunda 8's agentic runtime
  reads that structurally: a child *without* an incoming flow is an LLM-invocable tool,
  a child *with* one is part of an internal sub-flow and not a tool. Declaring three
  tools produced one tool plus a two-step sub-flow, in a file that lints clean and
  deploys. Sequential calls now emit no sequence flow, no `bpmn:incoming`/`bpmn:outgoing`
  and no `<bpmndi:BPMNEdge>`.

  **Breaking for anyone who relied on the chaining.** An internal sub-flow inside the
  container stays expressible with `.connectTo()`, which still creates a flow from the
  cursor.

- **`compactify()`/`expand()` carry `<bpmn:documentation>`.** The compact model had no
  field for it, so the text left the document with no error and no warning — one
  `rename` op cost a file the documentation of every element in it, on the API whose
  purpose is surgical edits. It is now carried on every element type, nested ones
  included, and on the process itself. `{ op: "update", patch: { documentation } }`
  sets it, on the compact model and on the full one.

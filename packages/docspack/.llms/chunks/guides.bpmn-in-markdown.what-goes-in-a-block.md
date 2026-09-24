# BPMN Diagrams in Markdown — What goes in a block

| Fence | Contents |
|---|---|
| ` ```bpmn ` | BPMN 2.0 XML — a whole `.bpmn` file. If it carries diagram interchange (`<bpmndi:BPMNDiagram>`), that layout is drawn as it is; if the DI is missing or incomplete, the diagram is laid out automatically. |
| ` ```bpmn-compact ` | The [compact JSON format](/docs/getting-started/concepts) that `compactify()` produces and language models write. A single process can skip the `{ "id", "processes": [...] }` wrapper, as above. Always laid out automatically. |
| ` ```bpmn-json ` | An alias of `bpmn-compact`. |

There is no text DSL: the compact JSON already is the short form, and it is the same format
the rest of BPMN Kit and your AI tooling speak.

One fence attribute is read: `title="…"` sets the diagram's accessible name. Without it the
name is the process's `name`, then the first pool's, then the process id.

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown

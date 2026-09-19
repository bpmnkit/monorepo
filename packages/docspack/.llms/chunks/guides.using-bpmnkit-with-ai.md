# Using BPMN Kit with AI

An agent asked to turn a folder of specs into a deployable process needs three
different kinds of knowledge, and only one of them is in its weights:

| It needs to know | Where that lives | How it asks |
| --- | --- | --- |
| How to drive this library | `@bpmnkit/docspack` | `bpmnkit-docs ask "…"` |
| How the engine behaves | `@bpmnkit/camunda-docspack` | `bpmnkit-docs ask "…" --pack @bpmnkit/camunda-docspack` |
| What the process actually does | your own Markdown | index it yourself, below |

All three are offline retrieval. Nothing here calls a model, starts a server or
touches the network, so a question costs milliseconds and no tokens. The model
is only spent on the last step — turning what it found into a diagram.

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai

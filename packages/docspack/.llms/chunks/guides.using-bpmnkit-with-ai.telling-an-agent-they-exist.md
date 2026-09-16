# Using BPMN Kit with AI — Telling an agent they exist

An agent that does not know a pack is installed will answer from memory instead,
and its memory describes an older release. One paragraph in `AGENTS.md`,
`CLAUDE.md` or `.cursor/rules` is the whole setup — **name both packs**, because
an agent told only about the first will never think to ask the second:

```md
Documentation is installed locally. Ask it before answering from memory.

- BPMN Kit's own APIs, CLI and guides:
  `npx bpmnkit-docs ask "<question>"`
- Camunda 8 — BPMN semantics, FEEL, engine behaviour, the REST API:
  `npx bpmnkit-docs ask "<question>" --pack @bpmnkit/camunda-docspack`

A returned chunk beats recalled knowledge: it describes the version this project
installed. If the two disagree, the chunk is right — do not blend them.
Answers cap at 3 chunks / 3,000 tokens, so ask several narrow questions rather
than one broad one.
```

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai

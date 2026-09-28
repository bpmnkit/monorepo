---
"@bpmnkit/markdown": minor
---

New package: real BPMN diagrams in Markdown. Fenced ` ```bpmn ` (BPMN 2.0 XML, laid out
automatically when it has no DI) and ` ```bpmn-compact ` / ` ```bpmn-json ` (compact JSON) blocks
render to inline SVG at build time — themed from the page's `--bpmnkit-*` tokens or the reader's
colour scheme, labelled for screen readers with the process name and its steps, and drawn as a
readable error box instead of breaking the build when a block does not parse.

One function, `renderBpmnBlock()`, with thin adapters over it: `remarkBpmn` (Astro, Docusaurus,
Next.js MDX — it emits hast, so MDX renders it too), `markdownItBpmn` (VitePress),
`renderBpmnInHtml` for plain HTML pipelines, and the `bpmnkit-md` CLI, which pre-renders the
blocks of a README to committed SVG files between markers, idempotently, with `--check` for CI.
No dependencies beyond `@bpmnkit/core`.

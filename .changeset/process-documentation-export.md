---
"@bpmnkit/core": minor
"@bpmnkit/editor": minor
"@bpmnkit/cli": minor
"@bpmnkit/drop": patch
---

Process documentation export: a document to circulate, built from the model.

`@bpmnkit/core` adds `renderDocumentationHtml`, `renderDocumentationMarkdown` and `renderDocumentationDocx`. They take parsed definitions plus optional DMN decisions and forms. The HTML is self-contained and print-ready: an inline SVG diagram on a landscape page, a table of contents, and a section per process or pool. Each section has its lanes, a steps table and a detail block for every element in flow order: type, documentation, lane, job type, headers, mappings, called decision, called process, form, assignment, timers, messages, errors and the conditions on outgoing flows. The decision tables and form fields follow. Print → Save as PDF gives a clean PDF on A4 or Letter. Markdown has the same content without the diagram. The Word file is a small hand-written OOXML package with the diagram as SVG. `buildProcessDocumentation` returns the structured content, and `documentationToHtml`, `documentationToMarkdown` and `documentationToDocx` render it. Output is deterministic and all model text is escaped.

`@bpmnkit/editor`: the HUD's More menu has **Export documentation…**. It offers a print view, HTML, Markdown and Word. The new `getDocumentationContext` option on `initEditorHud` supplies the linked decisions and forms. All new strings go through the editor's `translate` hook.

`@bpmnkit/cli`: `casen doc export <file.bpmn> [linked .dmn/.form…] --format html|md|docx [--out] [--title] [--paper a4|letter]`.

`@bpmnkit/drop`: a shared drop has a **Docs** button for anyone who can read it. It documents the drop's BPMN file together with every DMN and form file in the drop.

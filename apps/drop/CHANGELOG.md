# @bpmnkit/drop

## 0.0.12

### Patch Changes

- 56ad670: Process documentation export: a document to circulate, built from the model.

  `@bpmnkit/core` adds `renderDocumentationHtml`, `renderDocumentationMarkdown` and `renderDocumentationDocx`. They take parsed definitions plus optional DMN decisions and forms. The HTML is self-contained and print-ready: an inline SVG diagram on a landscape page, a table of contents, and a section per process or pool. Each section has its lanes, a steps table and a detail block for every element in flow order: type, documentation, lane, job type, headers, mappings, called decision, called process, form, assignment, timers, messages, errors and the conditions on outgoing flows. The decision tables and form fields follow. Print → Save as PDF gives a clean PDF on A4 or Letter. Markdown has the same content without the diagram. The Word file is a small hand-written OOXML package with the diagram as SVG. `buildProcessDocumentation` returns the structured content, and `documentationToHtml`, `documentationToMarkdown` and `documentationToDocx` render it. Output is deterministic and all model text is escaped.

  `@bpmnkit/editor`: the HUD's More menu has **Export documentation…**. It offers a print view, HTML, Markdown and Word. The new `getDocumentationContext` option on `initEditorHud` supplies the linked decisions and forms. All new strings go through the editor's `translate` hook.

  `@bpmnkit/cli`: `casen doc export <file.bpmn> [linked .dmn/.form…] --format html|md|docx [--out] [--title] [--paper a4|letter]`.

  `@bpmnkit/drop`: a shared drop has a **Docs** button for anyone who can read it. It documents the drop's BPMN file together with every DMN and form file in the drop.

- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
  - @bpmnkit/core@1.1.0
  - @bpmnkit/editor@1.1.0
  - @bpmnkit/plugins@1.1.0
  - @bpmnkit/ui@0.3.1
  - @bpmnkit/feel@1.1.0
  - @bpmnkit/canvas@1.0.1

## 0.0.11

### Patch Changes

- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
- Updated dependencies [d910fae]
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/plugins@1.0.0
  - @bpmnkit/canvas@1.0.0
  - @bpmnkit/editor@1.0.0
  - @bpmnkit/core@1.0.0

## 0.0.10

### Patch Changes

- Updated dependencies [191d4d2]
- Updated dependencies [f0a0ea2]
  - @bpmnkit/core@0.8.0
  - @bpmnkit/ui@0.3.0
  - @bpmnkit/plugins@0.4.0
  - @bpmnkit/canvas@0.2.5
  - @bpmnkit/editor@0.2.5

## 0.0.9

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/core@0.7.1
  - @bpmnkit/plugins@0.3.5
  - @bpmnkit/canvas@0.2.4
  - @bpmnkit/editor@0.2.4

## 0.0.8

### Patch Changes

- Updated dependencies [e096585]
  - @bpmnkit/core@0.7.0
  - @bpmnkit/canvas@0.2.3
  - @bpmnkit/editor@0.2.3
  - @bpmnkit/plugins@0.3.4

## 0.0.7

### Patch Changes

- Updated dependencies [780e39d]
  - @bpmnkit/core@0.6.0
  - @bpmnkit/canvas@0.2.2
  - @bpmnkit/editor@0.2.2
  - @bpmnkit/plugins@0.3.3

## 0.0.6

### Patch Changes

- Updated dependencies [53a9e25]
- Updated dependencies [9d412da]
- Updated dependencies [2cdc7f9]
- Updated dependencies [9d412da]
  - @bpmnkit/core@0.5.0
  - @bpmnkit/ui@0.2.0
  - @bpmnkit/canvas@0.2.1
  - @bpmnkit/editor@0.2.1
  - @bpmnkit/plugins@0.3.2

## 0.0.5

### Patch Changes

- Updated dependencies [8fdc6d4]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
  - @bpmnkit/core@0.4.0
  - @bpmnkit/canvas@0.2.0
  - @bpmnkit/editor@0.2.0
  - @bpmnkit/plugins@0.3.1

## 0.0.4

### Patch Changes

- Updated dependencies [dc33af9]
- Updated dependencies [dc33af9]
- Updated dependencies [dc33af9]
  - @bpmnkit/plugins@0.3.0
  - @bpmnkit/ui@0.1.0

## 0.0.3

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0
  - @bpmnkit/canvas@0.1.0
  - @bpmnkit/plugins@0.2.0

## 0.0.2

### Patch Changes

- Updated dependencies [00a65f5]
- Updated dependencies [00a65f5]
- Updated dependencies [f990c94]
- Updated dependencies [00a65f5]
  - @bpmnkit/plugins@0.1.0
  - @bpmnkit/core@0.2.0
  - @bpmnkit/canvas@0.0.31

## 0.0.1

### Patch Changes

- Updated dependencies [9cd1942]
  - @bpmnkit/plugins@0.0.33
  - @bpmnkit/canvas@0.0.30
  - @bpmnkit/core@0.1.2
  - @bpmnkit/ui@0.0.16

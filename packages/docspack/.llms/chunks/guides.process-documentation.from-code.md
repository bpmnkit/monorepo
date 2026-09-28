# Process documentation — From code

```ts
import { Bpmn, renderDocumentationHtml, renderDocumentationMarkdown, renderDocumentationDocx } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const html = renderDocumentationHtml(defs, { decisions: [dmn], forms: [form] })
const md = renderDocumentationMarkdown(defs)
const docx: Uint8Array = renderDocumentationDocx(defs, { paper: "letter" })
```

`buildProcessDocumentation(defs, options)` returns the structured content — processes, lanes,
elements in flow order with their properties, message flows, decisions, forms — for a renderer
of your own. `documentationToHtml`, `documentationToMarkdown` and `documentationToDocx` render
it.


## Limits

- **PDF** comes from the browser's print dialog, not from a PDF library. Chromium honours the
  landscape diagram page; other browsers print it on the page size you choose.
- **Markdown** carries no diagram. Export one with `exportSvg` and link it if the wiki allows.
- **Word** embeds the diagram as SVG, without a bitmap fallback. LibreOffice renders it, as
  do Word versions with SVG support (Microsoft 365, Word 2019 and later); older Word versions
  show no image. The Word file has no generated table of contents — insert one from
  *References → Table of Contents*.
- Only the **first diagram** is drawn. Collapsed sub-processes with their own diagram page are
  documented step by step but not drawn separately.
- DMN **decision tables** are documented; literal-expression decisions and the DRD are not.
- The document is in English. The editor's menu entries are translatable; the document's
  headings are not yet.

---
Source: https://bpmnkit.com/docs/guides/process-documentation

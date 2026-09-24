---
title: Process documentation
description: Turn a BPMN diagram into a document to circulate — the diagram, every step in flow order with its performer and settings, and the linked DMN tables and forms — as print-ready HTML (PDF), Markdown or Word.
sidebar:
  order: 17
---

A process model answers "what happens next?" for the people who drew it. Everyone else — the
auditor, the team lead signing it off, the new colleague — wants a document: the diagram, then
each step spelled out. Camunda Modeler and Signavio users know this as a *process report*.
BPMNKit builds one from the model itself, so it never drifts from what is deployed.

## What the document contains

1. **Title and summary** — the pool or process name, and the process documentation text.
2. **Table of contents**, linking every section.
3. **The diagram**, as vector graphics, on a landscape page when printed.
4. **One section per process or pool**:
   - **Lanes and performers** — each lane and the steps it owns.
   - **Steps at a glance** — a numbered table: name, type, lane.
   - **Step details** — for every element, in *flow order* (start events first, then the order a
     token travels; each branch stays together up to its join, loops are not followed twice,
     boundary events follow their host's normal path, sub-process steps are numbered `3.1`,
     `3.2`…):
     type (e.g. *Timer boundary event (non-interrupting)*), documentation text, lane, job type
     and retries, task headers, input/output mappings, called decision and result variable,
     called process, form, assignee and candidate groups, due dates, priority, script,
     multi-instance settings, timers (`PT48H (48 hours)`), messages and correlation keys,
     errors and escalations, and the next steps — with the condition on each outgoing flow and
     the default flow marked.
5. **Message flows** between pools.
6. **Decisions** — each DMN decision table passed in: hit policy, a *When … / Then …* rule
   table, and which steps call it.
7. **Forms** — each form passed in: fields, the variable each binds, type, whether it is
   required and its options, and which user tasks show it.

The same model always produces the same bytes: nothing time-dependent is added unless you pass
a `subtitle`. All model text is escaped, so a name like `<script>` prints as text.

## From the editor

Open the **⋯ More actions** menu and pick **Export documentation…**:

| Choice | What you get |
|---|---|
| **Open print view** | The HTML document in a new tab. Use the browser's *Print → Save as PDF* — page breaks, A4 or Letter, no editor chrome. |
| **Download HTML** | The same document as one self-contained `.html` file: no scripts, no network requests. |
| **Download Markdown** | For wikis and Confluence imports. GitHub-flavoured tables, no diagram. |
| **Download Word** | A `.docx` with Word heading styles (the navigation pane and an inserted table of contents pick them up) and the diagram on a landscape page. |

In the hosted editor, the DMN and form tabs open next to the diagram are documented with it.
When embedding the editor, pass them through `initEditorHud`:

```ts
initEditorHud(editor, {
  getDocumentationContext: () => ({ decisions: [riskDmn], forms: [reviewForm] }),
})
```

## From Drop

A shared drop has a **Docs** button in its toolbar. It offers the same four choices and needs no
edit rights: anyone who can read a drop can take its documentation away. The drop's BPMN file
(the open tab, or the first BPMN file) is documented together with every DMN and form file in
the drop.

## From the CLI

```sh
casen doc export order.bpmn                                  # order.html, print-ready
casen doc export order.bpmn credit.dmn review.form --format docx
casen doc export order.bpmn --format md --out docs/order.md
```

| Flag | Meaning |
|---|---|
| `--format` | `html` (default), `md` or `docx` |
| `--out` | Output path. Default: the input name with the format's extension |
| `--title` | Document title. Default: the pool or process name |
| `--paper` | `a4` (default) or `letter`, for `docx` |

Any `.dmn` and `.form` files after the BPMN file are documented with it. There is no `--format
pdf`: print the HTML to PDF with a browser, or headless — `chrome --headless
--print-to-pdf=order.pdf order.html`.

## From code

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

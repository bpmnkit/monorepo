# Process documentation — From the editor

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

---
Source: https://bpmnkit.com/docs/guides/process-documentation

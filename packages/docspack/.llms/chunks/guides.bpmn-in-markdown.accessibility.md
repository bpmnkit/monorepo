# BPMN Diagrams in Markdown — Accessibility

Every diagram is an `<svg role="img">` labelled by its `<title>` and described by a `<desc>`
that lists the process's named steps in order, so a screen reader announces
"Order fulfilment — BPMN process diagram. Steps: Order received, Check stock, …". In
pre-rendered READMEs, the title is the image's alt text.


## Errors

A block that does not parse does not break the build by default. It renders as a box that
says what went wrong:

```bpmn-compact
{ "id": "typo", "elements": [ { "id": "start", "type": "startEvnt" } ], "flows": [] }
```

The remark plugin also adds the error to the file's messages (`file.messages`), where tools
that report vfile warnings pick it up. Set `onError: "throw"` to fail the build instead.

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown

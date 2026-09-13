# casen diff — The same diff elsewhere

The comparison itself is
[`diffDiagram()`](/docs/packages/core#diffdiagrambefore-after) in `@bpmnkit/core`, so every
surface shows the same answer:

- **Visually, in VS Code** — *Compare Diagram with HEAD*, or two selected files. See the
  [VS Code guide](/docs/guides/vscode).
- **On a share link** — `/drop/<before>/diff/<after>`. See the [Drop guide](/docs/guides/drop).
- **In your own canvas** — `createBpmnDiff()` from `@bpmnkit/plugins` returns a pair of
  plugins, one per canvas, with synchronised pan and zoom.

---
Source: https://bpmnkit.com/docs/cli/diff

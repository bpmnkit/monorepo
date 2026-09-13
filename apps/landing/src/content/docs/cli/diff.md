---
title: casen diff
description: Compare two BPMN files and report what a reviewer would see change — added, removed, changed and moved elements, as text or JSON, with an exit code for CI.
sidebar:
  order: 4
---

`casen diff bpmn` answers the question a text diff cannot: *what changed about the process?*
Two files go in, and what comes out is the list of elements a reviewer would see differ —
named, not just identified.

```sh
casen diff bpmn old.bpmn new.bpmn
```

```
  + Notify Customer (Activity_1x8fj2)
  ~ Validate Order (Activity_0p2ktn)
  ⇄ Approved? (Gateway_09sd1a)

3 differences: 1 added, 1 changed, 1 moved
```

## Why the categories matter

| Marker | Category | Means |
| --- | --- | --- |
| `+` | added | Exists only in the later file |
| `−` | removed | Exists only in the earlier file |
| `~` | changed | Same element, different semantics — a task type, a condition, an extension |
| `⇄` | moved | Same semantics, different place on the canvas |

`moved` is the category that earns the command. The semantic hash behind
[`diffSemantics()`](/docs/packages/core#diffsemanticsbefore-after) deliberately drops all
diagram interchange — that is what makes it stable across a re-layout — so a task somebody
dragged reads there as no change at all. `casen diff` computes the layout half separately
from DI (bounds, waypoints, label placement, flags such as collapsed/expanded) and reports it
as its own category. An element that changed *and* moved is reported as changed, because a
semantic change is what a reviewer needs first.

Only elements a canvas could actually draw are counted, so a changed `targetNamespace` cannot
inflate the count against nothing on screen. When a diagram has more than one plane, the
per-plane totals are printed too — a change inside a collapsed sub-process is invisible in a
viewer until the reader drills into it.

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--format` | `text` | `text` or `json` |
| `--exit-code` | off | Exit non-zero when the two diagrams differ |
| `--ascii` | off | Also render both diagrams as ASCII art |

### As a pipeline gate

```sh
casen diff bpmn main/order.bpmn branch/order.bpmn --exit-code
```

Exits non-zero when anything differs, so a job can fail — or a review can be requested —
whenever a pull request touches the shape of a process rather than only its formatting.

### Machine-readable

```sh
casen diff bpmn old.bpmn new.bpmn --format json
```

```json
{
  "added": ["Activity_1x8fj2"],
  "removed": [],
  "changed": ["Activity_0p2ktn"],
  "moved": ["Gateway_09sd1a"],
  "total": 3,
  "planes": [{ "id": "order-process", "total": 3, "added": 1, "removed": 0, "changed": 1, "moved": 1 }]
}
```

### Alongside the picture

```sh
casen diff bpmn old.bpmn new.bpmn --ascii
```

Prints both diagrams as ASCII art above the summary — the same rendering
[`casen view`](/docs/cli/view) produces, and the same one the VS Code extension copies into a
pull request.

## The same diff elsewhere

The comparison itself is
[`diffDiagram()`](/docs/packages/core#diffdiagrambefore-after) in `@bpmnkit/core`, so every
surface shows the same answer:

- **Visually, in VS Code** — *Compare Diagram with HEAD*, or two selected files. See the
  [VS Code guide](/docs/guides/vscode).
- **On a share link** — `/drop/<before>/diff/<after>`. See the [Drop guide](/docs/guides/drop).
- **In your own canvas** — `createBpmnDiff()` from `@bpmnkit/plugins` returns a pair of
  plugins, one per canvas, with synchronised pan and zoom.

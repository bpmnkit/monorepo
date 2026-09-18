---
title: "@bpmnkit/ascii"
description: Render BPMN diagrams, DMN decision tables and Camunda Forms as Unicode text.
sidebar:
  order: 7
---

## Overview

`@bpmnkit/ascii` turns a diagram into text. It takes the XML and returns a string — no canvas,
no DOM, no headless browser — so a process can be shown somewhere a picture cannot go: a
terminal, a CI log, a pull-request comment, or a prompt.

That last one is the reason it exists. A model reading a diagram as a grid of labelled boxes
gets the topology in a few hundred tokens, which is a great deal cheaper than the XML and a
great deal more legible than a screenshot. `casen view` is this package with a file path in
front of it.

Three renderers, one per artifact kind, and no dependencies beyond `@bpmnkit/core`.

## Installation

```sh
npm install @bpmnkit/ascii
```

## Rendering a process

```typescript
import { renderBpmnAscii } from "@bpmnkit/ascii";
import { readFileSync } from "node:fs";

console.log(renderBpmnAscii(readFileSync("order.bpmn", "utf-8")));
```

```text
╭─────────╮           ┌──────────────────────┐          ╭─────────╮
│ ○ Start │──────────►│ [svc] Process Order  │─────────►│ ● End   │
╰─────────╯           └──────────────────────┘          ╰─────────╯
```

Shapes follow BPMN. Events are rounded boxes carrying a marker — `○` start, `●` end, `◎`
intermediate catch, `◉` throw, `◈` boundary. Activities are square boxes with a three-letter
type tag — `[svc]`, `[usr]`, `[scr]`, `[snd]`, `[rcv]`, `[dmn]`, `[man]`, `[cal]`, `[sub]`,
`[txn]`. Gateways are diamonds — `×` exclusive, `+` parallel, `◇` inclusive, `?` event-based,
`✱` complex. Labels are truncated to the box, which keeps columns aligned on a wide process.

The layout comes from the diagram's own coordinates, so what you get is the shape someone drew
rather than a re-layout. A model with no diagram interchange has nothing to place — run
`applyAutoLayout` from `@bpmnkit/core` first if you built it in code.

## Rendering a decision table

```typescript
import { renderDmnAscii } from "@bpmnkit/ascii";

console.log(renderDmnAscii(readFileSync("risk-score.dmn", "utf-8")));
```

```text
DRD
───

Risk score [FIRST]
──────────────────

╔═══╦═════════╦════════════╦════════╗
║ F ║ Amount  ║ Country    ║ Risk   ║
╠═══╬═════════╬════════════╬════════╣
║ 1 ║ < 1000  ║ "DE", "AT" ║ "low"  ║
║ 2 ║ >= 1000 ║            ║ "high" ║
╚═══╩═════════╩════════════╩════════╝
```

The hit policy is shown beside the table name and in the corner cell, because a table read
without it means something different — an empty cell under `FIRST` is "anything, and stop
here", which is not what it looks like.

## Rendering a form

```typescript
import { renderFormAscii } from "@bpmnkit/ascii";

console.log(renderFormAscii(readFileSync("approval.form", "utf-8")));
```

Fields are listed in layout order with their keys, types and validation, so a form can be
reviewed in the same place as the process that raises it.

## API Reference

| Export | Signature |
|---|---|
| `renderBpmnAscii` | `(xml: string, options?: RenderOptions) => string` |
| `renderDmnAscii` | `(xml: string, options?: RenderOptions) => string` |
| `renderFormAscii` | `(json: string, options?: RenderOptions) => string` |

Each takes the file's text and returns the rendering. Parsing is strict — a document that is
not valid BPMN throws, naming what it found — so wrap the call if you are rendering a
directory. A document that parses but holds no flow elements
renders as `(empty)`.

### `RenderOptions`

```typescript
interface RenderOptions {
  /**
   * Heading shown above the diagram.
   * Defaults to the process name from the XML; pass `false` for no heading.
   */
  title?: string | false;
}
```

## From the command line

`casen view` wraps all three, picking the renderer from the file extension:

```sh
casen view order.bpmn
casen view risk-score.dmn
```

See [`casen view`](/docs/cli/view) for the flags it adds on top.

## Stability

`@bpmnkit/ascii` carries the [1.0 stability promise](/docs/getting-started/stability): its
exports will not change shape without a major version.

The promise covers the three function signatures and `RenderOptions`. It does **not** cover
the exact characters that come out — box-drawing details, column widths and truncation are
presentation, and improving them is a minor. Do not assert on the rendering byte for byte.

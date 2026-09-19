# @bpmnkit/ascii — Installation

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

---
Source: https://bpmnkit.com/docs/packages/ascii

# @bpmnkit/ascii — Rendering a decision table

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

---
Source: https://bpmnkit.com/docs/packages/ascii

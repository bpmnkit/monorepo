# @bpmnkit/feel — Formatting and highlighting

`formatFeel` pretty-prints — note that it takes a **parsed node**, not source text:

```typescript
import { parseExpression, formatFeel } from "@bpmnkit/feel";

formatFeel(parseExpression("if  x>10 then  1 else 2").ast!);
```

`annotate` classifies source into typed tokens, which is what an editor wants:

```typescript
import { annotate } from "@bpmnkit/feel";

annotate("x > 1")[0];
// { kind: "variable", value: "x", start: 0, end: 1 }
```

`highlightToHtml` wraps those tokens in `<span class="feel-…">` elements for a ready-made
highlighter. `highlightFeel` is an alias for it, kept for compatibility.

---
Source: https://bpmnkit.com/docs/packages/feel

# @bpmnkit/feel — Unary tests

A DMN input entry is not an expression but a **unary test** — `> 5`, `"gold","silver"`,
`[1..10]` — evaluated against an input value. They have their own parse and evaluate pair.

```typescript
import { parseUnaryTests, evaluateUnaryTests } from "@bpmnkit/feel";

const test = parseUnaryTests('"gold","silver"');

evaluateUnaryTests(test.ast!, "gold", { vars: {} });   // true
evaluateUnaryTests(test.ast!, "bronze", { vars: {} }); // false
```


## What the language covers

```typescript
const run = (src: string, vars = {}) =>
  evaluate(parseExpression(src).ast!, { vars });

run('upper case("abc")');            // "ABC"
run('contains("foobar", "oo")');     // true
run("sum([1, 2, 3])");               // 6
run("[1, 2, 3, 4][item > 2]");       // [3, 4]  — list filter
run("{ a: 1, b: { c: 2 } }.b.c");    // 2       — context literal and path
run("[1..10]");                      // a range value
run('string length("héllo")');       // 5       — code points, not bytes
```

- **Temporal types** — `date`, `time`, `date and time`, `duration` and
  `years and months duration`, as structured values rather than strings:

  ```typescript
  run('date and time("2026-01-01T10:00:00")');
  // { type: "date-time", date: { type: "date", year: 2026, month: 1, day: 1 },
  //   time: { type: "time", hour: 10, minute: 0, second: 0 } }
  ```

- **Ranges** — `[1..10]`, `(0..1)`, and the fourteen DMN range functions that compare them
  (`before`, `after`, `meets`, `met by`, `overlaps`, `during`, `includes`, `coincides`, …).
- **87 built-in functions** across strings, numbers, lists, contexts and temporals.
- **Context literals and paths**, including nested access and filters.

---
Source: https://bpmnkit.com/docs/packages/feel

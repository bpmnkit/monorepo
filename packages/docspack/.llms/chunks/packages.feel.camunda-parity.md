# @bpmnkit/feel — Camunda parity

Camunda 8 evaluates FEEL with its own engine, which adds functions and behaviour that DMN does
not define. This package implements them, so an expression written for Zeebe evaluates the
same way here:

| Area | Camunda extensions |
|---|---|
| Boolean | `get or else`, `assert` |
| Context | `context put` with a key path, `context merge`, `get value` with a key path |
| String | `string join`, `is blank`, `trim`, `extract`, `uuid`, `to base64`, `from base64` |
| List | `is empty`, `partition`, `duplicate values` |
| Conversion | `to json`, `from json`, `date and time(value, timezone)` |
| Temporal | `last day of month` (a date), `week of year`, time ± duration, duration ÷ duration |
| AI agent | `fromAi`, which returns its value unchanged |

```typescript
run('partition([1,2,3,4,5], 2)');                    // [[1,2], [3,4], [5]]
run('context put({x: 1}, ["y", "z"], 2)');           // { x: 1, y: { z: 2 } }
run('to json({a: 1, b: [true, null]})');             // '{"a":1,"b":[true,null]}'
run('date and time(@"2020-07-31T14:27:30@Europe/Berlin", "America/Los_Angeles")');
// the value of date and time("2020-07-31T05:27:30@America/Los_Angeles")
```

**Measured against Camunda's documentation.** `packages/feel/tests/camunda-parity.test.ts`
takes every worked example in the FEEL pages of Camunda's docs (`expression` then
`// result`), evaluates both sides, and compares them. The examples are read at test time from
`@bpmnkit/camunda-docspack`; `node packages/feel/tasks/extract-camunda-examples.mjs --skipped`
lists the ones that cannot run standalone and why (function signatures, prose results, `now()`
and other clock-dependent examples). Of the **378 runnable examples, 375 match**. The three
that do not:

- `round up(5.5)` and `round up(-5.5)` — the documented signature is `round up(n, scale)`, as
  in DMN, and these examples leave the scale out. This package holds to the signature.
- `date and time(@"2020-07-31T14:27:30", "Z")` — a date and time without a zone names no
  instant. Camunda reads it on the engine's own clock, so the documented result holds only
  where that clock is two hours ahead of UTC. This package returns `null`.

One difference is in how errors surface, not in which expressions are errors. Camunda fails
the evaluation: `assert(x, x > 0)` with `x = -1` stops with an error. This package follows DMN
and returns `null` for an evaluation error.

---
Source: https://bpmnkit.com/docs/packages/feel

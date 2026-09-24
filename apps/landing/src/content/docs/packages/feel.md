---
title: "@bpmnkit/feel"
description: The FEEL expression language — lexer, parser, evaluator, formatter and syntax highlighter, with no dependencies.
sidebar:
  order: 5
---

## Overview

`@bpmnkit/feel` implements FEEL (Friendly Enough Expression Language), the expression language
DMN decision tables and Camunda 8 condition expressions are written in. It passes 1,941 of the
2,053 FEEL cases in the [DMN TCK](https://dmn-tck.github.io/tck/) (94.5%), and matches 375 of
the 378 runnable examples in Camunda 8's FEEL documentation (see
[Camunda parity](#camunda-parity)). The cases it does not pass are listed, each with its
reason, in `packages/feel/tests/tck.test.ts` and `packages/feel/tests/camunda-parity.test.ts`,
and [Conformance](/docs/getting-started/conformance) has the full picture.

It is four things behind one entry point: a **lexer**, a recursive-descent **parser**, an AST
**evaluator** with 101 built-in functions, and a **formatter** and **syntax highlighter** for
editors. It has no dependencies and runs unchanged in Node.js and the browser.

Everything else in BPMN Kit that has to understand an expression uses it — gateway conditions
in `@bpmnkit/core`'s optimizer, the simulator in `@bpmnkit/engine`, the FEEL playground plugin,
and DMN evaluation.

## Installation

```sh
npm install @bpmnkit/feel
```

## Parsing and evaluating

Parsing and evaluation are separate steps, so you can parse once and evaluate many times, and
so a syntax error is a value rather than an exception.

```typescript
import { parseExpression, evaluate } from "@bpmnkit/feel";

const parsed = parseExpression("amount * 1.2 + fee");

if (parsed.errors.length === 0) {
  const result = evaluate(parsed.ast!, { vars: { amount: 100, fee: 5 } });
  console.log(result); // 125
}
```

`evaluate` takes an **`EvalContext`**, not a bare object — variables live under `vars`:

```typescript
interface EvalContext {
  /** The variables the expression may reference. */
  vars: Record<string, FeelValue>;
  /** Enclosing scope, searched when `vars` has no match. */
  parent?: EvalContext;
  /** The value `?` refers to, used by unary tests. */
  input?: FeelValue;
}
```

Parse errors carry their position, so an editor can underline them:

```typescript
parseExpression("1 +").errors;
// [{ message: "Expected expression after '+'", start: 3, end: 4 }]
```

## Unary tests

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
- **101 built-in functions** across strings, numbers, lists, contexts and temporals, including
  Camunda's extensions to DMN (below).
- **Context literals and paths**, including nested access and filters.

## Camunda parity

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

## Formatting and highlighting

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

## API Reference

| Export | Signature | Description |
|---|---|---|
| `parseExpression` | `(src: string) => ParseResult` | Parse an expression |
| `parseUnaryTests` | `(src: string) => ParseResult` | Parse a DMN input entry |
| `evaluate` | `(node, ctx: EvalContext) => FeelValue` | Evaluate a parsed expression |
| `evaluateUnaryTests` | `(node, input, ctx) => boolean` | Test an input against unary tests |
| `evaluateUnaryTest` | `(node, input, ctx) => boolean` | A single unary test |
| `tokenize` | `(src: string) => FeelToken[]` | Raw token stream |
| `formatFeel` | `(node, opts?) => string` | Pretty-print a **parsed node** |
| `annotate` | `(src: string) => AnnotatedToken[]` | Tokens classified for highlighting |
| `highlightToHtml` | `(src: string) => string` | Tokens wrapped in `<span>` elements |
| `highlightFeel` | `(src: string) => string` | Alias for `highlightToHtml` |

### `ParseResult`

```typescript
interface ParseResult {
  ast: FeelNode | null;
  errors: ParseError[]; // { message, start, end }
}
```

### Types and guards

`FeelValue` is the union every evaluation produces. The structured members —
`FeelDate`, `FeelTime`, `FeelDateTime`, `FeelDayTimeDuration`,
`FeelYearsMonthsDuration`, `FeelRange`, `FeelContext`, `FeelFunction` — each come with a
type guard (`isFeelDate`, `isFeelRange`, …), plus `getProperty` for path access. Import them
by name from the package root.

## Stability

`@bpmnkit/feel` carries the [1.0 stability promise](/docs/getting-started/stability): its
exports will not change shape without a major version.

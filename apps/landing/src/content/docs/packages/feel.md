---
title: "@bpmnkit/feel"
description: The FEEL expression language — lexer, parser, evaluator, formatter and syntax highlighter, with no dependencies.
sidebar:
  order: 5
---

## Overview

`@bpmnkit/feel` is a complete implementation of FEEL (Friendly Enough Expression Language), the
expression language DMN decision tables and Camunda 8 condition expressions are written in.

It is four things behind one entry point: a **lexer**, a recursive-descent **parser**, an AST
**evaluator** with 88 built-in functions, and a **formatter** and **syntax highlighter** for
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
- **88 built-in functions** across strings, numbers, lists, contexts and temporals.
- **Context literals and paths**, including nested access and filters.

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

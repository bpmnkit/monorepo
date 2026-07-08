---
title: "Evaluating FEEL expressions in TypeScript"
description: "How to parse and evaluate FEEL — the expression language behind DMN decision tables and BPMN gateway conditions — using the zero-dependency @bpmnkit/feel package."
pubDate: 2026-06-26
author: "BPMN Kit"
tags: ["feel", "dmn", "typescript"]
---

FEEL (Friendly Enough Expression Language) is the expression language DMN 1.3 defines
for decision tables, and it's what Camunda 8 uses for BPMN gateway conditions and
variable mappings too. If you're generating processes or decision tables programmatically,
being able to parse and evaluate FEEL yourself — outside of a running Camunda engine —
is useful for validation, testing, and tooling.

[`@bpmnkit/feel`](https://github.com/bpmnkit/monorepo/tree/main/packages/feel) is a zero-dependency FEEL
parser and evaluator with [87 built-in functions](/feel-functions) implemented.

## Parsing and evaluating an expression

FEEL evaluation is two steps: parse the expression into an AST, then evaluate that AST
against a variable context.

```typescript
import { parseExpression, evaluate } from "@bpmnkit/feel";

const { ast, errors } = parseExpression("amount > 1000 and status = \"pending\"");
if (errors.length > 0) {
  throw new Error(`Invalid FEEL expression: ${errors[0].message}`);
}

const result = evaluate(ast, {
  vars: { amount: 1500, status: "pending" },
});
// result === true
```

Separating parse from evaluate matters for tooling: you can parse once, check for syntax
errors immediately (useful for validating a gateway condition before it's ever run), and
evaluate many times against different variable contexts — exactly what a process
simulation does for every token that reaches that gateway.

## What's actually supported

The evaluator handles the FEEL data model beyond plain booleans and numbers: dates,
times, durations, ranges, lists, and contexts, plus the string/list/date functions
[documented on the function reference page](/feel-functions) — things like:

```typescript
const { ast } = parseExpression('date("2026-07-07") + duration("P30D")');
evaluate(ast, { vars: {} });
// → a FEEL date 30 days after 2026-07-07
```

## Where this shows up in BPMN Kit

Gateway conditions built with `@bpmnkit/core`'s fluent API are plain FEEL strings:

```typescript
.branch("approved", (b) =>
  b.condition("= amount <= 5000")
    .serviceTask("auto-approve", { taskType: "auto-approve" })
    .endEvent("end-approved"),
)
```

`@bpmnkit/engine`'s simulation engine uses the same `@bpmnkit/feel` evaluator internally
to decide which branch a token takes — so testing a condition with `parseExpression`/`evaluate`
directly exercises the identical logic a real simulation run would use.

## Where to go next

- [FEEL function reference](/feel-functions) — all 87 built-in functions
- [Simulate a BPMN process without Camunda](/blog/simulate-bpmn-process-without-camunda)
- [Generate BPMN 2.0 diagrams programmatically](/blog/generate-bpmn-diagrams-programmatically-typescript)

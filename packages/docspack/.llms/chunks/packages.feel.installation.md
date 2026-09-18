# @bpmnkit/feel — Installation

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

---
Source: https://bpmnkit.com/docs/packages/feel

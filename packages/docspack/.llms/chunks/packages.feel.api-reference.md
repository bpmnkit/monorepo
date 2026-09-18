# @bpmnkit/feel — API Reference

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

---
Source: https://bpmnkit.com/docs/packages/feel

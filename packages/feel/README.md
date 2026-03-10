<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN SDK logo">
  <h1>@bpmn-sdk/feel</h1>
  <p>Complete FEEL (Friendly Enough Expression Language) implementation — parser, evaluator, and highlighter</p>

  [![npm](https://img.shields.io/npm/v/@bpmn-sdk/feel?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmn-sdk/feel)
  [![license](https://img.shields.io/npm/l/@bpmn-sdk/feel?style=flat-square)](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmn-sdk/monorepo)

  [Website](https://bpmnsdk.u11g.com) · [Documentation](https://bpmnsdkdocs.u11g.com) · [GitHub](https://github.com/bpmn-sdk/monorepo) · [Changelog](https://github.com/bpmn-sdk/monorepo/blob/main/packages/feel/CHANGELOG.md)
</div>

---

## Overview

`@bpmn-sdk/feel` is a complete implementation of the FEEL expression language used in DMN decision tables and BPMN condition expressions. It includes a tokenizer, recursive-descent parser, AST evaluator, formatter, and syntax highlighter.

## Features

- **Full FEEL grammar** — arithmetic, comparisons, logic, function calls, paths, filters
- **Temporal types** — date, time, datetime, duration (ISO 8601, full spec compliance)
- **Unary tests** — DMN input expression syntax (`> 5`, `"gold", "silver"`, `[1..10]`)
- **Built-in functions** — 50+ standard FEEL functions (string, list, numeric, date, context)
- **Range expressions** — `[1..10]`, `(0..1)`, `[today..end]`
- **Context literals** — `{ key: value, nested: { x: 1 } }`
- **Syntax highlighting** — semantic token classification for editors
- **Zero dependencies**

## Installation

```sh
npm install @bpmn-sdk/feel
```

## Quick Start

### Evaluate an expression

```typescript
import { parseExpression, evaluate } from "@bpmn-sdk/feel"

const parsed = parseExpression("amount * 1.2 + fee")
if (!parsed.errors.length) {
  const result = evaluate(parsed.ast!, { amount: 100, fee: 5 })
  console.log(result) // 125
}
```

### Evaluate unary tests (DMN input expressions)

```typescript
import { parseUnaryTests, evaluateUnaryTests } from "@bpmn-sdk/feel"

// Does input value match any listed condition?
const parsed = parseUnaryTests('"gold","silver"')
const matches = evaluateUnaryTests(parsed.ast!, "gold", { /* context */ })
console.log(matches) // true
```

### Syntax highlighting

```typescript
import { highlightFeel } from "@bpmn-sdk/feel"

const tokens = highlightFeel('if x > 10 then "high" else "low"')
for (const token of tokens) {
  console.log(token.type, token.value) // keyword, number, string, ...
}
```

## API Reference

| Export | Description |
|--------|-------------|
| `parseExpression(src)` | Parse a FEEL expression → `ParseResult` |
| `parseUnaryTests(src)` | Parse unary tests → `ParseResult` |
| `evaluate(ast, ctx)` | Evaluate a parsed expression |
| `evaluateUnaryTests(ast, input, ctx)` | Test input against unary tests |
| `formatFeel(src)` | Pretty-print a FEEL expression |
| `highlightFeel(src)` | Tokenize with semantic types for highlighting |
| `tokenize(src)` | Raw token stream |
| `annotate(src)` | Full AST with position metadata |

### ParseResult

```typescript
interface ParseResult {
  ast: FeelNode | null
  errors: ParseError[]   // { message, position }
}
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmn-sdk/core`](https://www.npmjs.com/package/@bpmn-sdk/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmn-sdk/canvas`](https://www.npmjs.com/package/@bpmn-sdk/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmn-sdk/editor`](https://www.npmjs.com/package/@bpmn-sdk/editor) | Full-featured interactive BPMN editor |
| [`@bpmn-sdk/engine`](https://www.npmjs.com/package/@bpmn-sdk/engine) | Lightweight BPMN process execution engine |
| [`@bpmn-sdk/plugins`](https://www.npmjs.com/package/@bpmn-sdk/plugins) | 22 composable canvas plugins |
| [`@bpmn-sdk/api`](https://www.npmjs.com/package/@bpmn-sdk/api) | Camunda 8 REST API TypeScript client |
| [`@bpmn-sdk/ascii`](https://www.npmjs.com/package/@bpmn-sdk/ascii) | Render BPMN diagrams as Unicode ASCII art |

## License

[MIT](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE) © bpmn-sdk

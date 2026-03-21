<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/feel</h1>
  <p>Complete FEEL (Friendly Enough Expression Language) implementation — parser, evaluator, and highlighter</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/feel?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/feel)
  [![license](https://img.shields.io/npm/l/@bpmnkit/feel?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/feel/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/feel` is a complete implementation of the FEEL expression language used in DMN decision tables and BPMN condition expressions. It includes a tokenizer, recursive-descent parser, AST evaluator, formatter, and syntax highlighter.

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
npm install @bpmnkit/feel
```

## Quick Start

### Evaluate an expression

```typescript
import { parseExpression, evaluate } from "@bpmnkit/feel"

const parsed = parseExpression("amount * 1.2 + fee")
if (!parsed.errors.length) {
  const result = evaluate(parsed.ast!, { amount: 100, fee: 5 })
  console.log(result) // 125
}
```

### Evaluate unary tests (DMN input expressions)

```typescript
import { parseUnaryTests, evaluateUnaryTests } from "@bpmnkit/feel"

// Does input value match any listed condition?
const parsed = parseUnaryTests('"gold","silver"')
const matches = evaluateUnaryTests(parsed.ast!, "gold", { /* context */ })
console.log(matches) // true
```

### Syntax highlighting

```typescript
import { highlightFeel } from "@bpmnkit/feel"

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
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/cli-sdk`](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for the casen CLI |
| [`@bpmnkit/create-casen-plugin`](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new casen CLI plugin in seconds |
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>

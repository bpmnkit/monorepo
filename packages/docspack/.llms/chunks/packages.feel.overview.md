# @bpmnkit/feel — Overview

`@bpmnkit/feel` implements FEEL (Friendly Enough Expression Language), the expression language
DMN decision tables and Camunda 8 condition expressions are written in. It passes 1,939 of the
2,053 FEEL cases in the [DMN TCK](https://dmn-tck.github.io/tck/) (94.4%); the cases it does
not pass are listed, each with its reason, in `packages/feel/tests/tck.test.ts`, and
[Conformance](/docs/getting-started/conformance) has the full picture.

It is four things behind one entry point: a **lexer**, a recursive-descent **parser**, an AST
**evaluator** with 88 built-in functions, and a **formatter** and **syntax highlighter** for
editors. It has no dependencies and runs unchanged in Node.js and the browser.

Everything else in BPMN Kit that has to understand an expression uses it — gateway conditions
in `@bpmnkit/core`'s optimizer, the simulator in `@bpmnkit/engine`, the FEEL playground plugin,
and DMN evaluation.

---
Source: https://bpmnkit.com/docs/packages/feel

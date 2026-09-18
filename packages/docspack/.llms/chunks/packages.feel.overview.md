# @bpmnkit/feel — Overview

`@bpmnkit/feel` is a complete implementation of FEEL (Friendly Enough Expression Language), the
expression language DMN decision tables and Camunda 8 condition expressions are written in.

It is four things behind one entry point: a **lexer**, a recursive-descent **parser**, an AST
**evaluator** with 87 built-in functions, and a **formatter** and **syntax highlighter** for
editors. It has no dependencies and runs unchanged in Node.js and the browser.

Everything else in BPMN Kit that has to understand an expression uses it — gateway conditions
in `@bpmnkit/core`'s optimizer, the simulator in `@bpmnkit/engine`, the FEEL playground plugin,
and DMN evaluation.

---
Source: https://bpmnkit.com/docs/packages/feel

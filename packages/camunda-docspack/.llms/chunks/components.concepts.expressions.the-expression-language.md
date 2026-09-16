# Expressions — The expression language

An expression is written in **Friendly Enough Expression Language (FEEL)**. FEEL is part of the OMG's **Decision Model and Notation (DMN)** specification. It is designed to have the following properties:

- Free of side effects
- Simple data model with JSON-like object types: numbers, dates, strings, lists, and contexts
- Syntax designed for business professionals and developers
- Three-valued logic (true, false, null)

Camunda 8 integrates the [FEEL Scala](https://github.com/camunda/feel-scala) engine to evaluate [FEEL expressions](https://docs.camunda.io/docs/next/reference/glossary#feel-expression).


## Evaluation timeout

Use evaluation timeouts to prevent long-running FEEL expressions from blocking processing.

Some FEEL expressions may take a long time to evaluate, especially in the following cases:

- Expressions with exponential complexity, such as recursive operations without proper bounds
- Expressions that process very large input data sets

By default, expression evaluation times out after five seconds. You can [configure this timeout](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#expression).

If an expression exceeds the timeout, evaluation is interrupted and an incident is raised for the affected process instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/expressions

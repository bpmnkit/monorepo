# Variables — Variable names

The name of a variable can be any alphanumeric string including the `_` symbol. For a combination of words, it's recommended to use the `camelCase` or the `snake_case` format. The `kebab-case` format is not allowed because it contains the operator `-`.

When accessing a variable in an expression, keep in mind the variable name is case-sensitive.

Restrictions of a variable name:

- It may not start with a **number** (e.g. `1stChoice` is not allowed; you can use `firstChoice` instead).
- It may not contain **whitespaces** (e.g. `order number` is not allowed; you can use `orderNumber` instead).
- It may not contain an **operator** (e.g. `+`, `-`, `*`, `/`, `=`, `>`, `?`, `.`).
- It may not be a **literal** (e.g. `null`, `true`, `false`) or a **keyword** (e.g. `function`, `if`, `then`, `else`, `for`, `between`, `instance`, `of`, `not`).
- It must stay within the length limits of the target backend: up to **32,768 characters** with Elasticsearch/OpenSearch-backed secondary storage and up to **256 characters** with RDBMS-backed secondary storage.

**Note**
Length is enforced using Java string length semantics rather than raw UTF-8 byte counts. Most common characters count as one character, while characters represented as surrogate pairs in Java count as two. Because of that, the effective visible-character limit can be lower for some inputs.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

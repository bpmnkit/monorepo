# Variables — Variable scopes — Internal engine variables

Some variables are created and managed by the engine to control execution. They are scoped locally to the element instance that uses them and are not intended as process data:

- `loopCounter`: the current iteration index inside a multi-instance activity. Read it within an iteration, but do not propagate it to higher scopes.
- The multi-instance input element variable: the item assigned to the current iteration from the input collection. Its name is set by the `inputElement` attribute, and it stays local to that iteration.

Avoid referencing these variables in output mappings. Propagating them beyond their intended scope can produce incorrect results.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

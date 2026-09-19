# Ad-hoc sub-processes — Collect output

You can collect the output of inner flows in an ad-hoc sub-process by defining the `outputCollection` and `outputElement` expressions.

- `outputCollection` defines the variable name that stores the collected output (for example, `results`). This variable is created as a local variable of the ad-hoc sub-process and updated whenever an inner flow completes. When the ad-hoc sub-process completes, the `outputCollection` variable is [propagated](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/components/concepts/variables#variable-propagation) to the parent scope.

- `outputElement` defines the output of the inner flow (for example, `= result`). This expression usually [accesses a variable](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables#access-variable) of the inner flow that holds the output value. This variable should be created with the output value, for example, by a job worker providing a variable with the name `result`.

When an inner flow completes, the `outputElement` expression is evaluated and the result is added to the `outputCollection`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses

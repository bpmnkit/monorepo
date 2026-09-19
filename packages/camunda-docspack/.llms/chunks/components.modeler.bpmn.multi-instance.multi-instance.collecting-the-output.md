# Multi-instance — Collecting the output

The output of a multi-instance activity (e.g. the result of a calculation) can be collected from the instances by defining the `outputCollection` and the `outputElement` expression.

`outputCollection` defines the name of the variable under which the collected output is stored (e.g. `results`). It is created as a local variable of the multi-instance body and is updated when an instance is completed. When the multi-instance body is completed, the variable is propagated to its parent scope.

`outputElement` is an expression that defines the output of the instance (e.g. `= result`). Usually, it [accesses a variable](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables#access-variable) of the instance that holds the output value. If the expression only accesses a variable or a nested property, it's created as a **local variable** of the instance. This variable should be updated with the output value; for example, by a job worker providing a variable with the name `result`. Since the variable is defined as a local variable, it is not propagated to its parent scope and is only visible within the instance.

When the instance is completed, the `outputElement` expression is evaluated and the result is inserted into the `outputCollection` at the same index as the `inputElement` of the `inputCollection`. Therefore, the order of the `outputCollection` is determined and matches to the `inputCollection`, even for parallel multi-instance activities. If the `outputElement` variable is not updated, `null` is inserted instead.

If the `inputCollection` value is empty, an empty array is propagated as `outputCollection`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance

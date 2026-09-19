# Multi-instance — Execution listeners in multi-instance bodies

Execution listeners on a multi-instance body support a `beforeAll` event type that fires **once** per body activation — before the `inputCollection` expression is evaluated and before any instances are created. This is distinct from `start` listeners, which fire once per instance.

For full details on execution listener types and configuration, see [execution listeners](https://docs.camunda.io/docs/next/components/concepts/execution-listeners).


## Variable mappings

Input and output variable mappings can be defined at the multi-instance activity; they are applied on each instance on activating and on completing.

The input mappings can be used to create new local variables in the scope of an instance. These variables are only visible within the instance; it is a way to restrict the visibility of variables. By default, new variables (e.g. provided by a job worker) are created in the scope of the process instance and are visible to all instances of the multi-instance activity as well as outside of it.

In case of a parallel multi-instance activity, this can lead to variables that are modified by multiple instances and result in race conditions. If a variable is defined as a local variable, it is not propagated to a parent or the process instance scope and can't be modified outside the instance.

The input mappings can access the local variables of the instance (e.g. `inputElement`, `loopCounter`); for example, to extract parts of the `inputElement` variable and apply them to separate variables.

The output mappings can be used to update the `outputElement` variable; for example, to extract a part of the job variables.

The `loopCounter` variable and the input element variable defined by `inputElement` are managed by the engine and stay local to a single instance. Do not reference them in output mappings, because propagating them to a higher scope produces a value that reflects only one iteration. See [internal engine variables](https://docs.camunda.io/docs/next/components/concepts/variables#internal-engine-variables).

When the loop finishes, the output collection is propagated to the parent scope. For how a multi-instance activity compares to other elements, see [variable propagation by BPMN element](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation-by-bpmn-element).

**Example:** We have a call activity marked as a parallel multi-instance. When the called process instance completes, its variables are [merged](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation) into the call activity's process instance. Its result is collected in the output collection variable, but this has become a race condition where each completed child instance again overwrites this same variable. We end up with a corrupted output collection. An output mapping can be used to overcome this, because it restricts which variables are merged. In the case of:

- Parallel multi-instance call activity
- Multi-instance output element: `=output`
- Variable in the child instance that holds the result: `x`

The output mapping on the call activity should be:

```
source: =x
target: output
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance

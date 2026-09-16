# Variables — Variable scopes — Variable propagation

When variables are merged into a process instance (e.g. on job completion, on message correlation, etc.) each variable is propagated from the scope of the activity to its higher scopes.

The propagation ends when a scope contains a variable with the same name. In this case, the variable value is updated.

If no scope contains this variable, it's created as a new variable in the root scope.

What an element propagates when it completes, and whether it propagates anything at all, depends on the BPMN element type. See [variable propagation by BPMN element](#variable-propagation-by-bpmn-element) for the full breakdown.

![variable-propagation](assets/variable-propagation.png)

The job of **Task B** is completed with the variables `b`, `c`, and `d`. The variables `b` and `c` are already defined in higher scopes and are updated with the new values. Variable `d` doesn't exist before and is created in the root scope.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

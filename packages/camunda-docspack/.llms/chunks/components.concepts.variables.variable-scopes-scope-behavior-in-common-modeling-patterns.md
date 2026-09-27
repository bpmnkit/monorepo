# Variables — Variable scopes — Scope behavior in common modeling patterns

The scope boundary depends on the BPMN element you use:

| Pattern                 | Scope behavior                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embedded subprocess     | Creates a local scope inside the same process instance. Local variables stay inside the subprocess unless you propagate them with output mappings. Root-scope process variables are still shared, so parallel or multi-instance embedded subprocess instances can overwrite the same process variable.                                 |
| Call activity           | Starts a new process instance with its own variable scope. Configure the call activity's parent variable propagation settings and input mappings to control which variables the child receives. Use the call activity's child variable propagation settings and output mappings to control which variables are returned to the caller. |
| Multi-instance activity | Each instance has its own local scope. Use input mappings to create per-instance local variables, especially in parallel multi-instance activities, to avoid race conditions when multiple instances update the same process variable.                                                                                                 |

If a form field or task variable should be different for each subprocess or each multi-instance instance, define it as a local variable with an input mapping instead of writing it directly to the root process scope.

Use local variables to isolate data within a specific scope: per-instance data in multi-instance activities (to avoid race conditions when parallel instances update the same root process variable), subprocess-specific data that shouldn't affect sibling instances or the parent scope, and task-specific context that shouldn't persist to the process level. Local variables are removed when a scope is exited unless you explicitly propagate them with output mappings.

**Warning: A local variable blocks later writes of the same name**
If another operation writes a variable with the same name, variable propagation finds the local variable first. This happens when a job completes or an input mapping creates the variable.

Later writes update only the local variable, not the process instance. When the scope exits, Camunda discards the local variable and any updates. The operation appears to succeed, but the change never propagates.

For example, an input mapping creates a local variable `x`. When the element's job completes with a new value for `x` (without an output mapping), it updates the local `x`, not the process instance. The next element still sees the previous value.

To expose a variable outside its scope, use an [output mapping](#inputoutput-variable-mappings).

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

# Variables — Variable scopes — Scope behavior in common modeling patterns

The scope boundary depends on the BPMN element you use:

| Pattern                 | Scope behavior                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embedded subprocess     | Creates a local scope inside the same process instance. Local variables stay inside the subprocess unless you propagate them with output mappings. Root-scope process variables are still shared, so parallel or multi-instance embedded subprocess instances can overwrite the same process variable.                                 |
| Call activity           | Starts a new process instance with its own variable scope. Configure the call activity's parent variable propagation settings and input mappings to control which variables the child receives. Use the call activity's child variable propagation settings and output mappings to control which variables are returned to the caller. |
| Multi-instance activity | Each instance has its own local scope. Use input mappings to create per-instance local variables, especially in parallel multi-instance activities, to avoid race conditions when multiple instances update the same process variable.                                                                                                 |

If a form field or task variable should be different for each subprocess or each multi-instance instance, define it as a local variable with an input mapping instead of writing it directly to the root process scope.

**Tip: When to use local variables**
Use local variables to isolate data within a specific scope, especially for:

- **Per-instance data in multi-instance activities**: Create per-instance copies of variables to avoid race conditions when parallel instances update the same root process variable.
- **Subprocess-specific data**: Variables that should not affect sibling subprocess instances or the parent scope.
- **Task-specific context**: Variables computed for a single task that shouldn't persist to the process level.

Remember: Local variables are removed when a scope is exited unless you explicitly propagate them with output mappings.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

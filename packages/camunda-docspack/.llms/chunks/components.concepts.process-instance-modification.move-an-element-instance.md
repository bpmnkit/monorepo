# Process instance modification — Move an element instance

Use the modification command to move an element instance. The move operation combines termination and activation in a single instruction. It terminates the source element instance and activates a target element in one atomic operation.

**Note**
This is the recommended way to relocate execution within a process instance, as it ensures the operation is performed atomically and correctly handles complex scenarios such as multi-instance subprocesses.

### Use the move instruction API

When using the [modification API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/modify-process-instance.api), you can provide a move instruction with the following parameters:

- **Source element**: Specify the element instance to move from, either by element ID or by element instance key.
- **Target element**: Specify the element ID of the element to activate.
- **Ancestor scope instruction** (for nested elements): Controls how the target element is activated within subprocess hierarchies. See [Move elements inside multi-instance subprocesses](#moving-elements-inside-multi-instance-subprocesses) for details on using this with multi-instance activities.

### Move elements inside multi-instance subprocesses

Move modifications are supported for elements inside multi-instance subprocesses. When you move an element instance within a multi-instance subprocess, the process instance terminates only that specific element instance and activates exactly one target element in the same instance of the multi-instance subprocess.

With move modifications in multi-instance subprocesses, you can relocate execution within a specific iteration of a multi-instance activity without affecting other instances or creating new instances of the multi-instance subprocess.

The **ancestor scope instruction** provides three strategies for controlling how the target element is activated:

- `direct`: Specify the key of the ancestor scope in which the element instance should be created.
- `inferred`: Let the engine automatically find the appropriate ancestor element scope.
- `sourceParent`: Use the source element's parent scope (recommended for moving between sibling elements inside multi-instance subprocesses, as it offers better performance than `inferred`).

**Note**
While move modifications are supported for elements inside multi-instance subprocesses, add (activate) modifications are not. You cannot directly add or activate new tokens for elements inside multi-instance subprocesses. Use move modifications to relocate execution in multi-instance contexts.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification

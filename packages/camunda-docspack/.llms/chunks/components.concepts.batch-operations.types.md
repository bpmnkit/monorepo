# Batch operations — Types

Here are the types of available batch operations:

| Type                      | Description                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Resolve incidents         | Resolves the [incidents](https://docs.camunda.io/docs/next/components/concepts/incidents) associated with a batch of process instances.             |
| Modify process instances  | [Moves](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification) a batch of process instances from one node to another. |
| Migrate process instances | [Migrates](https://docs.camunda.io/docs/next/components/concepts/process-instance-migration) a batch of process instances to a new process version. |
| Cancel process instances  | Cancels a batch of process instances.                                                              |
| Delete process instances  | [Deletes](https://docs.camunda.io/docs/next/components/concepts/process-instance-deletion) a batch of process instances.                            |
| Delete decision instances | [Deletes](https://docs.camunda.io/docs/next/components/concepts/decision-instance-deletion) a batch of decision instances.                          |

Furthermore, depending on the status of the batch operation, you may be able to suspend, cancel, or resume the operation.

**Warning**
Canceling a batch operation does not rollback any changes that have already been produced.

---
Source: https://docs.camunda.io/docs/next/components/concepts/batch-operations

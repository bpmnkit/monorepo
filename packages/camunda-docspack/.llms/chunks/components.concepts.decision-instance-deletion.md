# Decision instance deletion

Permanently delete all data associated with a decision evaluation instance.

Use decision instance deletion to permanently remove all data associated with a decision evaluation instance.

**Warning**
Deletion is irreversible. Restore deleted data only by restoring a backup of your cluster.

- Delete a single decision instance using the [delete decision instance endpoint](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-decision-instance.api).
- Delete multiple decision instances using the [delete decision instances endpoint](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-decision-instances-batch-operation.api).


## Eventual consistency

Decision instance deletion runs asynchronously. Depending on how many decision instances are deleted, it may take time for the data to be removed and for the decision instance to disappear from Operate.

---
Source: https://docs.camunda.io/docs/next/components/concepts/decision-instance-deletion

# Resource deletion — Deleting a process definition — Historic data

By default, deleting a process definition removes it from Zeebe's runtime state only; new instances can no longer be created from it. Its historic data remains in secondary storage until explicitly deleted, so the definition may continue to appear in Operate and Tasklist history views until then.

Optionally enable historic data deletion to permanently remove all data related to the process definition from secondary storage.

**Warning**
Deletion is irreversible. Restore deleted data only by restoring a backup of your cluster.

Delete historic data for a process definition using the [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-resource.api) and set the `deleteHistory` flag to `true`.

You can also delete a process definition with historic data using Operate. See the [Operate user guide](https://docs.camunda.io/docs/next/components/operate/userguide/delete-resources#delete-process-definition).

If you only want to delete process instance data, see [process instance deletion](https://docs.camunda.io/docs/next/components/concepts/process-instance-deletion).

#### Eventual consistency

Historic data deletion runs asynchronously. Depending on the amount of data, it may take time for the data to be removed and for it to disappear from Operate and Tasklist.

If the definition is [draining](#draining), history deletion is deferred: the `deleteHistory` operation does not run when you submit the delete, but only after the definition has been physically deleted on all partitions. Draining instances keep exporting events until they finish, so their historic data cannot be removed before then.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion

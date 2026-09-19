# Resource deletion — Deleting a decision requirements graph

Delete a decision requirements graph (DRG) by sending a [delete resource command](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#deleteresource-rpc) and providing the `decision requirements key` as the `resource key`.

Deleting a DRG also deletes the decisions it contains. Attempts to evaluate a deleted decision result in a `NOT_FOUND` exception. Deleting a DRG also deletes historical data.

### Business rule tasks

A [business rule task](https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks) references a decision by ID. If all versions of that decision are deleted, Zeebe creates an incident on the business rule task indicating that no decision with the given ID can be found.

### Historic data

Optionally enable historic data deletion to permanently remove all data related to the decision definition from secondary storage.

**Warning**
Deletion is irreversible. Restore deleted data only by restoring a backup of your cluster.

Delete historic data for a decision definition using the [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-resource.api) and set the `deleteHistory` flag to `true`.

You can also delete historic data for a decision definition in Operate. See the [Operate user guide](https://docs.camunda.io/docs/next/components/operate/userguide/delete-resources#delete-decision-definition).

If you only want to delete decision instance data, see [decision instance deletion](https://docs.camunda.io/docs/next/components/concepts/decision-instance-deletion).

#### Eventual consistency

Historic data deletion runs asynchronously. Depending on the amount of data, it may take time for the data to be removed and for it to disappear from Operate and Tasklist.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion

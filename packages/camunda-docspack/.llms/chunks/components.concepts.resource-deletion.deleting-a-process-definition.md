# Resource deletion — Deleting a process definition

Delete a process definition by sending a [delete resource command](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#deleteresource-rpc) and providing the `process definition key` as the `resource key`.

You can delete any version of a process definition. After deletion, the definition no longer exists in Zeebe's state and new process instances cannot be created for it. Attempts to create a new instance result in a `NOT_FOUND` exception.

Zeebe **never** reuses a process version. Even after deletion, Zeebe continues tracking version numbers. Deploying a new process with the same ID increments the version as usual.

### Deleting the latest version

When deleting the `latest` version of a process definition, the previous version becomes the new `latest`.

For example, if three versions exist and `Version 3` is the latest, deleting it results in the following:

- No new instances can be created for `Version 3`.
- Creating a new process instance using `latest` creates an instance of `Version 2`.
- If `Version 2` contains timer start events, they are reactivated and triggered according to their schedule.
- If `Version 2` contains message or signal start events, they are reactivated. Publishing a message or broadcasting a signal creates a new process instance of `Version 2`.

Deleting `Version 2` before `Version 3` produces the same behavior, except `Version 1` becomes the new `latest`.

### Call activities

A [call activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities) references a process by ID. If all process definitions for that process ID are deleted, Zeebe creates an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) on the call activity indicating that the referenced process cannot be found.

### Limitations

You cannot delete a process definition that has one or more running process instances. Terminate or complete all running instances before deleting the definition.

### Historic data

Optionally enable historic data deletion to permanently remove all data related to the process definition from secondary storage.

**Warning**
Deletion is irreversible. Restore deleted data only by restoring a backup of your cluster.

Delete historic data for a process definition using the [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-resource.api) and set the `deleteHistory` flag to `true`.

You can also delete a process definition with historic data using Operate. See the [Operate user guide](https://docs.camunda.io/docs/next/components/operate/userguide/delete-resources#delete-process-definition).

If you only want to delete process instance data, see [process instance deletion](https://docs.camunda.io/docs/next/components/concepts/process-instance-deletion).

#### Eventual consistency

Historic data deletion runs asynchronously. Depending on the amount of data, it may take time for the data to be removed and for it to disappear from Operate and Tasklist.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion

# Process instance deletion — Limitations

You can delete only process instances in a completed or terminated state. This preserves consistency and integrity within the system.

If a process instance is still active, cancel it first using the [cancel process instance API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/cancel-process-instance.api).

### Limitations with call activities

When process instances are linked through call activities, deletion is scoped to the selected instance only. Related parent or child process instances are not deleted automatically.

#### Delete a called process instance

If you delete a process instance that was created by a call activity, the parent process instance is not affected. Only the called process instance data is deleted.

In Operate, the parent process instance remains visible, but you can’t navigate to the deleted called process instance.

#### Delete a parent process instance

If you delete a parent process instance that contains a call activity, the called process instance is not affected. Only the parent process instance data is deleted.

In Operate, the called process instance remains visible, but navigating to it shows an empty screen.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-deletion

# Resource deletion — Deleting a process definition

Delete a process definition by sending a [delete resource command](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#deleteresource-rpc) and providing the `process definition key` as the `resource key`.

You can delete any version of a process definition. After deletion, new process instances cannot be created for it: its start events are deactivated immediately, and attempts to create an instance result in a `NOT_FOUND` exception. If the definition has no running instances, it is removed from Zeebe's state right away. If it still has running instances, its record is retained until they finish (see [Draining](#draining)).

Zeebe **never** reuses a process version. Even after deletion, Zeebe continues tracking version numbers. Deploying a new process with the same ID increments the version as usual.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion

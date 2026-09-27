# Resource deletion — Deleting a process definition — Draining

Deleting a process definition that still has running instances is supported and does not block the cluster-wide command distribution queue. Instead of being rejected, the definition enters the `DRAINING` state and is removed automatically once its instances finish:

- **New instances are blocked immediately.** Start events are deactivated at delete time, and attempts to create an instance return `NOT_FOUND`, even though the definition's record still exists while it drains.
- **Running instances continue to completion.** The deletion does not cancel them.
- **Physical removal is asynchronous and per-partition.** Once a partition's last active instance of the definition finishes or is canceled, that partition removes the definition and transitions it to the deleted state.

A process definition moves through the following lifecycle states:

| State      | Meaning                                                                                                                               |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `ACTIVE`   | Deployed and able to create new instances.                                                                                            |
| `DRAINING` | Marked as deleted (new instances are blocked) while running instances drain. The record is retained until the last instance finishes. |
| `DELETING` | The last instance has drained and the definition is being physically removed on the partition. This is a brief internal transition.   |
| `DELETED`  | Fully removed.                                                                                                                        |

The Orchestration Cluster API [process definition `state` field](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-definition.api) exposes `ACTIVE`, `DRAINING`, and `DELETED`. You can also track draining definitions with the `zeebe_process_definitions_draining_count` [metric](https://docs.camunda.io/docs/next/self-managed/operational-guides/monitoring/metrics) and the draining indicator in [Operate](https://docs.camunda.io/docs/next/components/operate/userguide/delete-resources#delete-process-definition).

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion

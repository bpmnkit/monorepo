# Process instance migration

Use process instance migration to change the process definition of a running process instance.

Process instance migration fits a running process instance to a different process definition.
This can be useful when the process definition of a running process instance needs changes due to bugs or updated requirements.
While doing so, we aim to interfere as little as possible with the process instance state during the migration.
For example, a migrated active user task remains assigned to the same user if no implementation migration occurs.
This principle applies to all parts of the process instance.

Use the migration command [RPC](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#migrateprocessinstance-rpc) or [REST](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/migrate-process-instance.api) to change the process model of a running process instance. You can also migrate process instances using Operate's UI — see the [Operate user guide](https://docs.camunda.io/docs/next/components/operate/userguide/process-instance-migration).

**Tip**
If you need to repair a broken process instance without changing the process definition, use [process instance modification](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification) instead.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration

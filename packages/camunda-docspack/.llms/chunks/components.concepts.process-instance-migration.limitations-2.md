# Process instance migration — Limitations (2)

A full overview of error codes can be found in the migration command [RPC](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#migrateprocessinstance-rpc) or [REST](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/migrate-process-instance.api).

**Tip**
If process instance migration does not yet support your specific case, you can use [cancel process instance](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#cancelprocessinstance-rpc) and [run a process segment](https://docs.camunda.io/docs/next/components/concepts/process-instance-creation#run-process-segment) to recreate your process instance in the other process definition.
Note that this results in new keys for the process instance and its associated variables, element instances, and other entities.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration

# Versioning process definitions — Selecting the best versioning approach — Migrating process instances to a new version

_Migrate_ running instances to the newest definition when:

- Deploying _patches or bug fixes_ of a process model.
- _Avoiding operational complexity_ due to different versions running in production is a priority.

Migrating process instances can be achieved either by using the operations tooling or by calling the Zeebe API. You can use the [Orchestration Cluster API (REST)](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/migrate-process-instance.api) or the [Zeebe API (gRPC)](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#migrateprocessinstance-rpc) to migrate a process instance.

Learn more about the concepts of [process instance migration](https://docs.camunda.io/docs/next/components/concepts/process-instance-migration) in the components section. You can also learn [how to migrate process instances in Operate](https://docs.camunda.io/docs/next/components/operate/userguide/process-instance-migration) in it's dedicated section.

It's important to understand that process instance migration _maintains the full 'identity' of the migrated process instances_ including their unique IDs and their full history audit trail. However, as the process definition also might change fundamentally in between versions, this can have effects on the history log of a process instance which might be unexpected from an end user's or operator's perspective.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions

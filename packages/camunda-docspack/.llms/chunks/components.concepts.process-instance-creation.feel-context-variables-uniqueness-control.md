# Process instance creation — FEEL context variables — Uniqueness control

With uniqueness control, you can ensure that only one active root process instance exists for a given **process definition, tenant, and business ID**. This prevents duplicate processing of the same business case.

Uniqueness is checked against **active root process instances**.

- A **root process instance** is a process instance that was started directly, not created by a call activity. Child process instances created via call activities don't count toward the uniqueness check, even though they inherit the parent's business ID.
- When uniqueness control is enabled, creating a root process instance is rejected if another **root** process instance of the same process definition is already active with the same business ID. The rejection returns an `ALREADY_EXISTS` error (HTTP `409 Conflict`).
- Once a process instance is no longer active (completed or terminated), you can use its business ID to create a new process instance.

**Note: Retroactive enforcement**
Uniqueness control is **retroactive**. When you enable it, business IDs that were already assigned to active process instances _before_ the feature was turned on are taken into account. This prevents duplicate instances from being created after the feature is enabled, even if duplicates already existed before activation.

Uniqueness control is opt-in. Enable it using the configuration property [`camunda.process-instance-creation.business-id-uniqueness-enabled`](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#process-instance-creation). For SaaS, configure this in the cluster configuration via Camunda Hub. For Self-Managed, set it in the application config (for example, `application.yaml` or as an environment variable).

**Note**
When a business ID is specified, the partition for the new process instance is determined deterministically by **hashing the business ID**, rather than using the default round-robin distribution. This ensures that uniqueness checks occur on a single partition.

Be aware that this may result in uneven distribution of instances across partitions if business IDs are not well distributed.

#### Multi-tenancy scope

In a multi-tenant environment, uniqueness is enforced **per tenant and process definition**. Process instances belonging to different tenants can use the same business ID and process definition without conflict. For example, two active root process instances in different tenants may share the same business ID and process definition.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation

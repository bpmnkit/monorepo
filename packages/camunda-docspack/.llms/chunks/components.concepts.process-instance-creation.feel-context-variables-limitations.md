# Process instance creation — FEEL context variables — Limitations

- **Jobs** carry the business ID in the job activation response but cannot be searched or filtered by business ID. No UI surface exposes job-level business ID visibility.
- When using [cluster scaling](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/operations/cluster-scaling) to increase the number of partitions, new process instances created with a business ID are only distributed across the original set of partitions, not to any newly added partitions.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation

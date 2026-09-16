# Self-Managed resource planning — Baseline resource configuration — without-optimize

The following configuration provides a baseline equivalent to a 1x SaaS cluster without Optimize enabled.

<!-- TODO: Validate these resource numbers against 8.9 benchmarks. The Orchestration Cluster CPU request of 3 cores reflects the 8.8 streamlined architecture. Confirm max throughput and max stored PI for this configuration. -->

| Component                 |                     | Request | Limit |
| ------------------------- | ------------------- | ------: | ----: |
| **Orchestration Cluster** |                     |         |       |
| Brokers                   | 3                   |         |       |
| Partitions                | 3                   |         |       |
| Replication factor        | 3                   |         |       |
|                           | vCPU \[cores\]      |       3 |     3 |
|                           | Memory \[GB\]       |       2 |     2 |
|                           | Disk \[GB\]         |         |   128 |
| **Connectors**            |                     |         |       |
| #                         | 1                   |         |       |
|                           | vCPU \[cores\]      |     0.2 |   0.2 |
|                           | Memory limit \[GB\] |   0.512 |     1 |
| **Elastic**               |                     |         |       |
| #statefulset              | 3                   |         |       |
|                           | vCPU \[cores\]      |       3 |     3 |
|                           | Memory limit \[GB\] |       2 |     2 |
|                           | Disk request \[GB\] |         |   128 |

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

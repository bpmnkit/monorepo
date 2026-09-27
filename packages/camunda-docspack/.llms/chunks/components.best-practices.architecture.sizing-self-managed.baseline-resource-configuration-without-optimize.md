# Self-Managed resource planning — Baseline resource configuration — without-optimize

The following configuration is the exact Helm values Camunda runs in its continuous realistic-load tests without Optimize enabled (see [How we test](#how-we-test)).

| Component                 |                     | Request | Limit |
| ------------------------- | ------------------- | ------: | ----: |
| **Orchestration Cluster** |                     |         |       |
| Brokers                   | 3                   |         |       |
| Partitions                | 3                   |         |       |
| Replication factor        | 3                   |         |       |
|                           | vCPU \[cores\]      |       3 |     3 |
|                           | Memory \[GB\]       |       2 |     2 |
|                           | Disk \[GB\]         |         |    64 |
| **Connectors**            |                     |         |       |
| #                         | 1                   |         |       |
|                           | vCPU \[cores\]      |     0.2 |   0.2 |
|                           | Memory limit \[GB\] |   0.512 |     1 |
| **Identity**              |                     |         |       |
| #                         | 1                   |         |       |
|                           | vCPU \[cores\]      |     0.6 |     2 |
|                           | Memory limit \[GB\] |     0.4 |     2 |
| **Keycloak**              |                     |         |       |
| #                         | 1                   |         |       |
|                           | vCPU \[cores\]      |       1 |     2 |
|                           | Memory limit \[GB\] |       1 |     2 |
| **Elastic**               |                     |         |       |
| #statefulset              | 3                   |         |       |
|                           | vCPU \[cores\]      |       7 |     7 |
|                           | Memory limit \[GB\] |       8 |     8 |
|                           | Disk request \[GB\] |         |   256 |

**Note**
Elasticsearch is deliberately overprovisioned in this configuration. Our test harness uses the same Elasticsearch sizing regardless of whether Optimize is enabled, ensuring that Elasticsearch does not become a bottleneck during stress testing. If you do not use Optimize, you can generally start with fewer resources (see [Elasticsearch scaling](#elasticsearch-scaling)) and scale up as your data volume grows.

Identity and Keycloak, including Keycloak’s bundled PostgreSQL database, which is not itemized here, are included because our test harness always authenticates through OIDC, reflecting a production-like setup. If you plan to use an external identity provider instead of the bundled Keycloak, you can omit this row entirely.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

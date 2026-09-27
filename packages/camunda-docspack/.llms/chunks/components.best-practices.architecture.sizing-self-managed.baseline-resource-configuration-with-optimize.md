# Self-Managed resource planning — Baseline resource configuration — with-optimize

When Optimize is enabled, additional resources are needed, especially for Elasticsearch, because Optimize's importer reads from and writes to Elasticsearch indices. See [Impact of Optimize](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment#impact-of-optimize) for more details.

The following configuration is the exact Helm values Camunda runs in its continuous realistic-load tests with Optimize enabled (see [How we test](#how-we-test)).

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
| **Optimize**              |                     |         |       |
| #                         | 1                   |         |       |
|                           | vCPU \[cores\]      |     0.6 |     2 |
|                           | Memory limit \[GB\] |       1 |     2 |
| **Elastic**               |                     |         |       |
| #statefulset              | 3                   |         |       |
|                           | vCPU \[cores\]      |       7 |     7 |
|                           | Memory limit \[GB\] |       8 |     8 |
|                           | Disk request \[GB\] |         |   256 |

**Note**
The Elasticsearch sizing above is identical to that in the configuration without Optimize. Our test harness uses the same Elasticsearch sizing regardless of whether Optimize is enabled, ensuring that Elasticsearch does not become a bottleneck during stress testing.

The same applies to Identity and Keycloak. You can omit these components if you plan to use an external identity provider.

The Orchestration Cluster, Connectors, and Optimize values match the exact Helm values used in our continuous, realistic-load tests. Retention is set to one day for the Camunda Exporter and three days for the legacy Elasticsearch exporter, where still applicable. This gives the Optimize importer time to catch up before the data is removed. See [Elasticsearch scaling](#elasticsearch-scaling) for information about how retention affects disk sizing. Day-based metrics assume that the load is distributed evenly over 24 hours.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

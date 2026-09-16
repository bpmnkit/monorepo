# Self-Managed resource planning — Baseline resource configuration — with-optimize

When Optimize is enabled, additional resources are needed, especially for Elasticsearch, because Optimize's importer reads from and writes to Elasticsearch indices. See [Impact of Optimize](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment#impact-of-optimize) for more details.

<!-- TODO: Validate these resource numbers against 8.9 benchmarks. These numbers are based on the Optimize V2 experiment (minimum ES resources for realistic workload at 1 PI/s with 101 tasks/s). -->

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
| **Optimize**              |                     |         |       |
| #                         | 1                   |         |       |
|                           | vCPU \[cores\]      |     0.6 |     2 |
|                           | Memory limit \[GB\] |       1 |     2 |
| **Elastic**               |                     |         |       |
| #statefulset              | 3                   |         |       |
|                           | vCPU \[cores\]      |       7 |     7 |
|                           | Memory limit \[GB\] |       6 |     8 |
|                           | Disk request \[GB\] |         |   512 |

**Note**
The numbers in the tables were measured using a [realistic process](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/bankCustomerComplaintDisputeHandling.bpmn) with a [realistic payload](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/realisticPayload.json) (~11 KB). To calculate day-based metrics, an equal distribution over 24 hours is assumed.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

# Size your environment — Sizing requirements and influencing factors — Data availability latency

Data availability latency is the time between an event occurring in the engine and it being queryable in Operate, Tasklist, or Optimize. Under heavy load or with Optimize enabled, this can lag from seconds to minutes.

Data availability latency is influenced by:

- **Exporter throughput:** The rate at which the Camunda Exporter can write events to Elasticsearch (ES).
- **Elasticsearch indexing speed:** How quickly ES can index incoming documents.
- **Elasticsearch disk usage:** High disk utilization (above ~70%) significantly increases indexing latency. Monitor ES disk usage and scale storage before hitting this threshold.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

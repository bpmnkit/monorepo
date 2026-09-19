# Data flow — Export pipeline

After the engine processes a command, it confirms its state change with an event on the log. Exporters asynchronously read such events from the log (only committed events) and write them to secondary storage in _batches_. See it in blue in the diagram below:

![Camunda 8.8+ architecture overview - Data Flow Export pipeline](assets/architecture-8.8plus-data-flow-export-path.jpg)

**The exporters run on the same leader as the engine.** They are partition-bounded and cannot scale independently of partition count. There are three built-in exporters in play:

- **[Camunda Exporter](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/exporters/camunda-exporter)**: aggregates and writes enriched data to secondary storage (ES/OS) for Operate, Tasklist, and the REST Query API
- **[RDBMS Exporter](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/exporters/rdbms-exporter)**: aggregates and writes enriched data to secondary storage (RDBMS) for Operate, Tasklist, and the REST Query API.
- **[Elasticsearch Exporter](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/exporters/elasticsearch-exporter) / [OpenSearch Exporter](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/exporters/opensearch-exporter)**: writes raw engine events into specific Elasticsearch/OpenSearch indices, consumed by Optimize.

The Camunda Exporter and RDBMS Exporter are mutually exclusive, only one can be enabled at a time. The Elasticsearch/OpenSearch exporter is independent and can be enabled alongside either of the other two.

**Note**
Read events are applied to the registered exporters one by one, in the same order as they appear on the log. Each event is applied to ALL exporters before the next event is processed.

The exporters track their position in the Exporter state (backed by RocksDB). If the exporting backlog grows over a certain threshold, Camunda reduces the record write rate via a corresponding [flow control](https://docs.camunda.io/docs/next/self-managed/operational-guides/configure-flow-control/configure-flow-control) mechanics to keep the exporting backlog manageable. In extreme cases, client commands are rejected via the standard backpressure mechanism.

Exporter behavior and performance is important for the system, because:

- If an exporter falls behind, it holds up all exporters for that partition.
- Slow secondary storage directly reduces process execution throughput.
- Custom exporters can have a high impact on overall throughput if they are not performant enough.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow

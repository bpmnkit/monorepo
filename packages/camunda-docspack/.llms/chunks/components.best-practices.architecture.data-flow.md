# Data flow

Understand how data moves through Camunda 8.8+ and why it matters when sizing your environment.

Understand how data moves through Camunda 8.8+ and why it matters when sizing your environment.


## About

Camunda 8.8 introduced a consolidated [Orchestration Cluster](https://docs.camunda.io/docs/next/components/orchestration-cluster).
This is an overview of Camunda 8.8+ architecture:

![Camunda 8.8+ architecture overview](assets/architecture-8.8plus.jpg)

<!-- Source: Miro board https://miro.com/app/board/uXjVGiNnJBc=/ -->

See the [reference architecture](https://docs.camunda.io/docs/next/self-managed/reference-architecture/reference-architecture) for a component-topology overview.

### How Camunda stores data

Every record in Camunda passes through two distinct storage layers. Understanding the difference between them is the key to understanding sizing.

- **[Primary storage](https://docs.camunda.io/docs/next/reference/glossary#primary-storage)** is the multi-Raft cluster in Camunda, with partitions as the scaling unit. Each partition has a Raft append-only log, RocksDB to store internal state, and snapshots for compaction. All writes land here first. It is durable and strongly consistent, but it is not directly queryable from outside the cluster. Each partition has exactly one leader responsible for both processing commands and exporting records.
- **[Secondary storage](https://docs.camunda.io/docs/next/reference/glossary#secondary-storage)** is an external data storage where events are written, such as Elasticsearch, OpenSearch, or an RDBMS (available from 8.9). It is eventually consistent and populated asynchronously by the export pipeline. Everything Operate, Tasklist, Identity, and the REST Query API reads comes exclusively from secondary storage.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow

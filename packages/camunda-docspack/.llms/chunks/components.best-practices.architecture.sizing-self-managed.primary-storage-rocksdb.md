# Self-Managed resource planning — Primary storage — RocksDB

The leader of a partition processes commands and applies committed events to its RocksDB state. Followers continuously replay the same committed events into their local RocksDB state without processing commands, keeping them warm and ready for fast failover if the leader changes.

In practice, the RocksDB state of a partition grows to around 2 GB under heavy load with long-running processes. Snapshot replication brings new or lagging followers fully up to date; it is not how followers normally maintain their state.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

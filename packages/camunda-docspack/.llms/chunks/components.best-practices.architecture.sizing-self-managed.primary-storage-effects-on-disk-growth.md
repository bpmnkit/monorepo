# Self-Managed resource planning — Primary storage — Effects on disk growth

**Exporter or external system failure.** If a system an exporter depends on fails (for example, a lost connection to Elasticsearch), the exporter stops advancing its position and brokers can't truncate their logs. The log grows until the connection is restored. Size broker disks with enough headroom to keep operating through an outage.

During a [hot backup (soft-pause window)](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/operations/management-api#soft-pause-exports), log compaction is intentionally blocked for the backup's duration. This adds a predictable, temporary disk requirement: roughly `throughput × backup_window_duration` of extra log data per partition, replicated across followers. Size disks with headroom for at least one full backup window on top of steady-state estimates.

**Node failure.** Only the leader exports events, and only committed (replicated) events are passed to exporters. An exporter's read position is only captured in snapshots, never in the event log itself; it can't be reconstructed from the log alone. When a partition fails over to a new leader, the new leader reconstructs state by projecting the log from the last snapshot, but the exporter position resets to that snapshot too. This means an exporter can see the same events twice after a failover. Assign idempotent IDs in your exporter (the combination of record position and partition ID is a reliable unique key) if this matters for your system.

**Quorum loss.** If a partition drops below quorum (for example, two nodes down in a three-node cluster), the leader keeps accepting requests, but they aren't replicated or committed, so they can't be truncated, and the event log grows. The disk space needed to ride this out is a function of broker throughput and how long it takes to restore quorum; size nodes with enough headroom to absorb this failure mode.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

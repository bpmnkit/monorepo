# Self-Managed resource planning — Primary storage — Event log

The event log for each partition is segmented. By default, the segment size is 128 MB. The event log grows over time unless and until individual segments are deleted.

An event log segment can be deleted once:

- All the events it contains have been processed by exporters.
- All the events it contains have been replicated to other brokers.
- All the events it contains have been processed.

The following conditions inhibit automatic deletion:

- The cluster loses quorum. Events are queued but not processed until quorum is reestablished.
- An exporter does not advance its read position. The event log grows without bound.

Exporting occurs only on the partition leader. Followers do not delete their replicas of a segment until the leader marks the segment as no longer needed by exporters. A segment is not deleted until a snapshot that includes it has been taken, and only log entries up to that snapshot can be deleted.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

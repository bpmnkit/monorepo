# Self-Managed resource planning — Primary storage — Snapshots

The running state of a partition is captured periodically on the leader. By default, a snapshot is taken every five minutes, as configured by `snapshot-period`. A snapshot is a projection of all events that represent the current running state, including deployed processes, active process instances, and jobs that have not yet been completed. Writing a new snapshot deletes all log data written before the snapshot.

**Note**
The snapshot interval was tested in a Zeebe Chaos experiment. Learn more in the [Zeebe Chaos blog](https://camunda.github.io/zeebe-chaos/2022/02/01/High-Snapshot-Frequency/#snapshot-interval).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

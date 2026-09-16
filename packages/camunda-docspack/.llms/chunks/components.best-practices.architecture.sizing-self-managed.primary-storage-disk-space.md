# Self-Managed resource planning — Primary storage — Disk space

All brokers in a partition use disk space to store:

- The event log for each partition in which they participate. By default, the event log has a minimum size of 128 MB per partition and grows in 128 MB segments. It is truncated once its data has been processed and successfully exported by all loaded exporters.
- A periodic snapshot of the running state (in-flight data) of each partition. Its size is unbounded and depends on the amount of in-flight work.

Every partition instance hosted by a broker, whether a leader or follower, also uses disk space to store a projection of the partition’s running state in RocksDB. Its size is unbounded and depends on the amount of in-flight work. See [RocksDB](#rocksdb) below to learn how leaders and followers build this state differently.

Use the following formula as a starting point for estimating the required disk space:

```
neededDiskSpace = replicatedState + localState

replicatedState = totalEventLogSize + totalSnapshotSize

totalEventLogSize = followerPartitionsPerNode * eventLogSize * reserveForPartialSystemFailure

totalSnapshotSize = partitionsPerNode * singleSnapshotSize * 2
// singleSnapshotSize * 2:
//   the last snapshot (already replicated) +
//   the next snapshot (in transit, while it is being replicated)

partitionsPerNode = leaderPartitionsPerNode + followerPartitionsPerNode

leaderPartitionsPerNode = partitionsCount / numberOfNodes
followerPartitionsPerNode = partitionsCount * replicationFactor / numberOfNodes

clusterSize = [number of broker nodes]
partitionsCount = [number of partitions]
replicationFactor = [number of replicas per partition]
reserveForPartialSystemFailure = [factor to account for partial system failure]
singleSnapshotSize = [size of a single RocksDB snapshot]
eventLogSize = [event log size for duration of snapshotPeriod]
```

- `eventLogSize` scales with the throughput of your system.
- `totalSnapshotSize` scales with the number of in-flight process instances.
- `reserveForPartialSystemFailure` is a reserve to account for partial system failure, such as loss of quorum inside the cluster or loss of connection to an external system. See [effects on disk growth](#effects-on-disk-growth) below.

The relevant configuration settings are:

```yaml
camunda:
  cluster:
    partition-count: 1
    replication-factor: 1
    size: 1
  data:
    snapshot-period: 5m
    primary-storage:
      log-stream:
        log-segment-size: 128MB
```

| Environment variable                                   | Default |
| ------------------------------------------------------ | ------- |
| `CAMUNDA_DATA_PRIMARYSTORAGE_LOGSTREAM_LOGSEGMENTSIZE` | `128MB` |
| `CAMUNDA_DATA_SNAPSHOTPERIOD`                          | `5m`    |
| `CAMUNDA_CLUSTER_PARTITIONCOUNT`                       | `1`     |
| `CAMUNDA_CLUSTER_REPLICATIONFACTOR`                    | `1`     |
| `CAMUNDA_CLUSTER_SIZE`                                 | `1`     |

Other factors are best observed in a production-like system under representative throughput.

By default, this data is stored in the following directories:

- `segments`: The append-only log, split into segments. Data can be deleted once it becomes part of a new snapshot.
- `state`: The active state (deployed processes, active process instances, and so on). Completed process instances or jobs are removed.
- `snapshot`: A state at a certain point in time.

**Caution: Avoid unbounded log growth**
Do not configure an exporter that does not advance its record position, such as the Debug Exporter. If you configure an exporter, monitor its availability and the health of its dependencies. An exporter that stops advancing prevents log truncation, causing data to accumulate on disk until the issue is resolved. See [effects on disk growth](#effects-on-disk-growth).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

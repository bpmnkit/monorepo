# Self-Managed resource planning — Memory

Memory usage is determined by the Java heap size (by default, [25% of the maximum RAM](https://docs.oracle.com/en/java/javase/21/gctuning/ergonomics.html#GUID-DA88B6A6-AF89-4423-95A6-BBCBD9FAE781)) and native memory usage (also 25% by default); the JVM can use up to 50% of available RAM.

Zeebe supports three RocksDB memory allocation strategies, configured using `CAMUNDA_DATA_PRIMARYSTORAGE_ROCKSDB_MEMORYALLOCATIONSTRATEGY`:

- **`FRACTION`** (the default starting with 8.10): Total RocksDB memory is calculated as `..._MEMORYFRACTION` (default: `0.1`, or 10%) of the broker’s total system memory and is shared across all partitions on the broker.
- **`PARTITION`** (the default before 8.10): Total RocksDB memory is calculated by multiplying the number of partitions on the broker by `CAMUNDA_DATA_PRIMARYSTORAGE_ROCKSDB_MEMORYLIMIT` (default: 512 MB).
- **`BROKER`**: Total RocksDB memory is equal to `..._MEMORYLIMIT` and is shared across all partitions on the broker, regardless of the number of partitions.

When hardcoding memory values using `PARTITION` or `BROKER`, consider the following:

- Zeebe relies heavily on memory-mapped files, so sufficient OS page cache is required. Insufficient page cache degrades I/O performance.
- Reserve 20-30% of total memory for the OS page cache as a starting point, adjusting based on observed performance. The right amount depends on partition count and system throughput.

The minimum memory usage (using the `PARTITION` strategy) is:

| Component          |                    Amount |
| ------------------ | ------------------------: |
| Java heap          |                       25% |
| Java native memory |                       25% |
| RocksDB            |  512 MB × partition count |
| OS page cache      |                    20-30% |
| **Sum**            | **x MB + 50% of max RAM** |

When using `FRACTION`, replace the RocksDB row with `memory-fraction × total memory` (10% by default) instead.

### Keep the default `FRACTION` strategy for primary storage

As of 8.10, `FRACTION` is the shipped default for primary storage: no action is required to benefit from it on a new deployment.

`FRACTION` scales with the broker's actual memory automatically, unlike `PARTITION` and `BROKER`, which are absolute limits: if you resize a broker's memory or change its partition count, you have to remember to retune the limit too, or RocksDB's share of memory silently stays where it was. This also mirrors the direction Camunda SaaS already takes for primary storage.

If you're upgrading from a version before 8.10 and previously relied on the `PARTITION` default, your effective RocksDB memory allocation changes on upgrade unless you set the strategy explicitly. See the [8.10 release notes](https://docs.camunda.io/docs/next/reference/announcements-release-notes/8100/8100-release-notes#default-rocksdb-memory-allocation-strategy-changed-to-fraction) for details.

```yaml
camunda:
  data:
    primary-storage:
      rocks-db:
        memory-allocation-strategy: fraction
        memory-fraction: 0.1
```

**Caution**
`FRACTION` splits its budget across **all** partitions on a broker, the same way `BROKER` does. Unlike `PARTITION`, it does not scale up with partition count. On a broker with many partitions but modest total memory, a flat 10% fraction can allocate less RocksDB memory than a previously tuned fixed limit would have. An optional minimum-floor setting for `FRACTION` is proposed in [camunda/camunda#57768](https://github.com/camunda/camunda/issues/57768) (open) to address exactly this; until it ships, verify the resulting absolute memory is enough for your partition count, and fall back to an explicit `..._MEMORYLIMIT` if it isn't.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

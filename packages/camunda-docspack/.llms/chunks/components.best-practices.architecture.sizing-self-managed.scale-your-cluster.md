# Self-Managed resource planning — Scale your cluster

Once you have a baseline configuration running, you can scale in several ways:

### Horizontal scaling

Add more brokers and partitions to increase throughput capacity. Partitions can be [scaled up](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/operations/cluster-scaling) but not down, so avoid over-provisioning.

When scaling horizontally, **secondary storage often becomes the limiting factor**. Adding brokers increases export volume to Elasticsearch/OpenSearch. If secondary storage isn't scaled accordingly, it will bottleneck overall throughput. See [Elasticsearch scaling](#elasticsearch-scaling) for guidance.

### Vertical scaling

Increase CPU and memory per broker. Note that there are **diminishing returns** due to component interdependencies. For example, Elasticsearch indexing speed can bottleneck broker throughput.

### Elasticsearch scaling

- **Memory:** Increase Elasticsearch memory to store more historical data without performance degradation.
- **Nodes:** Add Elasticsearch statefulset replicas for more IOPS and query throughput.
- **Disk size:** Increase disk size based on your data retention requirements. With Optimize enabled and a realistic payload (~11 KB), Elasticsearch disk can fill rapidly (for example, 128 Gi in under 12 hours at 1 PI/s with 30-day retention).
- **Disk type:** Use SSDs for Elasticsearch storage. Disk latency, not throughput, is the critical factor. HDD-backed Elasticsearch has been observed to cause 8–10s flush durations, a growing export backlog, increased broker memory from in-flight records, and up to ~70% throughput degradation versus an equivalent SSD setup. See the [slow disk chaos day experiment](https://camunda.github.io/zeebe-chaos/2026/06/19/Using-slow-disk-with-Camunda) for details, and [Export pipeline](https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow#export-pipeline) for background on how slow secondary storage affects overall throughput.
- **Index replicas:** The disk estimates in the baseline tables above do not account for index-level replicas. In multi-node clusters, configure at least one replica per index for fault tolerance. Each replica stores a full copy of the primary shard data, approximately doubling total disk usage. See [managing replicas](https://docs.camunda.io/docs/next/self-managed/concepts/secondary-storage/managing-secondary-storage#replicas).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

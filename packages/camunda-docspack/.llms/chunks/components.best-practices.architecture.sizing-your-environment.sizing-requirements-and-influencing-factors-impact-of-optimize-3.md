# Size your environment — Sizing requirements and influencing factors — Impact of Optimize (3)

#### Elasticsearch/OpenSearch shard budget

**Warning**
Optimize creates a dedicated index per deployed process definition, each using at least one shard. Elasticsearch and OpenSearch cap the number of shards per node (1,000 by default), so a cluster's total shard budget is `nodes × per-node limit` (for example, 3,000 on a three-node cluster). A large or growing number of deployed process definitions consumes this budget and can approach the ceiling; small development or test clusters with few nodes reach it quickly. Once the ceiling is hit, new index creation is rejected, which cascades into exporter backpressure and stalled processing.

Account for shard budget when sizing the Elasticsearch/OpenSearch cluster, not just CPU, memory, and disk. See [impact of high process deployments on Elasticsearch](https://camunda.github.io/zeebe-chaos/2026/05/28/Impact-of-High-Process-Deployments-on-Elasticsearch).

#### Zeebe record ILM retention

When the [Elasticsearch exporter retention policy](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/exporters/elasticsearch-exporter#retention) is enabled, Zeebe record indices are deleted after the configured `minimum-age`. Optimize reads from these same indices, so the retention window must be long enough to cover Optimize's worst-case import lag. If the exporter deletes records before Optimize imports them, process instance completion events are permanently lost: Optimize records the instance as `ACTIVE` with no `endDate`, and history cleanup can never remove it.

**Minimum recommended retention:** Set `minimum-age` to at least **3 days** when running Optimize; **7 or more days** is recommended. This provides headroom for:

- Import lag that grows as the Optimize process instance index grows larger.
- Recovery time after Elasticsearch cluster events such as node restarts, rolling upgrades, and shard rebalancing.

The default `minimum-age` of `30d` provides sufficient headroom. If you reduced it to limit disk usage, verify that the new value still exceeds your observed Optimize import lag before applying it to production.

**Disk sizing:** A longer ILM retention window means Zeebe record indices are kept on disk longer before deletion. Factor the additional raw exporter index volume into your Elasticsearch disk budget when increasing `minimum-age` beyond the default.

**Self-reinforcing failure mode:** As Optimize's process instance index grows, Elasticsearch write latency increases, which raises per-batch import lag. Higher import lag increases the probability of an ILM race on the next cluster event. This cycle compounds on long-lived clusters running at sustained load. To break it, increase ILM retention and reduce the Optimize index size through history cleanup or variable filtering.

**Symptom:** If Optimize history cleanup runs on schedule but consistently completes in zero seconds against a large dataset, orphaned `ACTIVE` documents are likely accumulating. See [diagnosing stalled cleanup](https://docs.camunda.io/docs/next/self-managed/components/optimize/configuration/history-cleanup#diagnosing-stalled-cleanup).

The sizing guidance for [Self-Managed](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed#baseline-resource-configuration) provides configurations with and without Optimize to help you plan accordingly.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

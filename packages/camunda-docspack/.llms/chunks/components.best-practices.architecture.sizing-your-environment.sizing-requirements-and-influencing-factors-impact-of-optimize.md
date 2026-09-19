# Size your environment — Sizing requirements and influencing factors — Impact of Optimize

Optimize is an optional component that provides process analytics and reporting. When enabled, it has significant implications for sizing.

**Note**
The data below comes from Camunda 8.9 load tests. Because 8.8 and 8.9 share the same exporter architecture, it applies to 8.8+ as well.

#### In short

- Enabling Optimize roughly **triples to quadruples Elasticsearch CPU and disk usage** at a [realistic workload](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-benchmarks#reference-benchmark-scenario) (around 3.4x CPU and 3.6x disk), largely independent of throughput.
- It lowers achievable **processing throughput by 25-50% at maximum load** on the same hardware.
- The single most effective mitigation is to **keep variables out of Optimize**. This recovers around 60% of the storage and 65% of the CPU, plus most of the lost throughput, at the cost of variable-based analytics.
- Size Elasticsearch/OpenSearch accordingly (CPU, disk, **and shard budget**), or run Optimize on a **dedicated Elasticsearch/OpenSearch instance**.

For how Optimize fits into the export pipeline, see [Optimize data flow](https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow#optimize-data-flow). The full studies behind these numbers are [Impact of Optimize on Camunda](https://camunda.github.io/zeebe-chaos/2026/06/10/Impact-of-Optimize-on-Camunda) and [Reducing Optimize's Elasticsearch overhead](https://camunda.github.io/zeebe-chaos/2026/06/25/Impact-of-Optimize-Variable-Filtering).

#### Why Optimize matters for sizing

- Optimize is a second-tier consumer of the export pipeline: the Elasticsearch/OpenSearch exporter writes raw engine events, Optimize's importer reads them and writes its own analytics indices back to Elasticsearch/OpenSearch, so data is written to secondary storage twice. See [Optimize data flow](https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow#optimize-data-flow).
- In Camunda 8.8+, the Camunda Exporter and the Elasticsearch exporter run in the same thread within the broker, so Optimize data-pipeline competes directly with core platform exporting for throughput.
- The overhead is **not proportional to throughput.** It scales with process model complexity (multi-instance and call activities) and variable volume. At a realistic workload where Optimize-enabled and Optimize-disabled clusters reached identical throughput with zero backpressure, the Optimize-enabled cluster still consumed **around 3.4x more Elasticsearch CPU.** Budget for this even at comfortable throughput.

#### What Optimize affects

At a [realistic workload](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-benchmarks#reference-benchmark-scenario), with Optimize enabled vs. disabled:

- **Elasticsearch CPU:** around 3.4x higher.
- **Elasticsearch disk:** around 3.6x more total data.
- **Throughput:** unaffected at a realistic workload, but 25-50% lower at maximum load on the same hardware.
- **Write-to-exporting latency:** around 2.6x higher.
- **Backpressure at maximum load:** around 45% with Optimize vs. 35% without.
- **Individual import latency:** increases approximately linearly with payload size.
- **Report loading times:** increase approximately linearly with the data complexity (such as process instances and variables) and as historical data accumulates.

Secondary storage memory is not a meaningful differentiator for improving performance.

**Tip**
**Watch Optimize import lag.** When Optimize's importer falls behind the export rate, two problems can appear:

- **Optimize's analytics indices grow.** Optimize keeps one document per process instance and can only apply retention-based cleanup once its importer has processed the instance's completion. While the importer lags, completions are recorded late, cleanup is deferred, and Optimize's own indices grow beyond their steady-state size.
- **Data can be missed.** The raw exporter indices are cleaned up on the Elasticsearch/OpenSearch retention schedule. If the importer falls far enough behind, those records are deleted before Optimize imports them, and that data never reaches Optimize. This Exporter-Importer hazard is exactly what the 8.8 Camunda Exporter architecture removed for Operate and Tasklist.

Track import progress with the [Optimize metrics and bundled Grafana dashboards](https://docs.camunda.io/docs/next/self-managed/operational-guides/monitoring/metrics). If you see persistent import lag, raise the import throughput (see [mitigations](#mitigations) for details).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

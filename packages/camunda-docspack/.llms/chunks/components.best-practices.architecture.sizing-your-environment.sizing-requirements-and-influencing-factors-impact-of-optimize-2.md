# Size your environment — Sizing requirements and influencing factors — Impact of Optimize (2)

#### Mitigations

##### Keep variables out of Optimize (highest impact, lowest risk)

Variables account for most of Optimize's storage and CPU usage in the secondary storage layer. In benchmarks, disabling Optimize's variable storage reduced its disk usage by a factor of **approximately 14** relative to the raw export. Isolating a group of customer-related variables showed an even larger difference, a factor of **approximately 29**, driven primarily by object variable flattening, described below, rather than by the variable values themselves. See [Optimize data flow](https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow#optimize-data-flow) for an explanation of the underlying storage mechanism.

Almost all of this cost comes from Optimize's indices. The following three levers are listed from most to least aggressive:

- **Stop exporting variables entirely.** Set `camunda.data.exporters.elasticsearch.args.index.variable: false` (OpenSearch: `camunda.data.exporters.opensearch.args.index.variable: false`) at the exporter to drop all variable records. This is the only lever that also recovers throughput because the exporter write path is the bottleneck at maximum load.
- **Export only the variables you need (name and prefix filters).** Keep a subset with name or prefix filters, for example only `customer`-prefixed variables. Use this when some variables drive Optimize reports, but most are noise. On SaaS, configure variable name filters in [cluster settings](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/settings#data-filters). On Self-Managed, see [Optimize export filtering](https://docs.camunda.io/docs/next/self-managed/components/optimize/configuration/optimize-export-filtering).
- **[Disable variable import](https://docs.camunda.io/docs/next/self-managed/components/optimize/configuration/variable-import) in Optimize.** Available on all supported versions; achieves the storage savings but does not recover throughput, because the records are still written by the exporter.

**Trade-off:** Filtered variables are unavailable in Optimize reports, including variable filters, variable-based grouping, and raw-data variable columns. These levers affect **Optimize only**; Operate and Tasklist read through the Camunda Exporter, so their variables stay intact.

##### Disable object variable flattening (high impact for object-heavy processes)

By default, Optimize [flattens each object variable](https://docs.camunda.io/docs/next/self-managed/components/optimize/configuration/object-variables) into a separate variable for each property and stores the full raw object as another variable. Each generated variable incurs its own storage cost, so an object variable with several properties can require several times more storage than a single scalar variable.

If you don't rely on flattened object-variable filtering, grouping, or raw-data columns in Optimize reports, disable it by setting:

- Environment variable: `CAMUNDA_OPTIMIZE_ZEEBE_INCLUDE_OBJECT_VARIABLE=false`
- Configuration property: `zeebe.includeObjectVariableValue: false`

**Note**
This behavior is enabled by default in Self-Managed and disabled in Camunda 8 SaaS.

In an isolated benchmark that changed only this setting for the same workload:

- Optimize's share of total Elasticsearch disk usage dropped from 62.8% to 7.6%, a reduction by a factor of 8.3.
- Total secondary storage per created process instance dropped from 6.34 MB to 2.97 MB, a reduction by a factor of 2.13. This reduction was smaller because the setting does not affect Zeebe or Camunda Exporter storage.

See [Confirming Optimize's object variable flattening cost with a controlled A/B test](https://camunda.github.io/zeebe-chaos/2026/07/09/Optimize-Object-Variable-Flattening/) for the complete methodology and additional measurements.

**Warning**
These ratios are specific to the benchmark's payload and process models; they are not universal constants. Object variable flattening processes nested JSON recursively without a depth limit, so payloads with deeper nesting or more object fields can require considerably more storage than measured here. Measure your workload before using these numbers for capacity planning.

##### Other mitigations

- **Run Optimize on a separate Elasticsearch/OpenSearch instance.** Contention is bidirectional: Optimize's write spikes degrade Operate, Tasklist, and the Camunda Exporter, while heavy exporter activity degrades Optimize import. Isolation removes this mutual interference.
- **Tune retention periods.** Shorter retention means less data in Elasticsearch/OpenSearch and better performance.
- **Increase import throughput if Optimize lags.** If you notice a significant lag between the rate of exported Zeebe records and imported Optimize data, raise `CAMUNDA_OPTIMIZE_ZEEBE_MAX_IMPORT_PAGE_SIZE` so each import cycle fetches more exported records. This helps Optimize keep pace under high load, but increases memory use per fetch and can negatively impact individual record latency, as Optimize must wait to fill larger batches before processing.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

# Data flow — Optimize data flow

Optimize sits on top of the export pipeline as a second-tier consumer. See it in violet in the diagram below:

![Camunda 8.8+ architecture overview - Data Flow Optimize](assets/architecture-8.8plus-data-flow-optimize.jpg)

1. The Elasticsearch/OpenSearch exporter writes raw engine events into per-partition Elasticsearch/OpenSearch indices.
2. Optimize's **importer** reads from those indices and transforms the data into its own analytics indices.
3. Optimize writes the analytics indices **back into the same or another Elasticsearch/OpenSearch cluster**.

This means Optimize has an additional hop in the data flow compared to Operate and Tasklist, and it writes to secondary storage twice: once for the raw events and once for the analytics indices. As a result, data availability latency for Optimize is higher than for Operate and Tasklist, and the overall write load on Elasticsearch/OpenSearch is significantly higher when Optimize is enabled.

Optimize's indices store variables differently from the raw export. Each variable is stored in its owning process instance document, and its value is indexed in several forms simultaneously. This allows Optimize's variable filters and reports to support the following query types without requiring separate reindexing:

- An exact-match form.
- A case-insensitive form.
- A substring-searchable form.
- A best-effort date form.
- Best-effort numeric forms for long and double values.

As a result, Optimize's storage cost per variable is significantly higher than the cost of the raw exported record. The storage cost increases further for high-cardinality string variables because the substring-searchable form scales with the number of distinct values:

- Variables with a small number of repeated values, such as a status field, compress efficiently.
- Variables with a different value for almost every process instance, such as a customer or order ID, compress poorly.

See [Impact of Optimize](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment#impact-of-optimize) for measured examples, including how object variable flattening compounds this by multiplying variable count rather than variable value size.

**Note**
This is exactly why the architecture was changed in 8.8: the Camunda Exporter now aggregates the data for Operate and Tasklist, which previously both used an Exporter-Importer architecture similar to Optimize. See this [blog post](https://camunda.com/blog/2025/02/one-exporter-to-rule-them-all-exploring-camunda-exporter/) for more details.

See the [sizing guide](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment#impact-of-optimize) for details on the impact of running Optimize and how to reduce it.

**Note**
Optimize is not supported with RDBMS backends. If Optimize is required, a separate Elasticsearch/OpenSearch instance must be present even if the core platform uses RDBMS.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow

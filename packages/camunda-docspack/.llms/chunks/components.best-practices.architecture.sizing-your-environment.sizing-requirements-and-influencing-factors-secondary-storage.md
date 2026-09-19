# Size your environment — Sizing requirements and influencing factors — Secondary storage

Starting with Camunda 8.9, the platform supports three secondary storage backends, each with different sizing implications.

#### Elasticsearch (default)

- The **most mature and most benchmarked** option.
- Required if you use Optimize.
- Provides full-text search capabilities used by Operate and Tasklist.

**Important**
Sizing data provided throughout this guide assumes Elasticsearch unless stated otherwise.

#### OpenSearch

- A drop-in alternative to Elasticsearch with a similar resource profile.
- Supported for all components including Optimize. See [supported environments](https://docs.camunda.io/docs/next/reference/supported-environments) for more details.
- Sizing recommendations for Elasticsearch generally apply to OpenSearch as well.

#### RDBMS

- A different storage paradigm: a relational database instead of a document store. See the full list of [supported databases](https://docs.camunda.io/docs/next/self-managed/concepts/databases/relational-db/rdbms-support-policy#supported-rdbms).
- A different resource profile: CPU/memory-oriented rather than disk/IOPS-oriented.
- Write throughput is approximately **70% of Elasticsearch** on equivalent hardware.
- **No Optimize support**: If you need Optimize, you must run Elasticsearch alongside RDBMS.
- **Scales primarily vertically** rather than horizontally like Elasticsearch. Plan initial sizing with more headroom, as adding capacity is more disruptive.
- Ideal for organizations that already operate a supported RDBMS at scale and want to avoid adding Elasticsearch to their infrastructure.
  <!-- To be validated - Potentially lower total disk space required for the same data volume (preliminary benchmarks suggest this, but detailed results are still being validated). -->
  <!-- TODO: Link to RDBMS benchmark results page once PR #8159 is merged -->

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

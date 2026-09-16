# Self-Managed resource planning — Secondary storage considerations

The resource tables above assume Elasticsearch as the secondary storage backend. If you are using a different backend:

- **OpenSearch:** Similar resource profile to Elasticsearch. The tables above generally apply.
- **RDBMS (PostgreSQL, available from 8.9):** Replace the Elasticsearch resource block with appropriately sized PostgreSQL resources. Adjust throughput expectations **downward by approximately 30%** compared to the Elasticsearch-based tables. Unlike Elasticsearch, RDBMS scales primarily **vertically** (a larger instance) rather than horizontally, so plan your initial sizing with more headroom, as adding capacity later is more disruptive.

**Note**
Optimize is not supported with RDBMS. If you need Optimize, you must also run Elasticsearch alongside your RDBMS.

See [Secondary storage](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment#secondary-storage) for more details.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

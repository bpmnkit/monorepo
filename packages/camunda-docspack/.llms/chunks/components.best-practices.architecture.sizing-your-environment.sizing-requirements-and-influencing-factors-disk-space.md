# Size your environment — Sizing requirements and influencing factors — Disk space

The workflow engine stores data for each process instance, especially to persist the current state.
In addition, it sends data to secondary storage (Elasticsearch, OpenSearch, or an RDBMS) for indexing, search, analytics, and long-term retention.

You can configure retention times for data stored in secondary storage.

For Self-Managed, see [Disk space](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed#disk-space) for the formula and mechanics behind Zeebe's primary storage disk usage.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

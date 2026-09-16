# Data flow — Query path

Operate, Tasklist, and the REST Query API (`GET /v2/...`) read exclusively from the configured secondary storage. They never read directly from the engine.
See it in red in the diagram below:

![Camunda 8.8+ architecture overview - Data Flow Query path](assets/architecture-8.8plus-data-flow-query.jpg)

Query results depend on the performance of both the primary (processing path) and secondary storage (exporting pipeline). They are **eventually consistent**: there is always some lag between a command completing in the engine and the result being visible in search results or the UI. This is measured as the **data availability latency**.

Data availability latency is bounded below by export pipeline lag; if the exporter is behind, data availability is behind. This can be caused by a slow or overloaded secondary storage.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow

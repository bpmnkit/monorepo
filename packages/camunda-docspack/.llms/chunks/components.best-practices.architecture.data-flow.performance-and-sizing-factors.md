# Data flow — Performance and sizing factors

The paths above map directly to the factors to consider when [sizing your environment](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment):

- **Partition count** bounds both command path throughput and export pipeline parallelism. More partitions means more parallel processing and exporting, up to the available hardware.
- **Elasticsearch/OpenSearch resources** is the most common cause of operational delay and degradation. Monitor and scale storage before hitting performance bottlenecks.
- **Optimize** significantly increases secondary storage write load. Size Elasticsearch/OpenSearch accordingly, or use a dedicated Elasticsearch/OpenSearch instance, if Optimize is enabled.

For hardware recommendations based on these factors, see how to [size your environment](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow

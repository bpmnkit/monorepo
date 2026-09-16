# Run benchmarks — What to measure

When running benchmarks, focus on these key metrics:

- **Sustained throughput (tasks/second):** The rate your cluster can handle continuously without increasing backpressure.
- **Backpressure rate:** Should remain below 10% for sustainable operation.
- **Process instance latency (p99):** End-to-end time from instance creation to completion. Target depends on your SLO.
- **Elasticsearch disk growth rate:** Helps you forecast disk capacity needs.
- **Data availability latency:** The time between an event in the engine and its appearance in Operate/Tasklist.
  - Note: to measure this, you have to compare the time from starting an instance and its availability in query APIs using the Orchestration Cluster REST API
- **CPU usage and throttling:** High CPU usage or frequent throttling indicates a need for more CPU resources or additional brokers.
- **Memory usage:** Sustained high memory usage suggests the need for larger memory limits or additional nodes.

<!-- TODO: Define the exact SLO boundary used for "max throughput" in the official benchmark tables (e.g., "max sustainable throughput where backpressure remains below 10% and p99 process duration stays under 1 second"). If the exact boundary is not standardized, document the methodology. -->

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-benchmarks

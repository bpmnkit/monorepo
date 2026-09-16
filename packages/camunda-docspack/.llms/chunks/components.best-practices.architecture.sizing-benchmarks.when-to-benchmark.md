# Run benchmarks — When to benchmark

Running your own benchmarks when:

- Your process models or payload sizes **differ significantly** from the reference scenario.
- **Latency or cycle time requirements** are critical to your use case.
- You are running Optimize with **payloads larger than the reference ~11 KB** or retention periods **exceeding 6 months**. Larger payloads and longer retention amplify Elasticsearch disk consumption and Optimize import times.
- You are **upgrading from a pre-8.8 version** and want to validate resource requirements.
- You are using **RDBMS (PostgreSQL) as secondary storage** and want to validate throughput differences.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-benchmarks

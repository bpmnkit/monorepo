# Self-Managed resource planning — Primary storage

Primary storage must use low-latency **SSDs**, as HDD-backed volumes are not supported. Disk **latency**, rather than throughput, is the critical metric. Cloud providers often report similar throughput figures for HDD and SSD volumes, but the difference in latency is what matters for Camunda. In testing, HDD-backed primary storage reduced throughput by approximately 50% compared with SSDs, increased commit latency, and triggered additional Raft snapshot replication between brokers.

See [Command processing path](https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow#command-processing-path) for the architectural context on why disk latency sits on the critical path, the [reference architecture minimum cluster requirements](https://docs.camunda.io/docs/next/self-managed/reference-architecture/kubernetes#minimum-cluster-requirements) for concrete per-platform disk recommendations, and the [slow disk chaos day experiment](https://camunda.github.io/zeebe-chaos/2026/06/19/Using-slow-disk-with-Camunda) for the detailed findings.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

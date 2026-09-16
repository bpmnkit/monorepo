# Size your environment — Sizing requirements and influencing factors — Latency and cycle time

In some use cases, process cycle time (or even individual task cycle time) matters. For example, you might expose a REST endpoint that starts a process instance to calculate a customer score. The process runs four service tasks, and the REST request must return synchronously within 250 ms.

While service-task duration depends on the work performed, you can measure the workflow engine’s own overhead.

<!-- TODO: Replace the following latency measurements with current 8.8/8.9 benchmark data. The old measurements (Camunda 8 1.2.4: ~10 ms/node, ~50 ms remote worker latency) are outdated. -->

**Note**
The latency measurements below are approximate and were last validated against an earlier version of Camunda 8. Updated measurements for 8.8/8.9 are pending. With the 8.8 streamlined architecture and properly aligned resources (3.5 CPU cores per broker), latency is expected to improve by approximately 2x compared to the previous distributed deployment.

Actual latency is highly environment-dependent — factors like network latency between workers and the cluster, disk I/O speed (commit latency), and cloud region placement significantly affect these numbers.

As a rough estimate, you can expect:

- Single-digit millisecond processing time per process node.
- Approximately 50 ms latency to process service tasks in remote workers when running worker code in the same cloud region as the Camunda cluster.

Hence, executing four service tasks results in roughly 200-250 ms workflow engine overhead.

As you push throughput toward the cluster’s limits, latency increases because requests compete for resources, especially disk writes. If cycle time and latency matter, leave enough headroom and avoid running the cluster near full utilization to prevent resource contention.

**Tip**
A good rule of thumb is to size for about **20x your average load**. This gives you capacity for peaks and keeps latency low during normal operation.

| Indicator                                                      |    Number | Calculation method | Notes                                                                                      |
| :------------------------------------------------------------- | --------: | :----------------: | :----------------------------------------------------------------------------------------- |
| Onboarding instances per year                                  | 5,000,000 |                    | Business input.                                                                            |
| Expected process instances on peak day                         |   150,000 |                    | Business input.                                                                            |
| Process instances per second within business hours on peak day |      5.20 |   / (8\*60\*60)    | Only looking at the seconds within the eight business hours of a day.                      |
| Process instances per second including buffer                  |    104.16 |       \* 20        | Adding some buffer is recommended for critical, high-performance or low-latency use cases. |

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

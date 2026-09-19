# Size your SaaS cluster — Sizing tables

| Cluster size                                         |                              1x |                              2x |                              3x |                              4x |
| :--------------------------------------------------- | ------------------------------: | ------------------------------: | ------------------------------: | ------------------------------: |
| Max Throughput **Tasks/day** **\***                  |                             9 M |                            18 M |                            27 M |                            36 M |
| Max Throughput **Tasks/second** **\***               |                             100 |                             200 |                             300 |                             400 |
| Max Throughput **Process Instances/second** **\*\*** |                               5 |                              10 |                              15 |                              20 |
| Max Total Number of PI stored (in ES) **\*\*\***     |                           200 k |                           400 k |                           600 k |                           800 k |
| Approximate resources provisioned **\*\*\*\***       | 11 vCPU, 22 GB mem, 192 GB disk | 22 vCPU, 44 GB mem, 384 GB disk | 33 vCPU, 66 GB mem, 576 GB disk | 44 vCPU, 88 GB mem, 768 GB disk |

<!-- TODO: Validate "with Optimize" numbers against 8.9 benchmarks. The numbers above were measured with Camunda 8.8. Also confirm whether the "max throughput" boundary condition is defined as backpressure < 10% and p99 process duration < 1s, or another SLO. -->

**Note**
The numbers in the tables were measured using Camunda 8 (version 8.8), [the benchmark project](https://github.com/camunda-community-hub/camunda-8-benchmark) running on its own Kubernetes cluster, and using a [realistic process](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/bankCustomerComplaintDisputeHandling.bpmn) with this [payload](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/reducedPayload.json) (~1.4 KB). To calculate day-based metrics, an equal distribution over 24 hours is assumed.

**\*** Tasks (including service, send, and user tasks, among others) completed per day are the primary metric, as this is easy to measure and strongly influences resource consumption. This number assumes a constant load throughout the day. Tasks/day and Tasks/second are scaled linearly.

**\*\*** Because tasks are the primary resource driver, the number of process instances supported by a cluster is calculated assuming an average of 10 tasks per process. As a customers, you can calculate a more accurate process instance estimate using your anticipated number of tasks per process.

**\*\*\*** Maximum total number of historical process instances within the retention period.
For active process instances, this is limited mostly by Zeebe resources; for historical instances, it is limited mostly by Elasticsearch resources. Calculated assuming a typical set of process variables per process instance. Note that it makes a difference whether you add one or two strings (requiring ~1 KB of space) to your process instances or attach a full JSON document containing 1 MB, as this data must be stored in various places, influencing memory and disk requirements. If this number increases, you can still retain the runtime throughput, but Tasklist, Operate, and/or Optimize may lag behind.
The provisioned disk size is calculated as the sum of the disk size used by Zeebe and Elasticsearch.

**\*\*\*\*** These are the resource limits configured in the Kubernetes cluster and are subject to change.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-saas

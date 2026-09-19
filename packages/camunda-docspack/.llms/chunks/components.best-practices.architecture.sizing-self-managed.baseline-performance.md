# Self-Managed resource planning — Baseline performance

Considering this [baseline resource configuration](#baseline-resource-configuration), you can expect the following performance:

| Metric                                          | Value                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| Completed process instances per second          | 51 (includes root and child process instances) |
| Completed flow node instances (FNIs) per second | 560                                            |
| Completed tasks per second                      | 100                                            |
| Data availability (query API latency)           | < 5 seconds                                    |

**Important**
These numbers were measured using Camunda's [load test application](https://github.com/camunda/camunda/tree/main/load-tests/load-tester) with a [realistic reference process](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/bankCustomerComplaintDisputeHandling.bpmn) and [realistic payload](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/realisticPayload.json) (~11 KB). For details on the testing methodology, see the [reliability testing documentation](https://github.com/camunda/camunda/blob/main/docs/testing/reliability-testing.md).

The realistic reference process starts one root process instance, which spawns 50 sub-process instances via call activities. It covers a wide variety of BPMN elements, including call activities, multi-instance, sub-processes, and DMN. The process is based on the [Credit Card Fraud Dispute Handling](https://marketplace.camunda.com/en-US/apps/449510/credit-card-fraud-dispute-handling) blueprint from the Camunda Marketplace.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

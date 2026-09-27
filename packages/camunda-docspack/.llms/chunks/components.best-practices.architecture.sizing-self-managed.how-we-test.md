# Self-Managed resource planning — How we test

Camunda runs these load tests as part of its **reliability testing** practices. The goal is to detect performance regressions, memory leaks, and configuration issues before they affect customers, and to confirm that the system performs within its expected bounds over extended periods of continuous operation—not to produce a one-off benchmark for this page.

The numbers presented here reflect a configuration that Camunda has repeatedly demonstrated can sustain this load reliably.

These tests run on a dedicated Kubernetes cluster, using the same [load-tester](https://github.com/camunda/camunda/tree/main/load-tests/load-tester) application and [Helm-based setup](https://github.com/camunda/camunda/blob/main/load-tests/README.md) used to validate every release before it ships. Reliability testing focuses on two test types, run against `main` and every supported `stable/*` branch:

| Test type                                                                                                                    | Process model                                                            |                          PI/s target | FNI/s target | Purpose                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -----------------------------------: | -----------: | ------------------------------------------------------------------------------------- |
| **[Weekly (endurance)](https://github.com/camunda/camunda/blob/main/load-tests/README.md#weekly-load-tests-endurance-test)** | Credit card fraud dispute process (call activities, multi-instance, DMN) | 1 root PIs (50 sub PIs)\* |          560 | Validates sustained reliability over four weeks (used for the numbers on this page)   |
| [Daily (stress)](https://github.com/camunda/camunda/blob/main/load-tests/README.md#daily-load-tests-stress-test)             | Single service task                                                      |                                  300 |          900 | Puts the system under stress and finds the throughput ceiling in a bounded 3-hour run |

\* One root process instance per second fans out into 50 sub-process instances via call activities, so completed PI/s includes both.

The endurance run supports the numbers on this page:

- A new instance is created every Monday for each variant and runs for four weeks.
- A configuration is considered validated only after sustaining a continuous, production-like load—not merely a short burst.
- The stress run answers a different question: how far can the system be pushed? Its ceiling of 300 PI/s is not a target for capacity planning.

See [reliability testing](https://github.com/camunda/camunda/blob/main/docs/testing/reliability-testing.md) for the full test-type taxonomy and [load test metrics](https://github.com/camunda/camunda/blob/main/load-tests/docs/metrics.md) for how a run is judged healthy.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed

# Run benchmarks

Run your own benchmarks to validate Camunda 8 sizing for your specific workload.

Run your own benchmarks to validate [Camunda 8 sizing](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment) for your specific workload.


## Reference benchmark scenario

The sizing recommendations for [SaaS](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-saas) and [Self-Managed](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed) are based on a reference benchmark scenario. Your actual workload may differ significantly, so running your own benchmarks is the most reliable way to validate that your chosen configuration meets your needs.

Camunda uses the following realistic benchmark scenario:

- **Process model:** [bankCustomerComplaintDisputeHandling.bpmn](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/bankCustomerComplaintDisputeHandling.bpmn) (a credit card fraud dispute handling process from the [Camunda Marketplace blueprint](https://marketplace.camunda.com/en-US/apps/449510/credit-card-fraud-dispute-handling)).
- **Payload:** [realisticPayload.json](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/realisticPayload.json) (~11 KB).
- This setup produces approximately **101 tasks per second at 1 PI/s** due to internal sub-process instantiation (50 sub-process instances per root instance).

**Note**
The official sizing numbers on this page are produced using the [load-tester](https://github.com/camunda/camunda/tree/main/load-tests/load-tester) tool from the Camunda monorepo.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-benchmarks

# Outbound connectors vs. job workers — Which one should you choose?

It depends on your use case.

- Need access to a low-level API in Camunda 8 to perform a very specific task? You are better off with job workers.
- Want to write your worker logic in something other than Java? Job workers are your way to move forward.
- Want to create worker logic that is reusable in any environment? Write a connector.
- Want to focus on your worker's logic and have no need for using low-level Orchestration Cluster REST API? Write a connector.
- Want to provide a standardized modeling experience alongside your runtime behavior? Write a connector.

---
Source: https://docs.camunda.io/docs/next/components/concepts/outbound-connectors-job-workers

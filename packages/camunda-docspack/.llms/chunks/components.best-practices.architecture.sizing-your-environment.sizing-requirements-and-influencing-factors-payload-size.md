# Size your environment — Sizing requirements and influencing factors — Payload size

Each process instance can hold a payload, known as [process variables](https://docs.camunda.io/docs/next/components/concepts/variables). The workflow engine must manage the variables for all running instances, and data from both running and completed process instances is forwarded to Operate and Tasklist.

Process variable size affects resource requirements. For example, there’s a big difference between storing a few strings (around 1 KB) and storing a full 1 MB JSON document. That’s why payload size is a key sizing factor.

Camunda's official benchmarks use two reference payloads:

- [**Typical payload**](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/typical_payload.json): Used for baseline measurements (~0.5 KB, 15 simple variables).
- [**Realistic payload**](https://github.com/camunda/camunda/blob/main/load-tests/load-tester/src/main/resources/bpmn/realistic/realisticPayload.json): Used for the reference sizing benchmarks. This better represents real-world payloads (~11 KB).

**Note**
Payload size has a multiplicative effect, affecting Zeebe storage, Elasticsearch export volume, Optimize import time, and query/report performance. An 11 KB payload vs. a 0.5 KB payload can change disk consumption by **10-20x**.

Consider these general rules for payload size:

- The maximum [variable size per process instance is limited](https://docs.camunda.io/docs/next/components/concepts/variables#variable-size-limitation), currently to roughly three MB.
- Camunda does not recommend storing large amounts of data in your process context. Refer to our [best practices on handling data in processes](https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes) for more details.
- An AI agent's [agent context](https://docs.camunda.io/docs/next/components/agentic-orchestration/agent-definitions-and-instances#agent-context-and-memory) is a process variable that grows with each loop iteration, so it counts toward this limit. Switch the agent's memory to [Camunda document storage](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-subprocess#choose-a-memory-storage-backend) when a long conversation would outgrow it.
- Each [partition](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/partitions) of the Zeebe installation can typically handle up to one GB of payload in total. Larger payloads can lead to slower processing. For example,
  one million process instances with four KB each is about 3.9 GB, so you need at least four partitions. In practice, you’d typically use six partitions, since the number of partitions is usually a multiple of the replication factor (three by default).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment

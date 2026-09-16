# Data flow — Command processing path

A command travels from the client to primary storage and then to the engine. A response only comes back after processing.
Its processing path (command lifecycle) follows this pattern:

**Client (REST or gRPC) → Camunda API (Gateway) → Broker (Command API) → Raft partition (log) → Raft replication → Processing Engine → event on log → RocksDB state update → Client response**

See it in green in the diagram below:

![Camunda 8.8+ architecture overview - Data Flow Command processing path](assets/architecture-8.8plus-data-flow-command.jpg)

Client responses are not sent until the command is fully processed by the engine. The engine can only process a command once it has been committed to the log (as part of the Raft consensus protocol). Commands are read sequentially per partition, only one command per partition is processed at a time, and only the Raft partition leader runs the engine.

This means command response latency is bounded below by Raft commit time, engine processing time, and processing queue length. In a healthy and stable cluster, this typically results in sub-second response latency for simple commands.

If the engine cannot process commands fast enough, for example, because disk I/O is saturated, network latency is high, or the backlog is large, the Command API applies backpressure to the client.

See [internal processing](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/internal-processing) for more details.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/data-flow

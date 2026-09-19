# Signals

Learn about broadcasting signals, which can trigger all matching signal events with a single broadcast.

Signals are a similar concept to [messages](https://docs.camunda.io/docs/next/components/concepts/messages). However, messages are correlated to a specific
process instance, whereas signals can trigger _all_ the matching signal events with a single broadcast.
Depending on the type of [signal catch events](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events), the process instance will
respond accordingly.


## Broadcasting signals

You can broadcast signals in several ways:

- Using a [signal throw event or signal end event](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events#signal-throw-events)
- Using the [Orchestration Cluster REST API Broadcast signal](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/broadcast-signal.api) endpoint
- Using Zeebe's [`BroadcastSignal` RPC](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#broadcastsignal-rpc)

---
Source: https://docs.camunda.io/docs/next/components/concepts/signals

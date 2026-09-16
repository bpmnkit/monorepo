# Signals — Signal subscriptions

When you broadcast a signal it triggers _all_ signal subscriptions that match the signal name.

When a process instance encounters a signal catch event it creates a new signal subscription. This process instance waits until a signal with a matching name is broadcasted. You can define the signal name in the
process definition.

Deploying a process with a signal start event also creates a new signal subscription. In this case, the triggered
subscription starts a new process instance.


## Signal cardinality

A broadcasted signal iterates over _all_ available subscriptions. As a result, a single broadcast triggers _all_ the
signal catch events that match the signal name, and _all_ [partitions](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/partitions).

**Caution**
Signals can negatively impact the performance of Camunda 8. Performance is impacted in two ways:

- Signals trigger _all_ available subscriptions that match the signal name, potentially resulting in the continued execution of many processes.
- Signals are broadcasted to _all_ partitions, resulting in lots of network traffic. This scales linearly with the number of partitions.

---
Source: https://docs.camunda.io/docs/next/components/concepts/signals

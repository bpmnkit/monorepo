# Message aggregation

Learn how to collect and process multiple related messages in a single workflow instance using message correlation in Camunda 8.

Use message aggregation to collect multiple related messages into a single process instance before proceeding to the next step of your workflow.


## What message aggregation is

Message aggregation is a message correlation pattern that allows you to receive, store, and process multiple messages belonging to the same business entity.

It’s commonly used when:

- You receive multiple events about a single entity (for example, shipments for the same order).
- You need to wait for _N_ messages before proceeding.
- You want to combine or "map-reduce" data across messages before continuing.

Instead of creating a new process instance for each message, messages with the same **correlation key** are routed to the same instance.

**Note**
This guide applies to Camunda 8 (Zeebe). The message aggregation pattern requires understanding of [message correlation](https://docs.camunda.io/docs/next/components/concepts/messages#message-correlation-overview) and BPMN message events.

---
Source: https://docs.camunda.io/docs/next/components/concepts/message-aggregation

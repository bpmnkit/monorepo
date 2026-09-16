# Conditional events — Conditional start events

Conditional start events can be used to start a process instance. Deploying a process with a conditional start event creates a subscription for that event. When the condition of the start event evaluates to `true`, the engine starts a new process instance.

When deploying a process with a conditional start event, the following rules apply:

- The condition of the conditional start event must be unique across a process definition. If multiple conditional start events have the same condition, the deployment will fail with a validation error.
- Upon deployment of a new version, the previous version’s conditional start event subscription is removed and replaced with the new version’s subscription.

To start processes via conditional start events from external systems, use the Orchestration Cluster REST API, the Zeebe gRPC API, or a Camunda Client SDK.
See [trigger root-level conditional start events via API](https://docs.camunda.io/docs/next/components/concepts/conditionals#trigger-root-level-conditional-start-events-via-api) for more details.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events

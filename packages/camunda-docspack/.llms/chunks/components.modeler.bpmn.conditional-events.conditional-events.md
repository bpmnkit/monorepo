# Conditional events

Use conditional events to trigger process behavior when a FEEL condition evaluates to true, based on process variables, BPMN scope, and variable change events.

Conditional events allow a process to react to changes in process state instead of waiting for a message or signal. For example, when a variable crosses a threshold, a required set of fields becomes complete, a risk score changes, or a business rule flips from false to true.

Conditional events are useful when the producer of a change is not a single known sender, when correlation logic would add unnecessary complexity, or when the process logic is naturally expressed as guard conditions over process state.

The engine evaluates the FEEL expression and triggers the event when the expression evaluates to `true`. The diagram below shows all four types of conditional events: root-level start, event sub-process start, intermediate catch, and boundary events.

![BPMN diagram showing conditional start, intermediate, and boundary events](assets/all-conditional-event-types.png)

In this example, the process starts with a root-level conditional start event. Root-level conditional start events can be triggered via the Orchestration Cluster REST API or Camunda Client SDKs (see [trigger root-level conditional start events via API](https://docs.camunda.io/docs/next/components/concepts/conditionals#trigger-root-level-conditional-start-events-via-api) for more details). A new instance is created once the condition `= orderReceived = true` evaluates to `true`.

The intermediate conditional catch event acts like a wait-until condition. It continues to “Ship order” only after inventory is successfully reserved.

The interrupting conditional boundary event attached to “Review order” handles changes mid-review. If the delivery address is changed, the boundary event triggers and interrupts the user task, routing execution to “Apply changes” before completing the order preparation.

Finally, the interrupting event sub-process can cancel the work at any time while the instance is running. If the order is canceled while it is being prepared, the conditional start event inside the event sub-process fires and interrupts the main process, starting the cancellation sub-process to handle the cancellation logic. See [triggering conditional events](https://docs.camunda.io/docs/next/components/concepts/conditionals#triggering-conditional-events) for details on how and when conditional events are triggered.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events

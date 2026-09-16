# Conditional events — Intermediate conditional catch events

An intermediate conditional catch event waits until its condition becomes `true`. When the process instance reaches the event, it waits until the condition evaluates to `true`, then continues along the outgoing sequence flow. For details on how and when the condition is triggered, see [triggering conditional events](https://docs.camunda.io/docs/next/components/concepts/conditionals#triggering-conditional-events).

Intermediate conditional catch events are always interrupting, as they represent a waiting point in the process flow.


## Conditional boundary events

A conditional boundary event is attached to an activity and monitors data while the activity is active. When the activity is entered, the engine evaluates the boundary event’s condition and triggers immediately if the condition is satisfied.

Conditional boundary events can be interrupting or non-interrupting:

- Interrupting triggers the boundary event and cancels the attached activity, so execution continues via the boundary event’s outgoing sequence flow.
- Non-interrupting triggers the boundary event without canceling the attached activity, starting an additional path via the boundary event’s outgoing sequence flow while the attached activity continues.

Like a non-interrupting event sub-process conditional start event, a non-interrupting conditional boundary event can trigger multiple times while the attached activity is active. It triggers each time the condition becomes `true`, based on changes to variables referenced in the expression. You can use variable event filters to further restrict which change types trigger evaluation. See [variable filter semantics](https://docs.camunda.io/docs/next/components/concepts/conditionals#variable-filter-semantics) for details.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events

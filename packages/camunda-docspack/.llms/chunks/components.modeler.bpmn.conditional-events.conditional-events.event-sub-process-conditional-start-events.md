# Conditional events — Event sub-process conditional start events

Event sub-process conditional start events start an event sub-process within an active process instance when the configured condition evaluates to `true` in the scope of that instance.
This allows a running instance to react to state changes (for example, cancellation flags, escalation thresholds, or data corrections) without requiring an external signal or message correlation.

An event sub-process conditional start event can be interrupting or non-interrupting:

- Interrupting starts the event sub-process and cancels the currently active work in the scope it interrupts, so the instance continues via the event sub-process path.
- Non-interrupting starts the event sub-process in parallel while the existing execution continues.

A non-interrupting event sub-process conditional start event can trigger more than once while the instance is active. It triggers each time the condition becomes `true`, based on changes to variables referenced in the expression. You can use variable event filters to further restrict which change types (`create`, `update`) trigger evaluation. For runtime evaluation behavior and filter semantics, see [variable filter semantics](https://docs.camunda.io/docs/next/components/concepts/conditionals#variable-filter-semantics).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events

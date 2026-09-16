# Conditionals — Conditional event triggers

When a conditional event scope is activated, the engine creates a subscription. It evaluates the condition whenever relevant variables change within the event’s visible scope. If the condition becomes `true` while the event is active and in scope, the event triggers and the process follows the behavior defined by the underlying BPMN event.

The following sections describe how conditional events are evaluated and triggered, including how variable filters affect re-evaluation.

The semantics described below apply to conditional events within running process instances. For process-level conditional start events, see [trigger root-level conditional start events via API](#trigger-root-level-conditional-start-events-via-api).

---
Source: https://docs.camunda.io/docs/next/components/concepts/conditionals

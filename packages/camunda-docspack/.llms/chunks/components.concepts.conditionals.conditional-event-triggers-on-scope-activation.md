# Conditionals — Conditional event triggers — On scope activation

When a scope is activated, the engine evaluates the condition for conditional events in that scope. For example, when an activity with an attached conditional boundary event is activated, the engine evaluates the condition for that boundary event immediately at activation.

Consider the following process definition:

An interrupting conditional boundary event with condition `x > 10` is attached to the service task A. Assume the process instance starts with variable `x` initialized to `11`. When the start event completes and service task A is activated, the boundary condition evaluates to `true`, and the boundary event triggers immediately.
Service task A will be terminated and the created job will be canceled. The process instance will continue with the flow after the boundary event, skipping the service task A.

---
Source: https://docs.camunda.io/docs/next/components/concepts/conditionals

# Conditional events — Modeling conditional events in Modeler

Camunda Modeler supports conditional start events, intermediate conditional catch events, and interrupting or non-interrupting conditional boundary events.

To add a conditional event:

1. Select an existing start event, intermediate event, or boundary event, or use the **Create element** popup and search for _conditional_.
2. Change the element type to **Conditional start event**, **Conditional intermediate catch event**, or **Conditional boundary event** as needed.
3. With the conditional event selected, use the properties panel on the right to configure it:
   - In the **Condition** field, enter a FEEL expression starting with `=` (for example, `= x > 1`).
   - In the **Variable filters** section, optionally restrict when the condition is re-evaluated by specifying which variable events (`create`, `update`, or `create, update`) should trigger evaluation.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events

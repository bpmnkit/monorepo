# Compensation events — Triggering compensation

When a process instance enters a compensation intermediate throw or end event, it triggers the compensation within its
scope and invokes all compensation handlers of completed activities. The compensation handlers of active or terminated
activities are not invoked. The compensation throw event remains active until all invoked compensation handlers are
completed.

**Note**
The process instance invokes all compensation handlers at once without any specific order. If the order is
important, the compensation can be triggered for a specific activity. Read more about this
case in [triggering compensation for an activity](#triggering-compensation-for-a-specific-activity).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events

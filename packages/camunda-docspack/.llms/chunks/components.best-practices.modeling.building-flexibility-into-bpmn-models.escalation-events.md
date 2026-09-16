# Building flexibility into BPMN models — Escalation events

Sometimes we need highly flexible means to cancel scopes or trigger additional activities from within a scope. The BPMN escalation events can be particularly useful to implement such requirements.

Diagram (BPMN):
  start "..." → "..." → subprocess → "..." → end "..."

**(1)**

As soon as we are finished with the first activity inside the scope...

**(2)**

...we inform the surrounding scope about that and trigger an additional, essential activity...

**(3)**

...but also continue with our second activity to complete the subprocess.

**(4)**

We can then already continue with the follow-up work regardless of whether that additional activity is already finished.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models

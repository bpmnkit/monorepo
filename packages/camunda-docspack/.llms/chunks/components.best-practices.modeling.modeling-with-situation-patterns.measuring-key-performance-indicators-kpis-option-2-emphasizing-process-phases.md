# Modeling with situation patterns — Measuring key performance indicators (KPIs) — Option 2: Emphasizing process phases

As an alternative or supplement to using events, you might also use subprocesses to emphasize certain phases in your process.

Diagram (BPMN):
  start "Insurance application received" → business rule task "Assess application risks" → exclusive gateway "Risk level?"
    — [Low enough: =riskLevel = "green"] intermediate throw event "Application automatically assessed" → exclusive gateway → service task "Create insurance policy" → send task "Send insurance policy" → end "Insurance application accepted"
    — [Too high: =riskLevel = "red"] intermediate throw event "Application automatically assessed" → exclusive gateway → service task "Create letter of rejection" → send task "Send letter of rejection" → end "Insurance application rejected"
    — [Unsure: =riskLevel = "yellow"] subprocess "Manual application assessment" → (back to exclusive gateway)

**(1)**

By introducing a separate embedded subprocess, we emphasize the _phase_ of manual application assessment, which is the critical one from an economic perspective.

Note that this makes even more sense if multiple tasks are contained within one phase.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

# Modeling with situation patterns — Measuring key performance indicators (KPIs) — Option 1: Showing milestones

Diagram (BPMN):
  start "Insurance application received" → business rule task "Assess application risks" → exclusive gateway "Risk level?"
    — [Low enough: =riskLevel = "green"] intermediate throw event "Application automatically assessed" → exclusive gateway → service task "Create insurance policy" → send task "Send insurance policy" → end "Insurance application accepted"
    — [Too high: =riskLevel = "red"] intermediate throw event "Application automatically assessed" → exclusive gateway → service task "Create letter of rejection" → send task "Send letter of rejection" → end "Insurance application rejected"
    — [Unsure: =riskLevel = "yellow"] user task "Assess application risk" → intermediate throw event "Application manually assessed" → exclusive gateway "Risk level?"
      — [Low enough: =riskLevel = "low"] (back to exclusive gateway)
      — [Too high: =riskLevel = "high"] (back to exclusive gateway)

**(1)**

First, we assess the application risk based on a set of automatically evaluable rules.

**(2)**

We can then determine whether the automated rules already came to a (positive or negative) conclusion or not. If the rules led to an unsure result, a human must assess the application risk.

**(3)**

We use explicit intermediate events to make perfectly clear that we are interested in the applications which never see a human...

**(4)**

...and be able to compare that to the applications which needed to be assessed manually, because the automatic assessment failed to determine a clear result.

**(5)**

We also use end events, which are meaningful from a business perspective. We must know whether an application was either accepted...

**(6)**

...or rejected.

By means of that process model, we can now let Camunda count the applications which were accepted and declined. We know how many and which instances we needed to review manually, and can therefore also narrow down our _accpeted/declined statistics_ to those manual cases.

Furthermore, we will be able to measure the _handling time_ needed for the user task; for example, by measuring the time needed from claiming the task to completing it. The customer will need to wait a _cycle time_ from start to end events, and these statistics, for example, could be limited to the manually assessed applications and will then also include any idle periods in the process.

*By comparing the economic _value_ of manually assessed insurance policies to the *effort\* (handling time) we invest into them, we will also be able to learn whether we focus our manual work on the meaningful cases and eventually improve upon the automatically evaluated assessment rules.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

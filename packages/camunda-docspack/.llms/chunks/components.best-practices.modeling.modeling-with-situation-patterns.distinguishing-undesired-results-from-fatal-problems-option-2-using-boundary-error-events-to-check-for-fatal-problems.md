# Modeling with situation patterns — Distinguishing undesired results from fatal problems — Option 2: Using boundary error events to check for fatal problems

Diagram (BPMN):
  start "Credit card application received" → service task "Evaluate credit-worthiness" → exclusive gateway "Applicant credit-worthy?"
    — [No: =not(creditWorthy)] exclusive gateway → send task "Reject credit card application" → end "Credit card application rejected"
    — [Yes: =creditWorthy] user task "Issue credit card" → end "Credit card application accepted"

**(1)**

Not to know anything about the creditworthiness (because we cannot even retrieve information about the applicant) is not considered to be a valid result of the step, but a _fatal problem_ hindering us to achieve any valid result. We therefore model it as a boundary error event.

The fact that both problems (an unknown applicant number or an applicant which turns out not to be credit-worthy) lead us at the moment to the same reaction in the process (we reject the credit card application) does not influence that we need to model it differently. The decision in favor of a gateway or an error boundary event solely depends on the exact definition of the result of a process step. Refer to the next section.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

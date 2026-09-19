# Modeling with situation patterns — Distinguishing undesired results from fatal problems — Option 1: Using gateways to check for undesired results

Diagram (BPMN):
  start "Credit card application received" → service task "Evaluate credit-worthiness" → exclusive gateway "Applicant credit-worthy?"
    — [No: =not(creditWorthy)] send task "Reject credit card application" → end "Credit card application rejected"
    — [Yes: =creditWorthy] user task "Issue credit card" → end "Credit card application accepted"

**(1)**

Showing the check for the applicant's creditworthiness as a gateway also informs about the result of the preceding task: the applicant might be creditworthy - or not. Both outcomes are _valid results_ of the task, even though one of the outcomes here might be _undesired_ from a business perspective.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

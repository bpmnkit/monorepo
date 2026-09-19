# Modeling with situation patterns — Requiring a second set of eyes — Option 1: Using separate tasks

Diagram (BPMN):
  start "Loan requested" → user task "Approve loan" → exclusive gateway "Loan approved?"
    — [No: =not(approved)] exclusive gateway → end "Loan not approved"
    — [Yes: =approved] user task "Approve loan" → exclusive gateway "Loan approved?"
      — [Yes: =approved] end "Loan approved"
      — [=not(approved)] (back to exclusive gateway)
  note: Second set of eyes

**(1)**

A first approver looks at the loan and decides whether they approve. If they decide not to approve, we are done, but if the loan is approved...

**(2)**

...a second approver looks at the loan. If they also decide to approve, the loan is ultimately approved.

**Evaluation:**

- This solution _explicitly_ shows how the two steps of this approval are performed. Tasks are modeled separately, followed by gateways visualizing the decision making process.

- Note that the approvers work in a _strictly sequential_ mode, which might be exactly what we need in case we want _minimization of effort_ and, for example, display the reasonings of the first approver for the second one. However, we also might prefer _maximization of speed_. If this is the case, observe solution [option 3 (multi-instance)](#option-3-using-a-multi-instance-task) further below.

- The usage of separate tasks leads to _duplication_ and makes the model _larger_, even more so in case multiple steps of approvals need to be modeled.

You might want to use that pattern when modeling the need for a _second set_ of eyes needed in _sequential_ order, therefore _minimizing effort_ needed by the participating approvers.

While it is theoretically possible to model separate, explicit approval tasks in parallel, we do not recommend such patterns due to readability concerns.

Diagram (BPMN):
  start "Loan requested" → parallel gateway
    — user task "Approve loan" → exclusive gateway "Loan approved?"
      — [Yes: =approved] parallel gateway → end "Loan approved"
      — [No: =not(approved)] exclusive gateway → end "Loan not approved"
    — user task "Approve loan" → exclusive gateway "Loan approved?"
      — [No: =not(approved)] (back to exclusive gateway)
      — [Yes: =approved] (back to parallel gateway)

As a better alternative when looking for _maximization of speed_, observe [option 3 (multi-instance)](#option-3-using-a-multi-instance-task) below.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

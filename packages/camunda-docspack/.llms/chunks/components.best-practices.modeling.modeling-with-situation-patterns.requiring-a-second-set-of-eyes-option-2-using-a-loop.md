# Modeling with situation patterns — Requiring a second set of eyes — Option 2: Using a loop

Diagram (BPMN):
  start "Loan requested" → user task "Approve loan" → exclusive gateway "Loan approved?"
    — [No: =not(approved)] end "Loan not approved"
    — [Yes: =approved] exclusive gateway "Another set of eyes necessary?"
      — [No: =not(eyesNecessary)] end "Loan approved"
      — [Yes: =eyesNecessary] (back to user task "Approve loan")

**(1)**

A first approver looks at the loan and decides if they approve. If they decide not to approve, we are done, but...

**(2)**

...if the loan is approved, we turn to a second approver to look at the loan. If they also decide to approve, the loan is ultimately approved.

**Evaluation:**

- This model is a more _compact_ modeling solution to the situation. If it comes to multiple sets of eyes needed, you will probably prefer such an approach to avoid huge diagrams.

- Note that the approvers work in a _strictly sequential_ mode, which might be exactly what we need if we want _minimization of effort_ and, for example, display the reasonings of the first approver for the second one. However, we also might prefer _maximization of speed_. If this is the case, observe [option 3 (multi-instance)](#option-3-using-a-multi-instance-task) below.

- The solution is _less explicit_. We could not choose to label the tasks with explicit references to a first and a second step of approval, as a single task is used for both approvals. The solution is _less readable_ for a less experienced reading public. For a fast understanding of the two steps needed for ultimate approval, this method of modeling is less suitable.

You might want to use that pattern when modeling the need for _multiple sets_ of eyes needed in _sequential_ order, therefore _minimizing effort_ needed by the participating approvers.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

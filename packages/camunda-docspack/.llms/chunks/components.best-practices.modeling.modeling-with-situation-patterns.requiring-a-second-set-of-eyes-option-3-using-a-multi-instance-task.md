# Modeling with situation patterns — Requiring a second set of eyes — Option 3: Using a multi-instance task

Diagram (BPMN):
  start "Loan requested" → user task "Approve loan" → end "Loan approved"
  note: For every approver

**(1)**

All the necessary approvers are immediately asked to look at the loan and decide by means of a multi-instance task. The tasks are completed with a positive approval. Once all positive approvals for all necessary approvers are made, the loan is ultimately approved.

**(2)**

If the loan is not approved by one of the approvers, a boundary message event is triggered, interrupting the multi-instance task and therefore removing all the tasks of all approvers who did not yet decide. The loan is then not approved.

**Evaluation:**

- This model is a very _compact_ modeling solution to the situation. It can also easily deal with multiple sets of eyes needed.

- Note that the approvers work in a _parallel_ mode, which might be exactly what we need in case we want _maximization of speed_ and want the approvers to do their work independent from each other and uninfluenced by each other. However, we also might prefer _minimization of effort_. If this is the case, refer to [option 1 (separate tasks)](#option-1-using-separate-tasks) or [option 2 (loop)](#option-2-using-a-loop) above.

- The solution is much _less explicit_ and _less readable_ for a less experienced reading public, because the way the boundary event interacts with a multi-instance task requires a profound understanding of BPMN. For communication purposes, this method of modeling is therefore typically less suitable.

You might want to use that pattern when modeling the need for _two_ or _multiple sets_ of eyes needed in _parallel_ order, therefore _maximising speed_ for the overall approval process.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

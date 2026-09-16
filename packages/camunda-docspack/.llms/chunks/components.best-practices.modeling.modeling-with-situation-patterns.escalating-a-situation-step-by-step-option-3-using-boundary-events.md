# Modeling with situation patterns — Escalating a situation step by step — Option 3: Using boundary events

Diagram (BPMN):
  start "Good needed" → user task "Order good" → receive task "Wait for delivery of good" → end "Good received"

**(1)**

After having ordered the goods, the process passively waits for the success case by means of a receive task: the goods should be delivered. However, in case this does not happen within a reasonable time...

**(2)**

a non-interrupting boundary timer event triggers a _first step of escalation_: remind the dealer. We still stay optimistic. Therefore, we did not interrupt the receive task, but continued to wait for the success case: the goods should still be delivered.

**(3)**

However, in case this does not happen within a reasonable time, we trigger a _second step of escalation_ by means of an interrupting boundary timer event: interrupt the waiting for delivery and cancel the deal.

**Evaluation:**

- This model is even more _compact_ and a very _generic_ modeling solution to the situation. If it comes to multiple steps of escalation, the non-interrupting boundary timer event could even trigger multiple times.

- The model complies with BPMN execution semantics. Since we never leave the wait state, the process is always ready to receive incoming messages.

- The solution is _less readable_ and _less intuitive_ for a less experienced reading public, because the way the interrupting and non-interrupting timers collaborate requires a profound understanding of boundary events and the consequences for token flow semantics. For communication purposes, this method of modeling is therefore typically less suitable.

**Note**
You might want to use that pattern when modeling _escalations with two steps_ as well as _escalations with multiple steps_ for _executable models._

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

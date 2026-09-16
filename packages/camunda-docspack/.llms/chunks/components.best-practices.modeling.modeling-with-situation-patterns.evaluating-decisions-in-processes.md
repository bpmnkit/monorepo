# Modeling with situation patterns — Evaluating decisions in processes

You need to come to a decision relevant for your next process steps. Your actual decision depends on a number of different factors and rules.

We sometimes also call that pattern **business rules** in BPMN.

**Example:** The freshly hired business analyst is always as busy as a bee: "Let's see... Category A customers always get their credit card applications approved, whereas Category D gets rejected by default. For B and C it's more complicated. Right, in between 2500 and 5000 Euros, we want a B customer, below 2500 a C customer is OK, too. Mmh. Should be no problem with a couple of gateways!"

### Showing decision logic in the diagram?

Diagram (BPMN):
  start "Credit card application received" → service task "Determine application details" → exclusive gateway "Monthly credit?"
    — [> 5000: =credit > 5000] exclusive gateway "Customer Category?"
      — [A: =category = "A"] exclusive gateway → user task "Issue credit card" → end "Credit card application accepted"
      — exclusive gateway → send task "Reject credit card application" → end "Credit card application rejected"
    — exclusive gateway "Customer Category?"
      — [A, B or C: =category = "A" or category = "B" or category = "C"] (back to exclusive gateway)
      — (back to exclusive gateway)
    — [> 2500: =credit > 2500] exclusive gateway "Customer Category?"
      — [A or B: =category = "A" or category = "B"] (back to exclusive gateway)
      — (back to exclusive gateway)

When modeling business processes, we focus on the flow of work and just use gateways to show that following tasks or results fundamentally differ from each other. However, in the example above, the business analyst used gateways to model the logic underlying a decision, which clearly is considered to be an anti-pattern!

It does not make sense to model the rules determining a decision inside the BPMN model. The rules decision tree will grow exponentially for every additional criteria. Furthermore, we typically will want to change such rules much more often than the process (in the sense of tasks needed to be carried out).

### Using a single task for a decision

Diagram (BPMN):
  start "Credit card application received" → business rule task "Evaluate credit-worthiness" → exclusive gateway "Applicant credit-worthy?"
    — [No: =not(creditWorthy)] send task "Reject credit card application" → end "Credit card application rejected"
    — [Yes: =creditWorthy] user task "Issue credit card" → end "Credit card application accepted"

**(1)**

Instead of modeling the rules determining a decision inside the BPMN model, we just show a single task representing the decision. Of course, when preparing for executing such a model in Camunda, we can wire such a task with a DMN decision table or some other programmed piece of decision logic.

**(2)**

While it would be possible to hide the evaluation of decision logic behind the exclusive gateway, we recommend always showing an explicit node with which the data is retrieved, which then might be used by subsequent data-based gateways.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns

# Workflow patterns — Routing — Loop

Refer to [Workflow Pattern 21: Structured Loop](http://www.workflowpatterns.com/patterns/control/basic/wcp21.php): "The ability to execute a task or subprocess repeatedly. The loop has either a pre-test or post-test condition associated with it."

In BPMN, you can simply model a loop:

Diagram (BPMN):
  start → "Task A" → exclusive gateway "Do it again?"
    — [No: =not(again)] end
    — [Yes: =again] (back to "Task A")

**(1)**

This exclusive gateway contains the expression to decide if to continue or exit the loop. The gateway can be before or after the loop.

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns

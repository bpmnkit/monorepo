# Workflow patterns — Routing — Dynamic parallel branches

You might want to execute some tasks for every element of a list, like the `for each` construct in programming languages. Refer to [Workflow Pattern 14: Multiple Instances with a priori Run-Time Knowledge](http://www.workflowpatterns.com/patterns/control/new/wcp14.php): "Multiple instances of a task can be created. The required number of instances may depend on a number of runtime factors, but is known before the task instances must be created. Once initiated, these instances are independent of each other and run concurrently. It is necessary to synchronize the instances at completion before any subsequent tasks can be triggered."

In BPMN, this is implemented using [multiple instance activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance):

Diagram (BPMN):
  start → subprocess → end

**(1)**

The parallel multiple instance marker defines that this subprocess is executed multiple times - once for each element of a given collection (like a `for each` loop in a programming language).

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns

# Overview

This document outlines an overview of supported markers.

You might want to execute some tasks for every element of a list, like the `for each` construct in programming languages. Refer to [Workflow Pattern 14: Multiple Instances with a priori Run-Time Knowledge](http://www.workflowpatterns.com/patterns/control/new/wcp14.php): "Multiple instances of a task can be created. The required number of instances may depend on a number of runtime factors, but is known before the task instances must be created. Once initiated, these instances are independent of each other and run concurrently. It is necessary to synchronize the instances at completion before any subsequent tasks can be triggered."

In BPMN, this is implemented using [multiple instance activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance):

Parallel multiple instance markers define that a subprocess is executed multiple times - once for each element of a given collection (like a `for each` loop in a programming language).

Currently supported markers:

- [Multi-instance](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance)
- [Compensation](https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler)
- [Ad-hoc](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/markers

# Script tasks

A script task is used to model the evaluation of a script; for example, a script written in Groovy,

A script task is used to model the evaluation of a script; for example, a script written in Groovy,
JavaScript, or Python.

![task](assets/script-task.png)

**Info**
Camunda 8 supports alternative task implementations for the script task. To use your own
implementation for a script task, refer to the [job worker implementation](#job-worker-implementation) section below. The
sections before this job worker implementation apply to the [FEEL expression](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-expressions-introduction)
implementation only.

When the process instance arrives at a script task, the integrated [FEEL Scala](https://github.com/camunda/feel-scala)
engine evaluates the script task FEEL expression. Once the FEEL expression is evaluated successfully, the process
instance continues.

If the FEEL expression evaluation is unsuccessful, an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) is
raised at the script task. When the incident is resolved, the script task is evaluated again.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/script-tasks/script-tasks

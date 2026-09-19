# Execution listeners — Variables in an execution listener — `cancel` listeners

Cancel listeners run when a process instance is terminated. They execute sequentially after all child elements have terminated and before the process reaches its final terminated state.

- A cancel listener can read the process variables. If a cancel listener completes the job with variables, the variables are merged into the process scope and visible to subsequent cancel listeners.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners

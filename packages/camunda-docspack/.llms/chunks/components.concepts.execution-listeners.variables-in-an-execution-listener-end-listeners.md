# Execution listeners — Variables in an execution listener — `end` listeners

End listeners are invoked after applying the variable output mappings and before leaving the element.

- An end listener can read the process variables, the local variables of the element, and the resulting
  variables of the output mappings.
- If an end listener completes the job with variables, those variables are propagated to the element's parent scope, like
  variables from the output mappings. Subsequent listeners can access these variables.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners

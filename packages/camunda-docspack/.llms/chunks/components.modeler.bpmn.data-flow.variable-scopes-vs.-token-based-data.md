# Data flow — Variable scopes vs. token-based data

A process can have concurrent paths; for example, when using a parallel gateway. When the execution reaches the parallel gateway, new tokens are created which execute the following paths concurrently.

Since the variables are part of the process instance and not of the token, they can be read globally from any token. If a token adds a variable or modifies the value of a variable, the changes are also visible to concurrent tokens.

![variable-scopes](assets/variable-scopes.png)

The visibility of variables is defined by the **variable scopes** of the process.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/data-flow

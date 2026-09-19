# Data flow — Concurrency considerations

When multiple active activities exist in a process instance (i.e. there is a form of concurrent
execution like usage of a parallel gateway, multiple outgoing sequence flows, or a parallel
multi-instance marker), you may need to take extra care in dealing with variables. When variables
are altered by one activity, it might also be accessed and altered by another at the same time. Race
conditions can occur in such processes.

We recommend taking care when writing variables in a parallel flow. Make sure the variables are
written to the correct [variable scope](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes) using variable
mappings and make sure to complete jobs and publish messages only with the minimum required
variables.

These type of problems can be avoided by:

- Passing only updated variables
- Using output variable mappings to customize the variable propagation
- Using an embedded subprocess and input variable mappings to limit the visibility and propagation of variables

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/data-flow

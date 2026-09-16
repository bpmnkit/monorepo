# Variables — Variable scopes — Define local variables

To define a local variable in Modeler, add an input mapping on the activity, subprocess, or call activity where you want the variable to exist. For details on input mapping concepts (`source` and `target`) see [input/output variable mappings](#inputoutput-variable-mappings).

The `target` of the input mapping becomes a local variable in that element's scope. For example, an input mapping with `source: =customer.name` and `target: reviewerName` creates the local variable `reviewerName` in that scope.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

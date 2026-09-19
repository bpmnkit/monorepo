# Variables — Input/output variable mappings — Output mappings

Output mappings can be used for several purposes:

- To customize how variables are merged into the process instance.
- They can be defined on most tasks (service, send, user, receive, script, and business rule tasks), [embedded](https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses) and [event subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses), [call activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities), and [ad-hoc subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses).
- They can also be defined on many events, including message, signal, timer, and conditional catch events, boundary events, and start events.

If **one or more** output mappings are defined, the results variables are set as **local variables** in the scope where the mapping is defined. Then, the output mappings are applied to the variables and create new variables in this scope. The new variables are merged into the parent scope. If there is no mapping for a job/message variable, the variable is not merged.

**Note**
This can lead to a case where some variables with an output mapping are merged into the parent scope, and others without an output mapping are not merged.

If **no** output mappings are defined, the behavior depends on the element. Tasks and events that produce a result (a job result, or a correlated message or signal payload) merge that whole result into the parent scope. Subprocesses and events that produce no result, such as none, link, escalation, and compensation events, propagate nothing; their local variables are discarded when the scope is left. For an overview across all element types, see [variable propagation by BPMN element](#variable-propagation-by-bpmn-element).

In the case of a subprocess, the behavior is different. There are no results variables to be merged. However, output mappings can be used to propagate **local variables** of the subprocess to higher scopes. By default, all **local variables** are removed when the scope is left.

Examples:

| Results variables                                    | Output mappings                                                                                                                      | Process variables                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `status: "Ok"`                                       | **source:** `=status`**target:** `paymentStatus`                                                                                | `paymentStatus: "OK"`                              |
| `result: {"status": "Ok", "transactionId": "t-789"}` | **source:** `=result.status`**target:** `paymentStatus`**source:** `=result.transactionId`**target:** `transactionId` | `paymentStatus: "Ok"``transactionId: "t-789"` |

**Note**
An output mapping `target` that contains a period (for example, `order.status`) updates only the final property and merges it into the existing variable at that path, leaving sibling properties untouched. This is supported, but use it deliberately, as it modifies a property of an existing variable rather than replacing the whole variable. For details, see [nested variables in mappings](#nested-variables-in-mappings).

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

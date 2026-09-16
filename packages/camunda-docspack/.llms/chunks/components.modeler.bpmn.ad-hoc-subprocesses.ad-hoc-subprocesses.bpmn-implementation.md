# Ad-hoc sub-processes — BPMN implementation

By default, ad-hoc sub-processes are handled internally in Zeebe. You can model which [elements to activate](#activate-an-element) and when the sub-process is [completed](#completion).
Alternatively, use the [ad-hoc sub-process API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/activate-ad-hoc-sub-process-activities.api) to activate elements manually.

### Activate an element

An ad-hoc sub-process can define an expression `activeElementsCollection` that should return a
[list](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-data-types#list) of strings. Each string in the list should match to an ID of
an inner element of the ad-hoc sub-process. Usually, the expression accesses a process variable that was
created before and holds the list of element IDs.

![A process with an ad-hoc sub-process that shows how a variable is used to active the inner elements.](assets/ad-hoc-subprocess-activation.png)

When a process instance reaches an ad-hoc sub-process, it evaluates the expression `activeElementsCollection` and
activates all elements whose element IDs are in the list.

If the list is empty or the expression is not defined, no element is activated and the ad-hoc sub-process remains active.

If the expression doesn't evaluate to a list of strings, or the list contains other values than inner element IDs, the
process instance creates an incident.

**Note**
Currently, it is not possible to activate elements dynamically after the ad-hoc sub-process is activated, only on
entering the subprocess.

### Completion

An ad-hoc sub-process can define an optional `completionCondition` [boolean expression](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions)
that is evaluated every time an inner element is completed.

- If the expression evaluates to `true` after completing an inner element, the ad-hoc sub-process is completed and the process instance takes the outgoing sequence flows.
- If no `completionCondition` is defined, the ad-hoc sub-process is completed after all [activated elements](#activate-an-element)
  are completed.

A `cancelRemainingInstances` boolean attribute can be configured to influence the ad-hoc sub-process behavior when the completion condition is met.

- If set to `true` (default value), all remaining active instances of inner elements are terminated and the ad-hoc sub-process is directly completed.
- If set to `false`, the ad-hoc sub-process waits for the completion of all active instances before completing.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses

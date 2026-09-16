# Event subprocess — Variables

Unlike a boundary event, an event subprocess is inside the scope. Therefore, it can access and modify all local variables of its containing scope. This is not possible with a boundary event because a boundary event is outside of the scope.

Input mappings can be used to create new local variables in the scope of the event subprocess. These variables are only visible within the event subprocess. If no input mappings are defined, the [default behavior](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes) is applied to the variables alongside the event.

By default, the local variables of the event subprocess are not propagated (i.e. removed with the scope). This behavior can be customized by defining output mappings at the event subprocess. The output mappings are applied on completion of the event subprocess.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses

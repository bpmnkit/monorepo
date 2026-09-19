# Embedded subprocess — Variable mappings

Input mappings can be used to create new local variables in the scope of the subprocess. These variables are only visible within the subprocess.

By default, the local variables of the subprocess are not propagated (i.e. they are removed with the scope.) This behavior can be customized by defining output mappings at the subprocess. The output mappings are applied on completing the subprocess.

An embedded subprocess produces no result of its own, so its own local variables reach the parent scope only through an output mapping. This doesn't block variables set by tasks inside the subprocess: those still propagate upward through the subprocess scope to the parent scope on completion, per [variable propagation](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation), unless a same-named variable exists in the subprocess scope. For how an embedded subprocess compares to other elements, see [variable propagation by BPMN element](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation-by-bpmn-element).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses

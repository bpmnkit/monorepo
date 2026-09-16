# Ad-hoc sub-processes — Variable mappings

An ad-hoc sub-process can define input and output
[variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings).

**Input variable mappings** are applied on activating the ad-hoc sub-process and before evaluating the expression
`activeElementsCollection`. They can be used to create local variables for the ad-hoc sub-process.

**Output variable mappings** are applied on completing the ad-hoc sub-process. They can be used to propagate local variables
from the ad-hoc sub-process into the process instance. By default, no local variables are propagated.

Variables written by the activities the ad-hoc sub-process activates stay local to each activation and are not propagated on their own. If an output collection is configured, it is propagated to the parent scope when the ad-hoc sub-process completes. For how an ad-hoc sub-process compares to other elements, see [variable propagation by BPMN element](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation-by-bpmn-element).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses

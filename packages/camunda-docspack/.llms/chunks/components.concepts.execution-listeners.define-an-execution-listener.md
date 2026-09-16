# Execution listeners — Define an execution listener

You can configure execution listeners for individual BPMN elements, such as tasks, events, and gateways, as well as for the overall process and subprocesses, including the [ad-hoc sub-process](https://docs.camunda.io/docs/next/reference/glossary#ad-hoc-sub-process) that hosts an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent).

There are four types of execution listeners:

- **Before all**: Invoked only on the [multi-instance](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance) body, _before_ any inner instances are created. Useful for initializing variables such as the `inputCollection`.
- **Start**: Invoked _before_ the element is processed. Useful for setting variables or executing preconditions.
- **End**: Invoked _after_ the element is processed. Useful for executing cleanup or post-processing tasks.
- **Cancel**: Invoked on the process element _when the process instance is terminated_. Useful for cleanup, audit logging, or notifying external systems that the process did not complete.

Each listener has three properties:

| Property    | Description                                                                          |
| :---------- | :----------------------------------------------------------------------------------- |
| `eventType` | Specifies when the listener is triggered (`beforeAll`, `start`, `end`, or `cancel`). |
| `type`      | The name of the job type.                                                            |
| `retries`   | The number of job retries.                                                           |

**Note**
If multiple listeners of the same `eventType` (such as multiple start listeners) are defined on the same activity, they are executed sequentially in the order defined in the BPMN model.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners

# Variables — Input/output variable mappings — Input mappings

Input mappings can be used to create new variables. They can be defined on [service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks), [script tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/script-tasks/script-tasks), [business rule tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks), [call activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities), [user tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks), [send tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/send-tasks/send-tasks), [subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/subprocesses), [event subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses), and [ad-hoc subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses). Support depends on the element type. See the element's own page for details.

When an input mapping is applied, it creates a new [**local variable**](#local-variables) in the scope where the mapping is defined.

In Modeler, define these mappings in the element properties.

You can use [expressions](https://docs.camunda.io/docs/next/components/concepts/expressions) or static values for input mappings. You can leave the `source` empty to map the `target` variable to `null`.

For string literals containing escaped characters (e.g., a newline character `\n`), the string is returned in its original form as expected (no double escaping is applied).

Examples:

| Process variables                      | Input mappings                                                                                               | New variables                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `orderId: "order-123"`                 | **source:** `=orderId` **target:** `reference`                                                          | `reference: "order-123"`                    |
| `customer:{"name": "John"}`            | **source:** `=customer.name`**target:** `sender`                                                        | `sender: "John"`                            |
| `customer: "John"``iban: "DE456"` | **source:** `=customer` **target:** `sender.name`**source:** `=iban`**target:** `sender.iban` | `sender: {"name": "John", "iban": "DE456"}` |
| -                                      | **source:** `"Peter"`**target:** `sender`                                                               | `sender: "Peter"`                           |
| `customer:{"name": "John"}`            | **source:** (not provided)**target:** `customer`                                                        | `customer: null`                            |

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

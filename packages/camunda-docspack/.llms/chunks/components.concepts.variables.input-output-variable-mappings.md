# Variables — Input/output variable mappings

Input/output variable mappings can be used to create new variables or customize how variables are merged into the process instance.

Variable mappings are defined in the process as extension elements under `ioMapping`. Every variable mapping has a `source` and a `target` expression.

The `source` expression defines the **value** of the mapping. It usually [accesses a variable](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables#access-variable) of the process instance that holds the value. If the variable or nested property doesn't exist, the value resolves to `null`. The same applies if you do not provide a `source`.

The `target` expression defines **where** the value of the `source` expression is stored. It can reference a variable by its name or a nested property of a variable. If the variable or the nested property doesn't exist, it's created.

Variable mappings are evaluated in the defined order. Therefore, a `source` expression can access the target variable of a previous mapping.

![variable-mappings](assets/variable-mappings.png)

**Input mappings**

| Source          | Target      |
| --------------- | ----------- |
| `customer.name` | `sender`    |
| `customer.iban` | `iban`      |
| `totalPrice`    | `price`     |
| `orderId`       | `reference` |

**Output mapping**

| Source   | Target          |
| -------- | --------------- |
| `status` | `paymentStatus` |

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

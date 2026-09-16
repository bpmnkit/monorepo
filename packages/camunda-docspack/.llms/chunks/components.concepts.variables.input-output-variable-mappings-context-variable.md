# Variables — Input/output variable mappings — Context variable

A context variable is a reserved variable that describes the context of a task. It can group variables together to provide a detailed description of the task or offer more descriptive data about it.
The reserved variable name for a context variable is `taskContextDisplayName`. This name is reserved exclusively for this purpose and should not be used for other variables.

**Warning**
Context variables were a Tasklist V1 feature and are not supported in current Tasklist releases. See [Tasklist API changes](https://docs.camunda.io/docs/next/components/tasklist/api-versions).

Example:

| Input variable           | Example                              |
| ------------------------ | ------------------------------------ |
| `taskContextDisplayName` | `This is a context variable example` |

The data from the variable will be shown on the task tile, as shown in the example below:

![context-variables](assets/context-variables.png)

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables

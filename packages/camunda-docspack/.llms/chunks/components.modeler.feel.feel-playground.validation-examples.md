# FEEL Playground — Validation examples

### Example valid FEEL expression

- In this example, both the FEEL expression syntax and the contextual data are valid.
- The expression is evaluated, and a valid "Approved" result is returned.

### Example invalid FEEL expression

- In this example, the **FEEL expression** shows an error status to indicate it did not pass validation.
- The error is caused by an extraneous "else" at the end of the expression, meaning it is not a valid FEEL expression syntax.
- Hovering over the icon provides more detail on what is causing the error, for example "Expression evaluation failed: Unrecognized token in Expression".

### Example data warning

- In this example, the **Result** shows a warning status to indicate it did not pass validation.
- The warning is caused by an invalid type in the contextual data, as the `hasJob` value must be a boolean value for the `hasJob = true` expression to be valid.
- The warning text provides an explanation of why the warning occurred, and where to check for an error.

### Example JSON error

- In this example, the **Context** shows an error status to indicate it did not pass validation.
- The error is caused by an extra comma character after the last key-pair, which is not a valid JSON format.
- Hovering over the icon provides more detail on what is causing the error, for example "Invalid JSON: Expected double-quoted property name in JSON at position 98 (line 7 column 1)".

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/feel-playground

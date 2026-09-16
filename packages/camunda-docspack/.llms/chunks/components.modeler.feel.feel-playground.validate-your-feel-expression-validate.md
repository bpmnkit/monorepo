# FEEL Playground — Validate your FEEL expression {#validate}

To use the FEEL Playground for validation:

1. Open the properties panel of a diagram element containing the FEEL expression you want to validate.
1. To open the popup FEEL editor, click **fx** on the FEEL expression field, and click the **Open popup editor** icon in the field.

   

1. In the popup FEEL editor, enter and validate your expression using the contextual data. Edit the expression as required until it is valid (returns an Approved status) and no errors are shown. See [validation results](#results).


## Validation results {#results}

FEEL Playground validation results are shown as follows for each panel:

| Icon                                                                               | Status  | Description                                                                                                                                                                                                                                                                                                                                            |
| :--------------------------------------------------------------------------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   | Valid   | The FEEL expression successfully passed validation.                                                                                                                                                                                                                                                                                                    |
|  | Warning | The FEEL expression is invalid. Edit your expression or sample data to pass validation.For example, there might be an invalid type in the contextual data, meaning that values could not be compared as the type does not match as expected (for example, the sample data has a numeric value instead of a boolean value in a key-pair). |
|      | Error   | The validation did not complete due to an error.For example, you might need to check your sample contextual data JSON is formed correctly.                                                                                                                                                                                               |

**Tip**
Hover over a status icon to see more information, such as the reason why the FEEL expression is invalid.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/feel-playground

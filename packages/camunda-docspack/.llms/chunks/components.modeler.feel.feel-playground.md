# FEEL Playground

Learn more about using the Camunda FEEL Playground to check and validate your FEEL expressions

Use the FEEL Playground to validate and troubleshoot your FEEL expressions when modeling process diagrams in Camunda Hub.


## About FEEL Playground

When using the [FEEL expression language](https://docs.camunda.io/docs/next/components/modeler/feel/what-is-feel) in Camunda, your FEEL expressions must be valid. The FEEL Playground allows you to test and validate your FEEL expressions using sample contextual data.

The FEEL Playground is integrated into the popup FEEL editor:

- **FEEL expression**: Enter and edit the FEEL expression you want to validate.

- **Context**: A set of [sample data and variables](https://docs.camunda.io/docs/next/components/modeler/data-handling) to use as a context for validating your expression against. You can edit this sample data if required. The data must be correctly formatted as valid JSON.

- **Result**: Shows the results of the validation when run against the sample data. For example, if the expression is valid for the sample data, an [Approved validation result](#results) is returned. If there is a validation issue, a warning and description of the issue is shown to help you troubleshoot the expression.

- **FEEL Copilot**: (For SaaS only) Open the [FEEL Copilot (alpha feature)](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features) to chat with the AI FEEL Copilot and get help with generating expressions.

**Note**
The latest version of the [FEEL Scala engine](https://docs.camunda.io/docs/next/components/modeler/feel/what-is-feel#feel-engines) is used to validate FEEL expressions in the FEEL Playground.

This can be different than the FEEL Scala version used by the linter's Zeebe version and the cluster the diagram will be deployed to.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/feel-playground

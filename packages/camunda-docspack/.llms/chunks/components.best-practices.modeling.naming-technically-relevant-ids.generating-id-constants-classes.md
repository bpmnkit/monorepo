# Naming technically relevant IDs — Generating ID constants classes

If you have lots of process, case, and decision definitions with lots of IDs, consider generating constant classes (e.g. via XSLT) directly from your BPMN or DMN XML files. For example, this can be used for testing.


## Using a Camunda Modeler plugin to generate meaningful ids

You can use [this modeler plugin community extension](https://github.com/camunda-community-hub/camunda-modeler-plugin-rename-technical-ids) to automatically convert your IDs to comply with our best practices. Of course, you could also use this as a basis to create your own modeler plugin to generate IDs that follow your custom naming conventions. Or, you could implement a similar plugin to implement checks if all relavant IDs follow your naming conventions.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-technically-relevant-ids

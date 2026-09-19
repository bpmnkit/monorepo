# Ad-hoc sub-processes — Special ad-hoc sub-process variables

When an ad-hoc sub-process is activated, the `adHocSubProcessElements` variable is created in its scope.
This variable provides metadata about the sub-process and its inner elements. Job workers can use it to decide which elements to activate.

The variable contains a list of activatable elements. Each element includes:

- `elementId`: The ID of the element.
- `elementName`: The name of the element.
- `documentation`: The documentation of the element.
- `properties`: The properties defined on the element.
- `parameters`: Parameters defined using the [`fromAi`](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent#fromaivalue) FEEL function.

**Info**
Do not update the `adHocSubProcessElements` variable. Changing its value can cause unexpected behavior.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses

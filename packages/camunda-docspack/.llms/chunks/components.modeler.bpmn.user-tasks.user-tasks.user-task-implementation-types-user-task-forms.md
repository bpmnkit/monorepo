# User tasks — User task implementation types — User task forms

A user task typically includes a form. A form contains work instructions for the user and captures the resulting information in a structured way.

However, user tasks are not limited to forms. User tasks can also be used to refer users to other applications or redirect them to a website.

You can use [Camunda Forms](https://docs.camunda.io/docs/next/components/modeler/forms/utilizing-forms) that offer visual editing of forms directly in Camunda Modeler, or use your own forms.
Forms can either be displayed in [Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist), or handled by a custom application.

To use a form, a user task requires a form reference.
Depending on your use case, two different types of form references can be used:

1. **Camunda Forms** provide a flexible way of linking a user task to a Camunda Form via the form ID.
   Forms linked this way can be deployed together with the referencing process models.
   To link a user task to a Camunda Form, you have to specify the ID of the Camunda Form as the `formId` attribute of the task's `zeebe:formDefinition` extension element (see the [XML representation](#camunda-form)).

   The `bindingType` attribute determines which version of the linked form is used:
   - `latest`: The latest deployed version at the moment the user task is activated.
   - `deployment`: The version that was deployed together with the currently running version of the process.
   - `versionTag`: The latest deployed version that is annotated with the version tag specified in the `versionTag` attribute.

   To learn more about choosing binding types, see [choosing the resource binding type](https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-resource-binding-type).

**Note**
   If the `bindingType` attribute is not specified, `latest` is used as the default.

   You can read more about Camunda Forms in the [Camunda Forms guide](https://docs.camunda.io/docs/next/components/modeler/forms/utilizing-forms) or the [Camunda Forms reference](https://docs.camunda.io/docs/next/components/modeler/forms/camunda-forms-reference)
   to explore all configuration options for form elements.

2. A **custom form reference** can specify any custom identifier in the user task using the `externalReference`
   attribute of the task's `zeebe:formDefinition` extension element (see the [XML representation](#camunda-form-linked)).
   How the identifier is interpreted depends on your implementation.
   You can use it to associate a custom form, route to a custom application, or a URL to a web page, for example.
   A custom form reference will not be shown in Tasklist.

**Info**
For user tasks with a [job worker implementation](#job-worker-implementation), the custom form references are defined on the `formKey` attribute of the `zeebe:formDefinition` extension element instead of the `externalReference` attribute.

Furthermore, there is a third form option for job worker-based user tasks: embedded Camunda Forms. You can use them to embed a form's JSON configuration directly into the BPMN process XML as a `zeebe:UserTaskForm` extension element of the process element. The embedded form can then be referenced via the `formKey` attribute (see [XML representation](#camunda-form-embedded)).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks

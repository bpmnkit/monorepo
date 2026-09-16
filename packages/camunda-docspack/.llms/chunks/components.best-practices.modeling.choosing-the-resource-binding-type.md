# Choosing the resource binding type

Choose the resource binding type and understand the differences between 'latest' and 'deployment' binding for linked resources.

Camunda 8 offers version binding for linked processes, decisions, forms, and deployment-bound resources.

Use deployment binding when a resource is deployed together with the process and should be consumed as the version that shipped with that deployment. This also applies to generic resources that are packaged and deployed with the process application.

You can choose the binding type for the linked target resource for the following BPMN process elements:

- [Call activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities#defining-the-called-process)
- [Business rule tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks#defining-a-called-decision) (if the DMN decision implementation is used)
- [User tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#user-task-forms) (if a Camunda Form is linked)

The binding type determines the version of the target resource used at runtime.

For example, for a call activity this would be the version of the called process to be instantiated.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-resource-binding-type

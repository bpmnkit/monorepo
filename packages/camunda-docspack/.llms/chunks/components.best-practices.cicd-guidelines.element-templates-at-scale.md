# Element templates at scale

Learn how to provision element templates at runtime and make them available at design time across your Camunda Hub organization and Desktop Modeler.

To effectively manage large libraries of reusable building blocks ([element templates](https://docs.camunda.io/docs/next/components/concepts/element-templates)), you can create a pipeline that:

- Provisions the [dependencies of element templates](https://docs.camunda.io/docs/next/components/modeler/element-templates/element-template-with-dependencies) to required clusters.
- Makes templates available at design time to multiple [workspaces](https://docs.camunda.io/docs/next/components/hub/organization/manage-workspaces/index) within an organization.

<!--- source: https://www.figma.com/design/VyyoV0hNbazXV8DKcMMEU9/Camunda-Documentation-Assets?node-id=2078-301&t=YNT70ktAMXBBupbJ-1 --->

![Pipeline goal](./img/pipeline-goal.png)

This guide covers conceptually what your pipeline needs to do, from obtaining credentials to runtime provisioning and template syncing.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/cicd-guidelines/element-templates-at-scale

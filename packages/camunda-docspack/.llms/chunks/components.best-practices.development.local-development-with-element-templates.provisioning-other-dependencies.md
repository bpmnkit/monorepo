# Local development with element templates and Camunda 8 Run — Provisioning other dependencies

### Using Desktop Modeler

Deploy element template dependencies using [Desktop Modeler](https://docs.camunda.io/docs/next/components/modeler/desktop-modeler/index) by following the [self-managed deployment guide](https://docs.camunda.io/docs/next/self-managed/components/modeler/desktop-modeler/deploy-to-self-managed).

This process applies to BPMN diagrams, forms, DMN diagrams, and RPA scripts.

### Using the Cluster API

For an automated approach, write scripts that use the [Orchestration Cluster REST API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview) to deploy dependencies.

To deploy additional dependencies—such as forms, DMN diagrams, or subprocesses—send a [POST request](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-deployment.api) with the relevant files.

For example:

```

curl -L 'http://localhost:8080/v2/deployments' \
-H 'Accept: application/json' \
-F resources=@/pathToYourForm/user-signup.form

```

You will get a response containing the details of the deployed elements:

```json
{
  "deployments": [
    {
      "form": {
        "formKey": "KEY_OF_THE_FORM",
        "formId": "user-signup",
        "version": 1,
        "resourceName": "user-signup.form",
        "tenantId": "<default>"
      }
    }
  ],
  "deploymentKey": "KEY_OF_THE_DEPLOYMENT",
  "tenantId": "<default>"
}
```

You can use element templates that reference the `user-signup.form`.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/local-development-with-element-templates

# Element templates at scale — Runtime provisioning

### Secrets

You can use sensitive information in your element templates without exposing it in your BPMN processes by referencing secrets.

These guides show you how to configure them depending on the environment you are using:

- **SaaS**: Use the [Administration API](https://docs.camunda.io/docs/next/apis-tools/administration-api/administration-api-reference) or [Camunda Hub UI](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-secrets) to configure secrets.
- **Self-Managed/local development**: Configure secrets outside the pipeline. See [connector secrets](https://docs.camunda.io/docs/next/self-managed/components/connectors/connectors-configuration#secrets).

### Job Workers

As part of the pipeline, you may spin up a service that will connect to a Camunda cluster to perform specific tasks. For example, you can use the [Spring Boot Camunda Starter](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started) to start a job worker.

Recommended resources:

- [Outbound connectors vs. job workers](https://docs.camunda.io/docs/next/components/concepts/outbound-connectors-job-workers)
- [Host custom connectors](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/host-custom-connector)

### Other dependencies

The following dependency types are provisioned at runtime using the [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview):

| Dependency                                                            | Purpose                     |
| --------------------------------------------------------------------- | --------------------------- |
| [Camunda forms](https://docs.camunda.io/docs/next/components/modeler/forms/camunda-forms-reference) | Used in user tasks          |
| [RPA scripts](https://docs.camunda.io/docs/next/components/rpa/overview)                            | Used in service tasks       |
| [BPMN processes](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn)                    | Used in call activities     |
| [DMN decisions](https://docs.camunda.io/docs/next/components/modeler/dmn/dmn)                       | Used in business rule tasks |

To deploy dependencies, send a [POST request](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-deployment.api) with the files. This works for SaaS, Self-Managed, and local development.

For example:

```bash
curl -L 'http://localhost:8080/v2/deployments' \
-H 'Accept: application/json' \
-F resources=@/path/to/your/form/user-signup.form
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

When referencing a dependency such as a form, Camunda recommends using a `versionTag` as your [binding type](https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-resource-binding-type#supported-binding-types). This option ensures the right version of the target resource is always used.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/cicd-guidelines/element-templates-at-scale

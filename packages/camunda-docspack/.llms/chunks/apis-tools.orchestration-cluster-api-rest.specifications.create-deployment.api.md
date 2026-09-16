# Deploy resources

`POST /deployments`

Deploys one or more resources, including BPMN processes, DMN decision models, forms, RPA resources, and generic files.
A deployment can contain any file type. Files that are not interpreted as BPMN, DMN, form, or RPA resources are stored as deployable generic resources in the engine.
This is an atomic call, i.e. either all resources are deployed or none of them are.

- Required permissions: CREATE on RESOURCE.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  multipart/form-data: object (required)
    resources (string[], required) — The binary data to create the deployment resources. It is possible to have more than one form part with different form part names for the binary data to create…
    tenantId (TenantId)

Responses:
  200 DeploymentResult — The resources are deployed.
  400 ProblemDetail — The provided data is not valid.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-deployment.api

# Migrate process instance

`POST /process-instances/{processInstanceKey}/migration`

Migrates a process instance to a new process definition.
This request can contain multiple mapping instructions to define mapping between the active
process instance's elements and target process definition elements.

Use this to upgrade a process instance to a new version of a process or to
a different process definition, e.g. to keep your running instances up-to-date with the
latest process improvements.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Request body:
  application/json: ProcessInstanceMigrationInstruction (required)
    targetProcessDefinitionKey (ProcessDefinitionKey, required) — The key of process definition to migrate the process instance to.
    mappingInstructions (MigrateProcessInstanceMappingInstruction[], required) — Element mappings from the source process instance to the target process instance.
    operationReference (OperationReference)

Responses:
  204 — The process instance is migrated.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The process instance is not found.
  409 ProblemDetail — The process instance migration failed. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/migrate-process-instance.api

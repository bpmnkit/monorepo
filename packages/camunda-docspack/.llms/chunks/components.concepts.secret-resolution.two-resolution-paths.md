# Secret resolution — Two resolution paths

|          | Broker path                             | Gateway API path                                                                           |
| :------- | :-------------------------------------- | :----------------------------------------------------------------------------------------- |
| Used by  | Job workers, outbound connectors        | Inbound connectors (`POST /v2/secrets/resolve`), the Web Modeler (`POST /v2/secrets/list`) |
| When     | Asynchronously, ahead of job activation | On demand, per request                                                                     |
| Delivery | Long polling and job push               | The HTTP response                                                                          |

The broker path resolves references in a job's variables in the background and injects the resolved values only when the job is activated. See [Secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation) for the scheduler, caching, and delivery mechanics, including why no resolved value reaches a record, runtime state, or log on this path.

The gateway API path serves callers that have no job to wait on. An inbound connector resolves the references an expression evaluation used, in batches, through `POST /v2/secrets/resolve`. The Web Modeler calls `POST /v2/secrets/list` to offer known reference names while you author a model. Both endpoints share a request and response contract described in [Secrets](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-secrets); for the full request and response schema of each, see [Resolve secrets](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resolve-secrets.api) and [List secrets](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/list-secrets.api).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution

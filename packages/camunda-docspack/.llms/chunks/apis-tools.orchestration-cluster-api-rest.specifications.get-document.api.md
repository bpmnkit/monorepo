# Download document

`GET /documents/{documentId}`

Download a document from the Camunda 8 cluster.

Note that this is currently supported for document stores of type: AWS, Azure, GCP, in-memory (non-production), local (non-production)

- Required permissions: READ on DOCUMENT.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  documentId (path, DocumentId, required)
  storeId (query, string)
  contentHash (query, string)

Responses:
  200 string — The document was downloaded successfully.
  404 ProblemDetail — The document with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-document.api

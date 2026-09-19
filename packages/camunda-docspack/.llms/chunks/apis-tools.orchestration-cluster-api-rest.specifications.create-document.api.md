# Upload document

`POST /documents`

Upload a document to the Camunda 8 cluster.

Note that this is currently supported for document stores of type: AWS, Azure, GCP, in-memory (non-production), local (non-production)

- Required permissions: CREATE on DOCUMENT.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  storeId (query, string)
  documentId (query, DocumentId)

Request body:
  multipart/form-data: object (required)
    file (string, required)
    metadata (DocumentMetadata)

Responses:
  201 DocumentReference — The document was uploaded successfully.
  400 ProblemDetail — The provided data is not valid.
  415 ProblemDetail — The server cannot process the request because the media type (Content-Type) of the request payload is not supported by the server for the requested resource and method.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-document.api

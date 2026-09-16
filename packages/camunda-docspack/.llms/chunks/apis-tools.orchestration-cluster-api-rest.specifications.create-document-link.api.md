# Create document link

`POST /documents/{documentId}/links`

Create a link to a document in the Camunda 8 cluster.

Note that this is currently supported for document stores of type: AWS, Azure, GCP

- Required permissions: CREATE on DOCUMENT.
- Added in Camunda 8.7.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  documentId (path, DocumentId, required)
  storeId (query, string)
  contentHash (query, string)

Request body:
  application/json: DocumentLinkRequest
    timeToLive (integer) — The time-to-live of the document link in ms.

Responses:
  201 DocumentLink — The document link was created successfully.
  400 ProblemDetail — The provided data is not valid.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-document-link.api

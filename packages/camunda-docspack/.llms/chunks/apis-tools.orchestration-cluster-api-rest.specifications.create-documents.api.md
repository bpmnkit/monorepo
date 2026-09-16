# Upload multiple documents

`POST /documents/batch`

Upload multiple documents to the Camunda 8 cluster.

The caller must provide a file name for each document, which will be used in case of a multi-status response
to identify which documents failed to upload. The file name can be provided in the `Content-Disposition` header
of the file part or in the `fileName` field of the metadata. You can add a parallel array of metadata objects. These
are matched with the files based on index, and must have the same length as the files array.
To pass homogenous metadata for all files, spread the metadata over the metadata array.
A filename value provided explicitly via the metadata array in the request overrides the `Content-Disposition` header
of the file part.

In case of a multi-status response, the response body will contain a list of `DocumentBatchProblemDetail` objects,
each of which contains the file name of the document that failed to upload and the reason for the failure.
The client can choose to retry the whole batch or individual documents based on the response.

Note that this is currently supported for document stores of type: AWS, Azure, GCP, in-memory (non-production), local (non-production)

- Required permissions: CREATE on DOCUMENT.
- Added in Camunda 8.7.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  storeId (query, string)

Request body:
  multipart/form-data: object (required)
    files (string[], required) — The documents to upload.
    metadataList (DocumentMetadata[]) — Optional JSON array of metadata object whose index aligns with each file entry. The metadata array must have the same length as the files array.

Responses:
  201 DocumentCreationBatchResponse — All documents were uploaded successfully.
  207 DocumentCreationBatchResponse — Some documents were uploaded successfully, others failed.
  400 ProblemDetail — The provided data is not valid.
  415 ProblemDetail — The server cannot process the request because the media type (Content-Type) of the request payload is not supported by the server for the requested resource and method.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-documents.api

# Secrets — Understand resolve responses

`POST /v2/secrets/resolve` accepts a batch of references and resolves each reference independently. A structurally valid request always returns HTTP 200, even if every reference in the batch fails.

Successfully resolved references are returned in `resolved`. References that cannot be resolved are returned in `errors`. A failure for one reference does not affect the others in the same batch.

### Review per-reference errors

Each entry in `errors` uses one of the following codes:

| Code                | Meaning                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `NOT_FOUND`         | No secret exists for this reference.                                          |
| `ACCESS_DENIED`     | The caller lacks `SECRET:REVEAL` for this reference.                          |
| `INVALID_REFERENCE` | The reference is malformed or exceeds the length limit.                       |
| `UNREADABLE`        | The store contains a secret for this reference, but its value cannot be read. |

`UNREADABLE` does not mean that the secret is absent. Handle it differently from `NOT_FOUND` when responding to a failure.

### Check batch limits

A request can contain up to 20 references, with a maximum length of 256 characters per reference. The server deduplicates duplicate references within the same request and resolves each unique reference once.

### Understand HTTP 400 responses

`POST /v2/secrets/resolve` returns HTTP 400 only when the request itself is malformed. Examples include:

- A missing or non-array `references` field.
- More than 20 references.
- A `null` entry.

A well-formed request that fails to resolve every reference still returns HTTP 200 with `errors` populated.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-secrets

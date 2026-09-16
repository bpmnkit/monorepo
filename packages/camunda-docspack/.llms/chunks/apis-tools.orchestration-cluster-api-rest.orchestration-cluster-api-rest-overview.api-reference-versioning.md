# Orchestration Cluster REST API — API reference — Versioning

Camunda uses semantic versioning (SemVer) to ensure API changes are predictable and compatible. This helps you upgrade safely without unexpected breaking changes.

The API version is determined by the API version number (`v2`) and the product version—for example, `POST /v2/user-tasks/search` in Camunda 8.8.0.

Camunda versions the entire API rather than individual endpoints. If a breaking change occurs in any endpoint, the entire API is versioned. During migration periods, multiple API versions may coexist—for example, both `v2` and `v3` versions of `/user-tasks/search` may be available in the same release.

**Note**
Adding new endpoints or attributes to existing responses is **not** considered a breaking change.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview

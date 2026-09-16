# Secrets

Learn about the shared request and response contract for the resolve and list secrets endpoints.

`POST /v2/secrets/resolve` and `POST /v2/secrets/list` use a shared request and response contract that differs from most of the Orchestration Cluster REST API.

For the complete request and response schema for each endpoint, see [Resolve secrets](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resolve-secrets.api) and [List secrets](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/list-secrets.api). To understand what a `camunda.secrets.<name>` reference is and how Camunda resolves it elsewhere in the cluster, see [Secret resolution](https://docs.camunda.io/docs/next/components/concepts/secret-resolution). For Java client usage, see [Secrets](https://docs.camunda.io/docs/next/apis-tools/java-client/secrets).

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-secrets

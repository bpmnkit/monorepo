# Data fetching

Learn about fetching data using the Orchestration Cluster REST API.

The Orchestration Cluster REST API allows you to retrieve data from key resources like process definitions, user tasks, users, and tenants. Each search-enabled endpoint supports rich filtering, sorting, and pagination so you can quickly find the data that matters most.

The sections below explain how to structure a search request and interpret the response format.


## Searchable resources

The following examples support search via POST endpoints, each with its own set of filterable fields:

- Process instances (`POST /v2/process-instances/search`)
- User tasks (`POST /v2/user-tasks/search`)
- Users (`POST /v2/users/search`)
- Batch operations (`POST /v2/batch-operations/search`)

Refer to the [interactive Orchestration Cluster REST API Explorer](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/orchestration-cluster-api.info) for the full attribute lists.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

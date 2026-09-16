# Data fetching — Supported operations

Most searchable resources allow:

- Filtering based on properties or variables
- Sorting results
- Paginating with either offset or cursor methods
- Accessing nested resources (e.g., group users)

> Example: You can search for groups using `POST /v2/groups/search`, and for the users in a group using `POST /v2/groups/:groupId/users/search`.

You can also fetch single resources using `GET` endpoints with unique identifiers, such as:

```shell
GET /v2/user-tasks/:userTaskKey
```


## Data consistency

Endpoints in the Orchestration Cluster API are classified as either **strongly consistent** or **eventually consistent**.  
This distinction applies to the _data behind the endpoint_, not the endpoint's functionality itself.

- **Strongly consistent endpoints** return data that reflects the real-time state of the system.
- **Eventually consistent endpoints** return data exported by the [Camunda Exporter](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/exporters/camunda-exporter). This data may lag behind the real-time state until the exporter processes it, so it becomes consistent only after a delay.

Each endpoint is clearly labeled with its consistency type so you can account for this behavior in your applications.

### Why consistency matters

If eventual consistency is not handled properly, it can lead to unexpected results.

For example:

1. A resource is created using a strongly consistent endpoint.
2. An _immediate_ request to an eventually consistent endpoint for the same resource might return:
   - `404 Not Found` for a `GET` request, or
   - an empty result set for a search request.

This happens because the eventually consistent endpoint has not yet synced the new data. A later request will return the correct result once the data export completes.

If your application does not account for eventual consistency, you may encounter **non-deterministic runtime behavior**. Code paths that work reliably during development or testing may fail intermittently in production, especially under load, if this characteristic is ignored.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

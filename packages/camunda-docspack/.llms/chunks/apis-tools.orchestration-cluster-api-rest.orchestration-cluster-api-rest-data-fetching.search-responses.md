# Data fetching — Search responses

Search responses consist of two components: **`items`** and **`page`**.

- The **`items`** array contains instances of the respective endpoint’s resource.  
  The structure and attributes of these instances vary by endpoint and are detailed in the corresponding endpoint documentation.

- The **`page`** object includes pagination details for navigating through results in subsequent search requests:
  - **`totalItems`**: Indicates the total number of results for the query.
    > **Note:** In Elasticsearch/OpenSearch, this value is capped at **10,000**, even if more results are available.
  - **`startCursor`**: A reference to the **first** entry on the current page.  
    Use this value in the `before` parameter to page **backward** in a subsequent [search request](#search-requests).
  - **`endCursor`**: A reference to the **last** entry on the current page.  
    Use this value in the `after` parameter to page **forward** in a subsequent [search request](#search-requests).

Example

```
{
  "items": [
    {
      "state": "CREATED",
      "processInstanceKey": "22456786958",
      "userTaskKey": "22456786345",
      ...
    },
    {
      "state": "CREATED",
      "processInstanceKey": "22456786958",
      "userTaskKey": "22456786456",
      ...
    },
    {
      "state": "COMPLETED",
      "processInstanceKey": "22456786958",
      "userTaskKey": "22456786678",
      ...
    }
  ],
  "page": {
    "totalItems":  345,
    "startCursor": "jfenj8vhekgj98uzfafhu7",
    "endCursor": "negbkjeh84tzh4gk0kwegj"
  }
}
```

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

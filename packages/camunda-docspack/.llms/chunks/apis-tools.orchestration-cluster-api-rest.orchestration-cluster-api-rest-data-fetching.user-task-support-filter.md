# Data fetching — User task support — Filter

The filter object defines which fields should match. Only items that match the given fields will be returned. The available fields vary by object and are described in the respective search endpoint. Filtering by a unique identifier is usually available in filtering options. Beyond that, the filter options don’t have to comprise all the returned items’ attributes.

Example

```
POST /v2/user-tasks/search

{
  "filter": {
    "assignee": "demo",
    "processInstanceKey": "22456786958"
  }
}
```

This filters by the attributes `assignee` and `processInstanceKey`, looking for exact matches with the provided values.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

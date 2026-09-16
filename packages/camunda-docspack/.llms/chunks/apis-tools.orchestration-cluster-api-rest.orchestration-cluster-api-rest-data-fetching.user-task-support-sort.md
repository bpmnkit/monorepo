# Data fetching — User task support — Sort

The sort array specifies by which `field`s to sort the result items and whether this happens in ascending (ASC) or descending (DESC) `order`.

Example

```
POST /v2/user-tasks/search

{
  "sort": [
    { "field": "state", "order": "ASC" }
  ]
}
```

This sorts the overall result set by the `state` attribute in ascending order.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

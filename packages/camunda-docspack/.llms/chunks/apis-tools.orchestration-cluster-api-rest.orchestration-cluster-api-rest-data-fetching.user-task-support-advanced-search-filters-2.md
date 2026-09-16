# Data fetching — User task support — Advanced search filters (2)

Example

```
POST /v2/user-tasks/search

{
  "filter": {
    "assignee": "demo",
    "processInstanceKey": "22456786958",
    "candidateGroups": { "$neq": "external-supervisor", "$like": "external-*" }
  }
}
```

The top-level filters `assignee`, `processInstanceKey`, and `candidateGroups` are connected by an AND operator. Likewise, the `$neq` and `$like` advanced filter operators inside the top-level `candidateGroups` filter are combined by an AND operator.

#### Variables

Search endpoints can support filtering by variable values. This allows querying for process-related resources based on the values of specific variables that exist in their respective scope. For example, user task search supports filtering using the `localVariables` array and defining filter criteria for specific variables.

For variable values, the advanced filter criteria outlined above for fields apply.

Example

```
POST /v2/user-tasks/search

{
  "filter": {
    "localVariables" :  [
      { "name": "orderVolume", "value": "10000" },
      { "name": "price", "value": { "$lt": "500" } },
      { "name": "skipped", "value": { "$exists": false } }
    ]
  }
}
```

This filters for user tasks containing at least the variables `orderVolume` with a value of `10000` and `price` with a value lower than `500`, not containing variable `skipped`.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

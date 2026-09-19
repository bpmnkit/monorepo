# Data fetching — Search example

Querying for the first three user tasks with certain criteria and sorted by state could look as follows:

```
POST /v2/user-tasks/search

{
  "filter": {
    "assignee": "demo",
    "processInstanceKey": "22456786958",
    "candidateGroups": { "$like": "external-*", "$neq": "external-supervisor" },
    "localVariables" :  [
      { "name": "orderVolume", "value": "10000" },
      { "name": "price", "value": { "$lt": "500" } },
      { "name": "skipped", "value": { "$exists": false } }
    ],
  },
  "sort": [
    { "field": "state", "order": "ASC" }
  ],
  "page": {
    "limit": 3
  }
}
```

This could yield the following example result:

```
200 OK

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

A follow-up request to receive the next three items could then look as follows:

```
POST /v2/user-tasks/search

{
  "filter": {
    "assignee": "demo",
    "processInstanceKey": "22456786958",
    "candidateGroups": { "$like": "external-*", "$neq": "external-supervisor" },
    "localVariables" :  [
      { "name": "orderVolume", "value": "10000" },
      { "name": "price", "value": { "$lt": "500" } },
      { "name": "skipped", "value": { "$exists": false } }
    ],
  },
  "sort": [
    { "field": "state", "order": "ASC" }
  ],
  "page": {
    "limit":  3,
    "after": "negbkjeh84tzh4gk0kwegj"
  }
}
```

This yields the next three user task instances after the last one from the first search request’s result.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

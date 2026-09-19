# Data fetching — User task support — Advanced search filters

To provide an easy yet expressive way for users to search for and filter resources, search requests can contain more advanced filter criteria than fields being _equal_ to a target value.

For example, this allows searching using logical (and, in) and comparison operators (greater than, less than). The list of generally supported advanced filter operators is described below. The supported operators depend on the endpoint and the type of the filter attribute. All endpoints document available operators for each attribute in the Orchestration Cluster REST API specification.

#### Conditional Operators

| Operator  | Syntax                                         | Description                                                                                                                                                                                                                      |
| --------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$eq`     | `field: { "$eq": value }`                      | Filter where `field` is equal to `value`. Abbreviated form `field: value` is also allowed.                                                                                                                                       |
| `$neq`    | `field: { "$neq": value }`                     | Filter where `field` is not equal to `value`.                                                                                                                                                                                    |
| `$exists` | `field: { "$exists": value }`                  | Filter where `field` does or does not exist. The `value` is a boolean and can be either `true` or `false`.                                                                                                                       |
| `$gt`     | `field: { "$gt": value }`                      | Filter where `field` is greater than `value`.                                                                                                                                                                                    |
| `$gte`    | `field: { "$gte": value }`                     | Filter where `field` is greater than or equal to `value`.                                                                                                                                                                        |
| `$lt`     | `field: { "$lt": value }`                      | Filter where `field` is less than `value`.                                                                                                                                                                                       |
| `$lte`    | `field: { "$lte": value }`                     | Filter where `field` is less than or equal to `value`.                                                                                                                                                                           |
| `$like`   | `field: { "$like": value }`                    | Filter where `field` contains a string like `value`. The wildcard characters `*` (zero, one, or multiple characters) and `?` (a single character) are allowed in `value`. They can be escaped with a backslash, like in `my \*`. |
| `$in`     | `field: { "$in": [ value1, value2, ... ] }`    | Filter where `field` is equal to at least one of the `value`s in the provided array.                                                                                                                                             |
| `$notIn`  | `field: { "$notIn": [ value1, value2, ... ] }` | Filter where `field` is not equal to any one of the `value`s in the provided array.                                                                                                                                              |

Example

```
POST /v2/user-tasks/search

{
  "filter": {
    "candidateGroups": { "$like": "external-*", "$neq": "external-supervisor" }
  }
}
```

This filters by `candidateGroups` that start with `"external-"` but do not match `"external-supervisor"`.

#### Logical Operators

| Operator | Syntax                                                        | Description                                                                                                                   |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `$or`    | `"$or": [ { condition1 }, { condition2 }, ... ]`              | Filter where at least one of the conditions is true.                                                                          |
| and      | `{ field: { "$lt": value1 }, field: { "$gt": value2 }, ... }` | All conditions outside of `$or` operators will be considered as combined by an `AND` operator. There is no explicit operator. |

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching

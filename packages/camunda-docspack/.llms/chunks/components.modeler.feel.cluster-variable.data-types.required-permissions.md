# Supported data types — Required permissions

A `SECRET_REFERENCE`-kind variable needs the same permissions as any other cluster variable. There is no additional permission for this kind.

| Action            | Required permission                              |
| ----------------- | ------------------------------------------------ |
| Create a variable | `CREATE` on the `CLUSTER_VARIABLE` resource type |
| Get or search     | `READ` on the `CLUSTER_VARIABLE` resource type   |
| Update a variable | `UPDATE` on the `CLUSTER_VARIABLE` resource type |
| Delete a variable | `DELETE` on the `CLUSTER_VARIABLE` resource type |

The resource identifier is the variable name, or `*` for all cluster variables. See [authorizations](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations#available-resources) for how to grant these permissions.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types

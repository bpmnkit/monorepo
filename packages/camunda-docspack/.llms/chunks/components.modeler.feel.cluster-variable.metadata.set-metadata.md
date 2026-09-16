# Metadata — Set metadata

You can set metadata when creating or updating a cluster variable through the [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-global-cluster-variable.api). For example:

```json
{
  "name": "DE_VAT_RATE",
  "scope": "GLOBAL",
  "value": { "rate": 0.19 },
  "metadata": {
    "category": "TAX_RATE",
    "region": "EU",
    "year": 2026
  }
}
```

Metadata is included in every get and search response.


## Filter by metadata

You can use the `metadata` filter to find cluster variables with specific metadata. For supported filters and request examples, see [search cluster variables](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-cluster-variables.api) in the Orchestration Cluster API reference.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/metadata

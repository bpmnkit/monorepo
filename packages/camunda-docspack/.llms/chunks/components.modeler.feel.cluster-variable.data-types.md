# Supported data types

Understand data types supported by cluster variables.

Understand the data types supported by cluster variables for different configuration needs.


## Simple values

- **String**: Text values for URLs, names, identifiers.
- **Number**: Numeric values for thresholds, timeouts, counts.
- **Boolean**: True/false values for feature flags and toggles.


## Complex values

- **Objects**: Nested structures for grouped configuration.
- **Arrays**: Lists of values.

**Note**
Access patterns may vary depending on how the array is used.


## Variable kinds

Every cluster variable has a kind, which determines how Camunda reads its value.

| Kind               | Description                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JSON`             | The default. Your value is data, and Camunda reads it exactly as you stored it.                                                                                                     |
| `SECRET_REFERENCE` | The value can contain an [Orchestration Cluster secret reference](https://docs.camunda.io/docs/next/reference/glossary#secret-reference-orchestration-cluster), `camunda.secrets.<name>`, which Camunda resolves. |

Resolving `SECRET_REFERENCE` references is part of an [alpha feature](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features) and may be subject to change in future releases.

Only a `SECRET_REFERENCE`-kind variable has its references resolved. A `JSON`-kind variable whose value contains the same text is treated as ordinary text, and that text reaches your process unchanged.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types

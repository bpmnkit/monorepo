# Supported data types — Read a variable of kind `SECRET_REFERENCE`

Get and search responses return the stored value, so you see the reference text rather than a resolved value. References are resolved only when a process reads the variable in an input mapping, as described in [resolve secret references in a cluster variable](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/usage-guide#resolve-secret-references-in-a-cluster-variable). For where resolved values appear and where they do not, see [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

To find variables of a given kind, use the `kind` filter in [search cluster variables](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-cluster-variables.api).

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types

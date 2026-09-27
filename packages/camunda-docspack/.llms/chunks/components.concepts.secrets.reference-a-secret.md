# Secrets — Reference a secret

You can reference a secret in Camunda using a [secret reference](https://docs.camunda.io/docs/next/reference/glossary#secret-reference).

- This is a placeholder written into a model that stands in for a secret value.
- The recommended syntax is `camunda.secrets.<name>`. This is resolved centrally by the [Orchestration Cluster](https://docs.camunda.io/docs/next/reference/glossary#orchestration-cluster).
- To learn how the backing store is configured in each offering, see [using `camunda.secrets.*` references](https://docs.camunda.io/docs/next/components/connectors/use-connectors/index#using-camundasecrets-references) and [store and create secrets](#store-and-create-secrets).

| Syntax                   | Resolved by                                                           | Where you use it                                                                                                                                                                                                                                                                                                |
| :----------------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camunda.secrets.<name>` | [Orchestration Cluster](https://docs.camunda.io/docs/next/reference/glossary#orchestration-cluster) | Input mapping FEEL expressions, and connector or credential fields backed by a `SECRET_REFERENCE` cluster variable.[Secret resolution](https://docs.camunda.io/docs/next/components/concepts/secret-resolution)[Secret reference (Orchestration Cluster)](https://docs.camunda.io/docs/next/reference/glossary#secret-reference-orchestration-cluster). |

**Note: Legacy connector secrets**
An older `{{secrets.<name>}}` syntax, resolved by the connector runtime, remains supported for existing connector models. See [Legacy connector secrets](#legacy-connector-secrets).

For a working example of referencing `camunda.secrets.<name>` in a model, including the FEEL expression rules, see [Secret references in input mappings](https://docs.camunda.io/docs/next/components/concepts/variables#secret-references-in-input-mappings).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secrets

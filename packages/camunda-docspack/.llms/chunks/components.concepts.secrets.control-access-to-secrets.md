# Secrets — Control access to secrets

The `SECRET` resource's `READ` and `REVEAL` permissions control who can list and reveal a secret via the `/v2/secrets` API. These permissions do not govern the broker resolving a reference for job activation.

See [authorizations](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations#reveal-permission-for-the-secret) and [secret authorizations don't cover broker-side resolution](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations#secret-authorizations-dont-cover-broker-side-resolution).


## Legacy connector secrets

The legacy secret reference syntax, `{{secrets.<name>}}` is resolved by the [connector runtime](https://docs.camunda.io/docs/next/reference/glossary#connector-runtime) itself at execution time, and can be used in any connector field in the properties panel.

This syntax remains fully supported for existing connector models: "legacy" describes its age relative to `camunda.secrets.<name>`, not its support status. See [using secrets](https://docs.camunda.io/docs/next/components/connectors/use-connectors/index#using-secrets) to learn how to reference a legacy secret in a model, and the [secret reference (legacy)](https://docs.camunda.io/docs/next/reference/glossary#secret-reference-legacy) glossary entry.

In Self-Managed, a connector secret provider supplies the values behind legacy references, for example from prefixed environment variables or a custom provider. When deploying with the Helm chart, a [Kubernetes Secret](https://docs.camunda.io/docs/next/reference/glossary#kubernetes-secret) can deliver these values as mounted environment variables. See [Connector secrets in Self-Managed](https://docs.camunda.io/docs/next/self-managed/components/connectors/connectors-configuration#secrets) and [Helm charts secret management](https://docs.camunda.io/docs/next/self-managed/deployment/helm/configure/secret-management).

### Limitations

Compared to `camunda.secrets.<name>`, the legacy syntax has the following limitations:

| Limitation                           | Description                                                                                                                                                                                                                                                                                                                                                                                                |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No field-scoped resolution           | A legacy reference can resolve outside the field it was written in.The [secret filter](https://docs.camunda.io/docs/next/self-managed/components/connectors/connectors-configuration#secret-filter) introduced with [security notice 61](https://docs.camunda.io/docs/next/reference/notices#notice-61) mitigates this; `camunda.secrets.<name>` scopes resolution to the field instead. See [secret resolution](https://docs.camunda.io/docs/next/components/concepts/secret-resolution#reference-syntax). |
| No resource-based authorization      | Legacy secrets have no `SECRET` resource permissions and rely on the secret filter instead. See [control access to secrets](#control-access-to-secrets).                                                                                                                                                                                                                                                   |
| No external secret store integration | Values come from connector secret providers, not from a File, AWS Secrets Manager, or GCP Secret Manager store. See [secrets configuration](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets) for the stores `camunda.secrets.<name>` supports.                                                                                                            |

**Tip: Migrating from the legacy syntax?**
In Self-Managed, [set up the secret store](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets) and move your values there first. Then follow [Migrate to `camunda.secrets.<name>`](https://docs.camunda.io/docs/next/components/connectors/use-connectors/migrate-secrets), which covers the step-by-step process, including the connector runtime's fallback mode for incremental migration.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secrets

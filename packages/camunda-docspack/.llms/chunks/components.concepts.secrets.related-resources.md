# Secrets — Related resources

- The [secret reference](https://docs.camunda.io/docs/next/reference/glossary#secret-reference) and its related glossary entries defines the terms used in these sections.

### `camunda.secrets.<name>` (recommended)

- [Secret references in input mappings](https://docs.camunda.io/docs/next/components/concepts/variables#secret-references-in-input-mappings) covers referencing `camunda.secrets.<name>` in a model, with examples.
- [Cluster secrets](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-secrets#reference-connector-secrets-as-camundasecretsname) covers referencing SaaS-managed secrets as `camunda.secrets.<name>`.
- [Secrets configuration](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets) covers configuring the secret store in Self-Managed.
- [Migrate to `camunda.secrets.<name>`](https://docs.camunda.io/docs/next/components/connectors/use-connectors/migrate-secrets) covers moving from the legacy syntax, including the connector runtime's fallback mode.

### `{{secrets.<name>}}` (legacy)

- [Using secrets](https://docs.camunda.io/docs/next/components/connectors/use-connectors/index#using-secrets) covers referencing secrets from connector fields.
- [Cluster secrets](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-secrets) covers creating and managing secret values in SaaS.
- [Connector secrets in Self-Managed](https://docs.camunda.io/docs/next/self-managed/components/connectors/connectors-configuration#secrets) covers configuring connector secret providers.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secrets

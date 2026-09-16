# Secret resolution — Physical-tenant scope

A reference names no store, so it always addresses the physical tenant's `default` secret store: `camunda.secrets.X` means `camunda.secrets.default.X`. Each physical tenant supports exactly one secret store, counted across every store type combined, and that store's ID must be `default`. Configuring a second store under a different ID is rejected at startup.

Resolving and listing both read the secret stores of the caller's physical tenant only, never another tenant's stores. See [Validation and constraints](https://docs.camunda.io/docs/next/self-managed/concepts/physical-tenants/configuration-reference#validation-and-constraints) for how the one-store-per-tenant rule is validated, and [Secrets](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets) for store configuration.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution

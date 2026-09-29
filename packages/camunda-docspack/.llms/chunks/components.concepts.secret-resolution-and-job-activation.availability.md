# Secret resolution and job activation — Availability

Secret resolution is available in both SaaS and Self-Managed.

| Deployment   | Secret store            | What you configure                                                                                                                                                                                                                                                                                                                      |
| :----------- | :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SaaS         | Provisioned and managed | No secret store configuration.Manage secret values on the cluster's **Cluster secrets** tab.Reference them as `camunda.secrets.<key>`.See [manage connector secrets](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-secrets#reference-connector-secrets-as-camundasecretsname). |
| Self-Managed | File, AWS, or GCP       | The store type, path, and credentials. See [secrets configuration](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets).                                                                                                                                                                   |

**Note**
In Self-Managed deployments, you can only configure AWS Secrets Manager and GCP Secret Manager stores.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
